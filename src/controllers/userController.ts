
import { Request, Response } from "express"
import User from "../models/User"
import UserAnswers from "../models/UserAnswers"
import CategoryOrder from "../models/CategoryOrder"
import { ObjectId } from "mongodb"
import UserHistory from "../models/UserHistory"
import QuestionsByCategory from "../models/QuestionsByCategory"

// Azure Imports
import { BlobServiceClient } from "@azure/storage-blob"
import { DefaultAzureCredential } from "@azure/identity";


// Use the below if using default credentials
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const credential = new DefaultAzureCredential();
if (!accountName) {
    console.log("Please set the AZURE_STORAGE_ACCOUNT_NAME environment variable.");
}
const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
);

//const client = new SecretClient("https://{keyvaultname}.vault.azure.net/", credential);
//console.log('client', client);
// const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
// const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);


const loginUser = async (req: Request, res: Response) => {
    try {
        const { name, smash_user_id, bot_preference } = req.body
        const user = await User.findOne({ smash_user_id })
        if (!user) {
            const newUser = await User.create({
                name,
                smash_user_id,
                bot_preference,
                last_login: new Date()
            })
            if (!newUser) {
                return res.status(400).json({ success: false, message: "Failed to create user" })
            }
            const categoryOrder = await CategoryOrder.findOne({ _id: new ObjectId("654d16dc1241d62b6e3e6c09") }) // will make it dynamic later
            const firstCategory: any = categoryOrder?.order[0]
            const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(firstCategory) })
            const details = []
            for (let i = 0; i < (questionsByCategory?.questions?.length ?? 0); i++) {
                details.push({
                    question_id: questionsByCategory?.questions[i].question_id,
                    is_skipped: false,
                    answer_audio_link: null,
                    answer_transcript: null,
                    summary: '',
                    keywords: [],
                    answered_at: null
                })
            }
            const createUserAnswer = await UserAnswers.create({
                smash_user_id,
                user_id: newUser._id,
                category_id: firstCategory,
                attempt_date_time: new Date(),
                details: details
            })
            if (!createUserAnswer) {
                return res.status(400).json({ success: false, message: "Failed to create user answer" })
            }
            const createUserHistory = await UserHistory.create({
                user_id: newUser._id,
                last_category_accessed: firstCategory,
                login_timestamps: [new Date()],
                all_categories_accessed: [{
                    category_id: firstCategory,
                    accessed_at: new Date(),
                    is_skipped: false,
                    skipped_attempt: 0,
                    skipped_timestamps: []
                }]
            })
            if (!createUserHistory) {
                return res.status(400).json({ success: false, message: "Failed to create user history" })
            }
            const data = { ...questionsByCategory?.toJSON(), interview_key: createUserAnswer._id }
            return res.status(200).json({ success: true, message: "Login Successful", data: data })

        } else {
            const updateLoginTimestamp = await UserHistory.updateOne({ user_id: new ObjectId(user._id) }, {
                $push: {
                    login_timestamps: new Date()
                }
            })
            const userHistory = await UserHistory.findOne({ user_id: new ObjectId(user._id) })
            const totalAttempts: any = userHistory?.login_timestamps.length
            if (totalAttempts % 3 === 0) {
                // TODO
                let firstCategorySkipped: any = null
                for (let i = 0; i < (userHistory?.all_categories_accessed.length ?? 0); i++) {
                    if (userHistory?.all_categories_accessed[i].is_skipped) {
                        firstCategorySkipped = userHistory?.all_categories_accessed[i]
                        break;
                    }
                }
                if (!firstCategorySkipped) {
                    return res.status(200).json({ success: false, message: "No Category Skipped" });
                }
                const userAnswers = await UserAnswers.findOne({ user_id: new ObjectId(user._id), category_id: firstCategorySkipped.category_id })
                const skipped_questions = userAnswers?.skip_questions_ids || []
                const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(firstCategorySkipped.category_id) })
                const questions = questionsByCategory?.questions || []
                let question_data = []
                for (let i = 0; i < (questions?.length); i++) {
                    if (skipped_questions.includes(questions[i].question_id)) {
                        question_data.push(questions[i])
                    }
                }
                const skipped_intro_videos = questionsByCategory?.skip_intro_videos || []
                const intro_link = skipped_intro_videos[Math.floor(Math.random() * skipped_intro_videos.length)]
                const data = { ...questionsByCategory?.toJSON(), desktop_intro_video_link: intro_link, questions: question_data, interview_key: userAnswers?._id }
                return res.status(200).json({ success: true, message: "Login Successful", data: data });
            } else {
                const lastCategoryAccessed = userHistory?.last_category_accessed
                const categoryOrder = await CategoryOrder.findOne({ _id: new ObjectId("654d16dc1241d62b6e3e6c09") }) // will make it dynamic later
                const order: any = categoryOrder?.order
                let nextCategory: any = ""
                for (let i = 0; i < order.length; i++) {
                    if (order[i].equals(lastCategoryAccessed)) {
                        nextCategory = order[(i + 1) % order.length]
                        break
                    }
                }
                const isCategoryInHistory = userHistory?.all_categories_accessed.find((category: any) => category.category_id.equals(nextCategory))
                if (!isCategoryInHistory) {
                    const updateAllCategoriesAccessed = await UserHistory.updateOne({ user_id: new ObjectId(user._id) }, {
                        $push: {
                            all_categories_accessed: {
                                category_id: nextCategory,
                                accessed_at: new Date(),
                                is_skipped: false,
                                skipped_attempt: 0,
                                skipped_timestamps: []
                            }
                        }
                    })
                } else {
                    const accessTime = await UserHistory.updateOne({ user_id: new ObjectId(user._id), "all_categories_accessed.category_id": nextCategory }, {
                        $set: {
                            "all_categories_accessed.$.accessed_at": new Date()
                        }
                    })

                }
                const updateLastCategoryAccessed = await UserHistory.updateOne({ user_id: new ObjectId(user._id) }, {
                    $set: {
                        last_category_accessed: nextCategory
                    },
                })

                const userAnswer = await UserAnswers.findOne({ user_id: new ObjectId(user._id), category_id: nextCategory })
                if (!userAnswer) {
                    const createUserAnswer = await UserAnswers.create({
                        smash_user_id,
                        user_id: user._id,
                        category_id: nextCategory,
                        attempt_date_time: new Date()
                    })
                    if (!createUserAnswer) {
                        return res.status(400).json({ success: false, message: "Failed to create user answer" })
                    }
                }
                const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(nextCategory) })
                const data = { ...questionsByCategory?.toJSON(), interview_key: userAnswer?._id }
                return res.status(200).json({ success: true, message: "Login Successful", data: data })
            }

        }
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message })
    }
}

const saveAnswerRecordings = async (req: any, res: Response) => {
    try {
        const { question_id, interview_key } = req.body
        if (!question_id || !interview_key) {
            return res.json({ success: false, message: "Question ID or Interview Key Missing" })
        }
        console.log(question_id, interview_key)
        const recording = req?.files?.recording
        if (!recording || !recording.mimetype) {
            return res.json({ success: false, message: "Recording Missing" })
        }
        const containerClient = blobServiceClient.getContainerClient("qa-smash-container");

        if (!await containerClient.exists()) {
            const createContainerResponse = await containerClient.create();
            console.log(`Container was created successfully.\n\trequestId:${createContainerResponse.requestId}\n\tURL: ${containerClient.url}`);
        }

        const blobType = recording.mimetype.split('/')[1]
        const blobName = `${interview_key}/${question_id}.${blobType}`
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        console.log(`\nUploading to Azure storage as blob\n\tname: ${blobName}:\n\tURL: ${blockBlobClient.url}`);
        const uploadBlobResponse = await blockBlobClient.upload(recording.data, recording.data.length, {
            metadata: { question_id, interview_key }
        });
        if (uploadBlobResponse.errorCode) {
            console.log(uploadBlobResponse.errorCode)
            return res.json({ success: false, message: "Error Occurred while saving recording, Try Again." })
        }
        console.log(`Blob was uploaded successfully. requestId: ${uploadBlobResponse.requestId}`);

        return res.json({ success: true, message: "Recording saved successfully", url: blockBlobClient.url })

    } catch (e: any) {
        console.log(e.message)
        return res.json({ success: false, message: "Internal Server Error Occurred", error: e.message })
    }
}

const skipQuestion = async (req: Request, res: Response) => {
    try {
        const { question_id, interview_key } = req.body
        const userAnswer = await UserAnswers.findOne({ _id: new ObjectId(interview_key) })
        console.log(userAnswer)
        if (!userAnswer) {
            return res.json({ success: false, message: "Invalid Interview Key or question not found" })
        }
        if (!userAnswer.skip_questions_ids.includes(question_id)) {
            const updateSkipQuestion = await UserAnswers.updateOne({ _id: new ObjectId(interview_key), "details.question_id": question_id }, {
                $push: {
                    skip_questions_ids: question_id
                },
                $inc: {
                    total_questions_skipped: 1
                },
                $set: {
                    "details.$.is_skipped": true
                }
            });
        }
        const updateHistory = await UserHistory.updateOne({ user_id: userAnswer.user_id, "all_categories_accessed.category_id": userAnswer.category_id }, {
            $set: {
                "all_categories_accessed.$.is_skipped": true
            }
        });
        return res.json({ success: true, message: "Question Skipped Successfully" })
        // return res.json({ success: false, message: "Question Already Skipped" })
    } catch (err: any) {
        console.log(err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error Occurred", error: err.message })
    }
}

const endInterview = async (req: Request, res: Response) => {
    try {
        // TODO
    } catch (err: any) {
        console.log(err.message)
        return res.json({ success: false, message: "Internal Server Error Occurred", error: err.message })
    }
}

const saveMultipleChoiceAnswer = async (req: Request, res: Response) => {
    try {
        const { question_id, interview_key, answer } = req.body
        const answerObj = {
            question_id: question_id,
            is_skipped: false,
            answer_audio_link: null,
            answer_transcript: answer,
            summary: '',
            keywords: [],
            answered_at: new Date()
        }
        const userAnswer = await UserAnswers.findOne({ _id: new ObjectId(interview_key), "details.question_id": question_id })
        if (userAnswer) {
            const updateAnswer = await UserAnswers.updateOne({ _id: new ObjectId(interview_key), "details.question_id": question_id }, {
                $set: {
                    "details.$.answer_transcript": answer,
                    "details.$.answered_at": new Date(),
                },
                $pull: {
                    skip_questions_ids: question_id
                }
            })
            if (updateAnswer.modifiedCount === 0) {
                return res.json({ success: false, message: "Error Saving Answer" })
            }
        } else {
            const updateAnswer = await UserAnswers.updateOne({ _id: new ObjectId(interview_key) }, {
                $push: {
                    details: answerObj
                },
                $inc: {
                    total_questions_answered: 1
                },
                $pull: {
                    skip_questions_ids: question_id
                }
            })
            if (updateAnswer.modifiedCount === 0) {
                return res.json({ success: false, message: "Error Saving Answer" })
            }
        }

        return res.json({ success: true, message: "Answer Saved Successfully" })
    } catch (err: any) {
        console.log(err.message)
        return res.json({ success: false, message: "Internal Server Error Occurred", error: err.message })
    }
}

export default { loginUser, saveAnswerRecordings, skipQuestion, saveMultipleChoiceAnswer }
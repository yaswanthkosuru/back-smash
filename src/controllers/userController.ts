import { checkIfAllQuestionsAnswered } from './../utils/utils';

import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import CategoryOrder from "../models/CategoryOrder";
import QuestionsByCategory from "../models/QuestionsByCategory";
import User from "../models/User";
import UserAnswers from "../models/UserAnswers";
import UserHistory from "../models/UserHistory";
import { transcribeRecording } from "../utils/transcribe";
import { getAnswerEvaluation, getQuestionDetails, updateAnswerEvaluation } from "../utils/utils";

// Azure Imports
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";


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
        console.log('smash_user_id', smash_user_id)
        console.log('userExist', user)
        if (!user) {
            const newUser = await User.findOneAndUpdate({ smash_user_id }, {
                name,
                smash_user_id,
                bot_preference,
                last_login: new Date()
            }, { upsert: true, new: true })
            console.log('newUser', newUser)
            if (!newUser) {
                return res.status(400).json({ success: false, message: "Failed to create user" })
            }
            //get the first category in the category order
            const categoryOrder: any = await CategoryOrder.find()
            const firstCategory: any = categoryOrder[0]?.order[0]
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
            const createUserAnswer = await UserAnswers.findOneAndUpdate({
                smash_user_id, user_id: newUser._id,
                category_id: firstCategory,
            }, {
                smash_user_id,
                user_id: newUser._id,
                category_id: firstCategory,
                attempt_date_time: new Date(),
                details: details
            }, { upsert: true, new: true })
            if (!createUserAnswer) {
                return res.status(400).json({ success: false, message: "Failed to create user answer" })
            }
            const createUserHistory = await UserHistory.findOneAndUpdate({ smash_user_id }, {
                user_id: newUser._id,
                smash_user_id,
                last_category_accessed: firstCategory,
                login_timestamps: [new Date()],
                all_categories_accessed: [{
                    category_id: firstCategory,
                    accessed_at: new Date(),
                    is_skipped: false,
                    skipped_attempt: 0,
                    skipped_timestamps: []
                }]
            }, { upsert: true, new: true })
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
                let questions_timestamps = []
                let response_timestamps = []
                let skip_timestamps = []
                let question_data = []
                for (let i = 0; i < (questions?.length); i++) {
                    if (skipped_questions.includes(questions[i].question_id)) {
                        question_data.push(questions[i])
                        questions_timestamps.push(questionsByCategory?.questions_timestamps[i])
                        response_timestamps.push(questionsByCategory?.response_timestamps[i])
                        skip_timestamps.push(questionsByCategory?.skip_timestamps[i])

                    }
                }
                question_data.push(questions[questions.length - 1])
                questions_timestamps.push(questionsByCategory?.questions_timestamps[questions.length - 1])
                const skipped_intro_videos = questionsByCategory?.skip_intro_videos || []
                const intro_link = skipped_intro_videos[Math.floor(Math.random() * skipped_intro_videos.length)]
                const data = { ...questionsByCategory?.toJSON(), questions_timestamps: questions_timestamps, response_timestamps: response_timestamps, skip_timestamps: skip_timestamps, desktop_intro_video_link: intro_link, questions: question_data, interview_key: userAnswers?._id }
                return res.status(200).json({ success: true, message: "Login Successful", data: data });

            } else {
                const lastCategoryAccessed = userHistory?.last_category_accessed
                const categoryOrder: any = await CategoryOrder.find()
                console.log('categoryOrder', categoryOrder);
                const order: any = categoryOrder[0]?.order
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
                const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(nextCategory) })
                if (!userAnswer) {
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
                    const createUserAnswer = await UserAnswers.findOneAndUpdate({ smash_user_id, user_id: user._id, category_id: nextCategory }, {
                        smash_user_id,
                        user_id: user._id,
                        category_id: nextCategory,
                        attempt_date_time: new Date(),
                        details: details
                    }, { upsert: true, new: true })
                    if (!createUserAnswer) {
                        return res.status(400).json({ success: false, message: "Failed to create user answer" })
                    }
                    const data = { ...questionsByCategory?.toJSON(), interview_key: createUserAnswer?._id }
                    return res.status(200).json({ success: true, message: "Login Successful", data: data })
                }
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
        console.log('recording', recording);
        if (uploadBlobResponse.errorCode) {
            console.log(uploadBlobResponse.errorCode)
            return res.json({ success: false, message: "Error Occurred while saving recording, Try Again." })
        }
        console.log(`Blob was uploaded successfully. requestId: ${uploadBlobResponse.requestId}`);
        /**
         * Send response to frontend after the blob has been uploaded
         * This unblocks the user on the frontend
         */
        res.json({ success: true, message: "Recording saved successfully", url: blockBlobClient.url })
        /**
         * After uploading the blob to azure storage, do the following
         * 1. Transcribe the recording
         * 2. Perform evaluations
         * 3. Save results in the database
         */
        const transcription = await transcribeRecording(blockBlobClient.url);
        const interviewDetails = await getQuestionDetails({ interviewKey: interview_key, questionId: question_id });
        const answerEvaluation = await getAnswerEvaluation({ interviewDetails: interviewDetails, transcription: transcription.text });
        let evaluation = {
            interview_key: interview_key,
            question_id: question_id,
            is_skipped: false,
            answer_audio_link: blockBlobClient.url,
            answer_transcript: transcription?.text,
            summary: "", // TODO: will come from evaluation function
            keywords: [answerEvaluation], // TODO: will come from evaluation function
            answered_at: new Date(),
        }
        const updatedEvaluation = await updateAnswerEvaluation(evaluation)
        const checkIfAllAnswered = await checkIfAllQuestionsAnswered(interview_key)
        if (checkIfAllAnswered) return true;
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

const skipAllQuestions = async (req: Request, res: Response) => {
    try {
        const { interview_key } = req.body
        const userAnswer = await UserAnswers.findOne({ _id: new ObjectId(interview_key) })
        if (!userAnswer) {
            return res.json({ success: false, message: "Invalid Interview Key or question not found" })
        }
        const skipped = userAnswer?.skip_questions_ids || []
        for (let i = 0; i < (userAnswer?.details?.length ?? 0) - 1; i++) {
            if (!userAnswer?.details[i].answer_transcript && !skipped.includes(userAnswer?.details[i].question_id as number)) {
                skipped.push(userAnswer?.details[i].question_id as number)
                // userAnswer.details[i].is_skipped = true
            }
        }
        for (let id of skipped) {
            userAnswer.details[id].is_skipped = true
        }
        await UserAnswers.updateOne({ _id: new ObjectId(interview_key) }, {
            $set: {
                details: userAnswer.details,
                skip_questions_ids: skipped,
                total_questions_skipped: skipped.length
            }
        })
        if (skipped.length !== 0) {
            const updateHistory = await UserHistory.updateOne({ user_id: userAnswer.user_id, "all_categories_accessed.category_id": userAnswer.category_id }, {
                $set: {
                    "all_categories_accessed.$.is_skipped": true
                }
            });
        }
        return res.json({ success: true, message: "All Questions Skipped Successfully" })
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

const getUserTranscript = async (req: Request, res: Response) => {
    try {
        const { smash_user_id, interview_key } = req.body
        const userAnswer = await UserAnswers.findOne({ smash_user_id, _id: new ObjectId(interview_key) })
        if (!userAnswer) {
            return res.json({ success: false, message: "Invalid Interview Key" })
        }
        const category_id = userAnswer?.category_id
        const questionsByCategory = await QuestionsByCategory.findOne({ _id: category_id })
        const questions = questionsByCategory?.questions || []
        const data = []
        for (let i = 0; i < questions.length - 1; i++) {
            const question = questions[i]
            const answer = userAnswer?.details.find((answer: any) => answer.question_id === question.question_id)
            if (answer) {
                data.push({
                    question_id: question.question_id,
                    question: question.question_text,
                    answer: answer.answer_transcript,
                    summary: answer.summary,
                    keywords: answer.keywords.join(", "),
                    skipped: answer.is_skipped
                })
            }
        }
        return res.json({ success: true, message: "Transcript Fetched Successfully", data: data })
    } catch (err: any) {
        console.log(err.message)
        return res.json({ success: false, message: "Internal Server Error Occurred", error: err.message })
    }
}

export default { loginUser, saveAnswerRecordings, skipQuestion, saveMultipleChoiceAnswer, skipAllQuestions, getUserTranscript }
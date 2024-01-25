import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import CategoryOrder from "../models/CategoryOrder";
import QuestionsByCategory from "../models/QuestionsByCategory";
import User from "../models/User";
import UserAnswers from "../models/UserAnswers";
import UserHistory from "../models/UserHistory";
import { getNextCategory, getSkippedCategoryData } from "../utils/loginLogic";
import { transcribeRecording } from "../utils/transcribe";
import { getAnswerEvaluation, getDataAccordingToPreference, getQuestionDetails, updateAnswerEvaluation, checkIfAllQuestionsAnswered } from "../utils/utils";

// Azure Imports
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import Error from '../models/Error';


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

/**
 * This function is called everytime the chatbot opens. 
 * This checks if the user has already finished all the categories. If user has accessed all categories, we show end screen.
 * This also checks if user has already specified a bot preference already, to show the male/female bot according to user preference.
 * @param req { smash_user_id: string }
 * @param res { data: string to determine the bot preference, isCompleted: boolean to identify if the end screen should be shown or not }
 */
const checkUserBotPreferenceAndEndStatus = async (req: Request, res: Response) => {
    try {
        const { smash_user_id } = req.body
        const user = await User.findOne({ smash_user_id })
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }
        if (!user.bot_preference) {
            return res.json({ success: false, message: "Bot Preference not found" })
        }
        const userHistory = await UserHistory.findOne({ smash_user_id: smash_user_id })
        const isCompleted = userHistory?.all_categories_accessed.length === 5 && userHistory?.all_categories_accessed.every((category: any) => category.is_skipped === false)
        return res.json({ success: true, message: "Bot Preference found", data: user.bot_preference, isCompleted: isCompleted })    
    } catch (err: any) {
        console.log(err.message)
        return res.json({ success: false, message: "Internal Server Error Occurred", error: err.message })
    }
}

/**
 * This function does 3 things -
 * 1. Checks if user exists in the system. If the user exists, find the next category id that the user is supposed to access and return that.
 * 2. If the user does not exist, create a new user and return first category
 * 3. If user exists and the user is logging in for the 3rd, 6th or 9th time, show a category at random that the user had skipped before.
 * @param req { name: user name, smash_user_id: string, bot_preference: string to specify male/female }
 * @param res { data: Object containing all the category, questions and timestamp details }
 */
const loginUser = async (req: Request, res: Response) => {
    try {
        const { name, smash_user_id, bot_preference } = req.body
        const user = await User.findOne({ smash_user_id })
        if (!user) {
            const newUser = await User.findOneAndUpdate({ smash_user_id }, {
                name,
                smash_user_id,
                bot_preference,
                last_login: new Date()
            }, { upsert: true, new: true })
            if (!newUser) {
                return res.status(400).json({ success: false, message: "Failed to create user" })
            }
            //get the first category in the category order
            const categoryOrder: any = await CategoryOrder.find()
            const firstCategory: any = categoryOrder[0]?.order[0]
            const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(firstCategory) })
            console.log('questionsByCategory', questionsByCategory);
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
            const data = { questionsByCategory, ...getDataAccordingToPreference(bot_preference, questionsByCategory), interview_key: createUserAnswer._id, }
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
                const skippedData = await getSkippedCategoryData(userHistory, user, smash_user_id);
                return res.status(200).json({ success: true, message: "Login Successful", data: skippedData });

            } else {
                const data = await getNextCategory(userHistory, user, smash_user_id);
                return res.status(200).json({ success: true, message: "Login Successful", data: data })
            }

        }
    } catch (err: any) {
        console.log('inside error', err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message })
    }
}

/**
 * This function is used for transcribing, evaluating and saving the answer recordings of the user
 * Transcribing is done using whisper api of OpenAI
 * Evaluating the answer to calculate answer summary is done using Azure OpenAI
 * If there is an error in evaluating the answer, we store a document in error collection and run a cron job every night to re-evaluate the answers
 * @param req { question_id, interview_key, audio file}
 */
const saveAnswerRecordings = async (req: any, res: Response) => {
    const { question_id, interview_key } = req.body
    try {
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
        const error = await Error.findOneAndUpdate({ question_id, interview_key }, {
            question_id,
            interview_key,
            error: e.message,
            resolved: false
        }, { upsert: true, new: true })
        return res.json({ success: false, message: "Internal Server Error Occurred", error: e.message })
    }
}

/**
 * This function is called when user skips a question. It does following-
 * 1. Add question_id to skipped_questions_id, total questions skipped count, and is_skipped to a question in UserAnswers Collection
 * 2. Update UserHistory collection with all_categories_accessed.is_skipped: true to mark that the category has questions that was skipped
 * @param req { question_id, interview-key }
 */
const skipQuestion = async (req: Request, res: Response) => {
    try {
        const { question_id, interview_key } = req.body
        const userAnswer = await UserAnswers.findOne({ _id: new ObjectId(interview_key) })
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

/**
 * This is called when a user skips the entire category. This happens if the user closes the bot in the middle of answering a question
 * @param req { interview_key }
 */
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

export default { loginUser, saveAnswerRecordings, skipQuestion, skipAllQuestions, getUserTranscript, checkUserBotPreferenceAndEndStatus }
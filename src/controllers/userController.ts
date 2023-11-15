
import { Request, Response } from "express"
import User from "../models/User"
import UserAnswers from "../models/UserAnswers"
import CategoryOrder from "../models/CategoryOrder"
import { ObjectId } from "mongodb"
import UserHistory from "../models/UserHistory"
import QuestionsByCategory from "../models/QuestionsByCategory"

// Azure Imports
import { BlobServiceClient } from "@azure/storage-blob"
import { DefaultAzureCredential } from "@azure/identity"
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const credential = new DefaultAzureCredential();
if (!accountName) {
    console.log("Please set the AZURE_STORAGE_ACCOUNT_NAME environment variable.");
}
const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
);
// This will be used when using the connection string method.
// const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
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
            const createUserAnswer = await UserAnswers.create({
                smash_user_id,
                user_id: newUser._id,
                category_id: firstCategory,
                attempt_date_time: new Date()
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
            const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(firstCategory) })
            return res.status(200).json({ success: true, message: "Login Successful", data: questionsByCategory })

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
                return res.status(200).json({ success: true, message: "Login Successful", data: "TODO" })
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
                const updateLastCategoryAccessed = await UserHistory.updateOne({ user_id: new ObjectId(user._id) }, {
                    $set: {
                        last_category_accessed: nextCategory
                    }
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
                return res.status(200).json({ success: true, message: "Login Successful", data: questionsByCategory })
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
        return res.json({ success: false, message: "Internal Server Error Occurred" })
    }
}


export default { loginUser, saveAnswerRecordings }
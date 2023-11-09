
import { Request, Response } from "express"
import User from "../models/User"
import UserAnswers from "../models/UserAnswers"
import CategoryOrder from "../models/CategoryOrder"
import { ObjectId } from "mongodb"
import UserHistory from "../models/UserHistory"
import QuestionsByCategory from "../models/QuestionsByCategory"
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

export default { loginUser }
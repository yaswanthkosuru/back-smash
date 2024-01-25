import { Request, Response } from "express";
import QuestionsByCategory from "../models/QuestionsByCategory";

/**
 * Controller function to create questions by category
 * @param req body: { category: ObjectId, deskop_video_link: string, mobile_video_link: string, timestamps: [{start_time, end_time}... ], listening_timestamps: {start_time, end_time}, questions: questions to create }
 * @param res Newly created questions by category document
 */
const createQuestionsByCategory = async (req: Request, res: Response) => {
    try {
        const { category, desktop_video_link, mobile_video_link, timestamps, listening_timestamp, questions } = req.body
        const questionsByCategory = await QuestionsByCategory.create({ category, desktop_video_link, mobile_video_link, timestamps, listening_timestamp, questions })
        if (!questionsByCategory) return res.json({ success: false, message: "Unable to create questions by category" })
        return res.json({ success: true, message: "Questions by category created successfully", questionsByCategory })
    } catch (error: any) {
        console.log(error.message)
        return res.json({ success: false, message: "Internal server error", error: error.message })
    }
}

export default { createQuestionsByCategory }
import { Request, Response } from "express"
import CategoryOrder from "../models/CategoryOrder"
import { ObjectId } from "mongodb"

const createCategoryOrder = async (req: Request, res: Response) => {
    try {
        const { order } = req.body
        let orderData = order.map((id: string) => {
            return new ObjectId(id)
        })
        const categoryOrder = await CategoryOrder.create({ order: orderData })
        if (!categoryOrder) return res.json({ success: false, message: "Failed to create category order" })
        return res.json({ success: true, message: "Category order created successfully", categoryOrder })
    } catch (error: any) {
        console.log(error.message)
        return res.json({ success: false, message: "Internal server error", error: error.message })
    }
}

const appendQuestionCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const { category } = req.body
        const categoryOrder = await CategoryOrder.findById(id)
        if (!categoryOrder) {
            return res.json({ success: false, message: "Failed to find category order" })
        }
        if (categoryOrder.order.includes(category)) {
            return res.json({ success: false, message: "Category already exists in order" })
        }
        const append = await CategoryOrder.findByIdAndUpdate(id, { $push: { order: category } }, { new: true })
        if (!append) return res.json({ success: false, message: "Failed to append category" })
        return res.json({ success: true, message: "Category appended successfully", append })
    } catch (error: any) {
        console.log(error.message)
        return res.json({ success: false, message: "Internal server error", error: error.message })
    }
}

export default { createCategoryOrder, appendQuestionCategory }
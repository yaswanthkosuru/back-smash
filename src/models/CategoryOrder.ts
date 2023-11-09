import mongoose from "mongoose"
const { Schema } = mongoose

interface ICategoryOrder extends mongoose.Document {
    order: mongoose.Schema.Types.ObjectId[];
}

const CategoryOrderSchema = new Schema<ICategoryOrder>({
    order: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    }
}, { timestamps: true })

export default mongoose.model<ICategoryOrder>('CategoryOrder', CategoryOrderSchema)
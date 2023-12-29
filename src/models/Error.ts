import { ObjectId } from "mongodb";
import mongoose from "mongoose";
const { Schema } = mongoose

interface IError extends mongoose.Document {
    question_id: number;
    interview_key: ObjectId;
    message: string;
    resolved: boolean;
}

const ErrorSchema = new Schema<IError>({
    question_id: {
        type: Number,
        required: true
    },
    interview_key: {
        type: Schema.Types.ObjectId,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    resolved: {
        type: Boolean,
        default: false
    }
})

export default mongoose.model<IError>("Error", ErrorSchema);
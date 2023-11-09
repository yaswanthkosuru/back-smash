import mongoose from "mongoose"
const { Schema } = mongoose

interface Timestamp {
    start_time: number;
    end_time: number;
}
interface Question {
    question_id: number;
    question_text: string;
    question_type: string;
    question_options: string[];
}
interface IQuestionsByCategory extends mongoose.Document {
    category: string;
    desktop_video_link: { male: string, female: string };
    mobile_video_link: { male: string, female: string };
    timestamps: Timestamp[];
    listening_timestamp: Timestamp;
    questions: Question[];
}

const QuestionsByCategorySchema = new Schema<IQuestionsByCategory>({
    category: {
        type: String,
        required: true
    },
    desktop_video_link: {
        type: Object,
        default: { male: "", female: "" }
    },
    mobile_video_link: {
        type: Object,
        default: { male: "", female: "" }
    },
    timestamps: {
        type: [],
        default: []
    },
    listening_timestamp: {
        type: Object,
        default: { start_time: 0, end_time: 0 }
    },
    questions: {
        type: [],
        default: []
    }
}, { timestamps: true })

export default mongoose.model<IQuestionsByCategory>('QuestionsByCategory', QuestionsByCategorySchema)
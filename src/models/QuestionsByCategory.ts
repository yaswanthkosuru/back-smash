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
    system_prompt: string;
    user_prompt: string;
}
interface IQuestionsByCategory extends mongoose.Document {
    category: string;
    // desktop_video_link: { male: string, female: string };
    desktop_video_link: string;
    desktop_intro_video_link: string;
    // mobile_video_link: { male: string, female: string };
    mobile_video_link: string;
    mobile_intro_video_link: string;
    timestamps: Timestamp[];
    listening_timestamps: Timestamp;
    questions: Question[];
    questions_timestamps: Timestamp[];
    response_timestamps: Timestamp[];
    skip_timestamps: Timestamp[];
    skip_intro_videos: []
}

const QuestionsByCategorySchema = new Schema<IQuestionsByCategory>({
    category: {
        type: String,
        required: true
    },
    desktop_video_link: {
        type: String,
        default: ""
    },
    mobile_video_link: {
        type: String,
        default: ""
    },
    desktop_intro_video_link: {
        type: String,
        default: ""
    },
    mobile_intro_video_link: {
        type: String,
        default: ""
    },
    timestamps: {
        type: [],
        default: []
    },
    listening_timestamps: {
        type: Object,
        default: { start_time: 0, end_time: 0 }
    },
    questions: {
        type: [],
        default: []
    },
    questions_timestamps: {
        type: [],
        default: []

    },
    response_timestamps: {
        type: [],
        default: []

    },
    skip_timestamps: {
        type: [],
        default: []
    },
    skip_intro_videos: {
        type: [],
        default: []
    }
}, { timestamps: true })

export default mongoose.model<IQuestionsByCategory>('QuestionsByCategory', QuestionsByCategorySchema)
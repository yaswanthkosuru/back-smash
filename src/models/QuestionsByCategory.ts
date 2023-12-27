import mongoose from "mongoose";
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
    desktop_video_link: { male: string, female: string };
    desktop_intro_video_link: { male: string, female: string };
    mobile_video_link: { male: string, female: string };
    mobile_intro_video_link: { male: string, female: string };
    // timestamps: Timestamp[];
    listening_timestamps: { male: Timestamp, female: Timestamp };
    questions: Question[];
    questions_timestamps: { male: Timestamp[], female: Timestamp[] };
    response_timestamps: { male: Timestamp[], female: Timestamp[] };
    skip_timestamps: { male: Timestamp[], female: Timestamp[] };
    skip_intro_videos: { male: [], female: [] };
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
    desktop_intro_video_link: {
        type: Object,
        default: { male: "", female: "" }
    },
    mobile_intro_video_link: {
        type: Object,
        default: { male: "", female: "" }
    },
    listening_timestamps: {
        type: Object,
        default: { male: { start_time: 0, end_time: 0 }, female: { start_time: 0, end_time: 0 } }
    },
    questions: {
        type: [],
        default: []
    },
    questions_timestamps: {
        type: { male: [], female: [] },
        default: { male: [], female: [] }

    },
    response_timestamps: {
        type: { male: [], female: [] },
        default: { male: [], female: [] }

    },
    skip_timestamps: {
        type: { male: [], female: [] },
        default: { male: [], female: [] }
    },
    skip_intro_videos: {
        type: { male: [], female: [] },
        default: { male: [], female: [] }
    }
}, { timestamps: true })

export default mongoose.model<IQuestionsByCategory>('QuestionsByCategory', QuestionsByCategorySchema)
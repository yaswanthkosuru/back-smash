import mongoose from "mongoose"
const { Schema } = mongoose

interface Details {
    question_id: number;
    is_skipped: boolean;
    answer_audio_link: string;
    answer_transcript: string;
    summary: string;
    keywords: string[];
    answered_at: Date;
}

export interface IUserAnswers extends mongoose.Document {
    smash_user_id: string;
    user_id: mongoose.Schema.Types.ObjectId;
    attempt_number: number;
    attempt_date_time: Date;
    category_id: mongoose.Schema.Types.ObjectId;
    details: Details[];
    all_skipped: boolean;
    total_questions_answered: number;
    total_questions_skipped: number;
    skip_questions_ids: number[];
}

const UserAnswersSchema = new Schema<IUserAnswers>({
    smash_user_id: {
        type: String,
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    attempt_number: {
        type: Number,
        default: 1
    },
    attempt_date_time: {
        type: Date,
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    details: {
        type: [],
        default: []
    },
    all_skipped: {
        type: Boolean,
        default: false
    },
    total_questions_answered: {
        type: Number,
        default: 0
    },
    total_questions_skipped: {
        type: Number,
        default: 0
    },
    skip_questions_ids: {
        type: [],
        default: []
    }
}, { timestamps: true })

export default mongoose.model<IUserAnswers>("UserAnswers", UserAnswersSchema)
import mongoose from "mongoose"
const { Schema } = mongoose

interface AllCategoriesAccessed {
    category_id: mongoose.Schema.Types.ObjectId;
    accessed_at: Date;
    is_skipped: boolean;
    skipped_attempt: number;
    skipped_timestamps: Date[];
}

interface IUserHistory extends mongoose.Document {
    user_id: mongoose.Schema.Types.ObjectId;
    last_category_accessed: mongoose.Schema.Types.ObjectId;
    all_categories_accessed: AllCategoriesAccessed[];
    login_timestamps: Date[];
}

const UserHistorySchema = new Schema<IUserHistory>({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    last_category_accessed: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    all_categories_accessed: {
        type: [],
        default: []
    },
    login_timestamps: {
        type: [],
        default: []
    }
}, { timestamps: true })

export default mongoose.model<IUserHistory>('UserHistory', UserHistorySchema)
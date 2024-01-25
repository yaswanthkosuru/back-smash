import mongoose from "mongoose"
const { Schema } = mongoose

interface IUser extends mongoose.Document {
    name: string;
    smash_user_id: string;
    bot_preference: string;
    last_login: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    name: {
        type: String,
        required: true
    },
    smash_user_id: {
        type: String,
        required: true,
        index: true,
        unique: true
    },
    bot_preference: {
        type: String,
        required: true
    },
    last_login: {
        type: Date,
    }
}, { timestamps: true })

export default mongoose.model<IUser>('User', UserSchema)

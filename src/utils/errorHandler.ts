import { ObjectId } from 'mongodb';
import Error from '../models/Error';
import UserAnswers from '../models/UserAnswers';
import { transcribeRecording } from './transcribe';
import { checkIfAllQuestionsAnswered, getAnswerEvaluation, getQuestionDetails, updateAnswerEvaluation } from './utils';

const errorHandler = async () => {
    try {
        const errors = await Error.find({ resolved: false })
        for (let error of errors) {
            const question_id = error.question_id
            const interview_key = new ObjectId(error.interview_key)
            const userAnswers = await UserAnswers.findOne({ _id: interview_key })
            // const questions = await QuestionsByCategory.findOne({ _id: userAnswers?.category_id })
            // const curr_question = questions?.questions[question_id]
            const curr_answer = userAnswers?.details[question_id]
            const answer_audio_link = curr_answer?.answer_audio_link || ""
            const transcription = await transcribeRecording(answer_audio_link);
            const interviewDetails = await getQuestionDetails({ interviewKey: interview_key.toString(), questionId: question_id.toString() });
            const answerEvaluation = await getAnswerEvaluation({ interviewDetails: interviewDetails, transcription: transcription.text });
            let evaluation = {
                interview_key: interview_key.toString(),
                question_id: question_id.toString(),
                is_skipped: false,
                answer_audio_link: answer_audio_link,
                answer_transcript: transcription?.text,
                summary: "", // TODO: will come from evaluation function
                keywords: [answerEvaluation], // TODO: will come from evaluation function
                answered_at: new Date(),
            }
            const updatedEvaluation = await updateAnswerEvaluation(evaluation)
            const checkIfAllAnswered = await checkIfAllQuestionsAnswered(interview_key.toString())
            if (checkIfAllAnswered) {
                const updateError = await Error.findOneAndUpdate({ _id: error._id }, { $set: { resolved: true } })
                if (updateError) {
                    console.log(`Evaluated question-${question_id} for interview-${interview_key}`)
                } else {
                    console.log(`Error evaluating question-${question_id} for interview-${interview_key}`)
                }
            } else {
                console.log(`Error evaluating question-${question_id} for interview-${interview_key}`)
            }
        }
    } catch (error) {
        console.log(error);
        console.log(`Error evaluating question`)

    }
}

export default errorHandler 
import { ObjectId } from "mongodb";
import QuestionsByCategory from "../models/QuestionsByCategory";
import UserAnswers from "../models/UserAnswers";
import UserHistory from "../models/UserHistory";

const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const azureApiKey = process.env["AZURE_OPENAI_KEY"];

interface IUpdateEvaluationInput {
  interview_key: string,
  question_id: string,
  is_skipped: boolean,
  answer_audio_link: string,
  answer_transcript: string,
  summary: string,
  keywords: any,
  answered_at: any,
}

interface IInterviewDetails {
  interviewKey: string,
  questionId: string
}

interface IEvaluationInput {
  interviewDetails: any,
  transcription: string
}

export const getQuestionDetails = async ({ interviewKey, questionId }: IInterviewDetails) => {
  try {
    console.log("<<- inside GetInterviewDetails ->>")

    const question_id = parseInt(questionId)
    console.log("question_id >>>", question_id)

    const interview_key = new ObjectId(interviewKey)
    console.log("interview_key >>>", interview_key)

    const userAnswers: any = await UserAnswers.findOne({ _id: interview_key })
    console.log("userAnswers >>>", userAnswers)

    const categoryId = new ObjectId(userAnswers?.category_id)

    const questionsByCategory = await QuestionsByCategory.findOne({ _id: categoryId })
    // console.log("questionsByCategory >>>", questionsByCategory)

    const questionDetails = questionsByCategory?.questions.find(question => question.question_id === question_id)
    // console.log("questionDetails >>>", questionDetails)
    return questionDetails
  } catch (error: any) {
    console.log(error.message)
    throw error;
  }
}

export const updateAnswerEvaluation = async (input: IUpdateEvaluationInput) => {
  try {
    const question_id = parseInt(input.question_id);

    const interview_key = new ObjectId(input.interview_key);
    const answerObj = {
      question_id,
      is_skipped: input.is_skipped,
      answer_audio_link: input.answer_audio_link,
      answer_transcript: input.answer_transcript,
      summary: input.summary,
      keywords: input.keywords,
      answered_at: input.answered_at,
    }
    const query: any = {
      _id: interview_key,
    };
    query[`details.${question_id}`] = { $exists: true };
    const answerData = await UserAnswers.findOne(query);
    let updateAnswerQuery: any = {};
    //const userAnswers = await UserAnswers.findOne({ _id: interviewKey });
    updateAnswerQuery[`details.${question_id}`] = {
      ...answerData?.details?.[question_id],
      ...answerObj
    };
    // const updateAnswer = await CandidateInterview.findOneAndUpdate({ _id: new ObjectId(interviewKey) }, { $set: updateAnswerQuery });
    // let details = userAnswers?.details
    // if (details?.find((detail) => detail?.question_id === questionId)) {
    //   details = details.map((detail) => {
    //     if (detail?.question_id === questionId) {
    //       return answerObj
    //     }
    //     return detail
    //   })
    // } else {
    //   details?.push(answerObj)
    // }
    // userAnswers.details = details;
    if (answerData?.skip_questions_ids.includes(question_id)) {
      updateAnswerQuery.skip_questions_ids = answerData.skip_questions_ids.filter((id) => id !== question_id)
      updateAnswerQuery.total_questions_skipped = answerData.total_questions_skipped - 1
    }
    console.log('updateAnswerQuery', updateAnswerQuery);
    await UserAnswers.findOneAndUpdate({ _id: interview_key }, { $set: updateAnswerQuery });

    //await userAnswers?.save()
    return true;
  } catch (err: any) {
    throw err;
    // console.log(err.message)
    // return res.json({ success: false, message: "Internal Server Error Occurred", error: err.message })
  }
}

export const getAnswerEvaluation = async ({ interviewDetails, transcription }: IEvaluationInput) => {
  try {
    const messages = [
      {
        role: "system", content: interviewDetails.system_prompt
      },
      {
        role: "user", content: `Candidate: ${transcription}
            Prompt: ${interviewDetails.user_prompt}`
      },

    ];

    const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
    const deploymentId = "smash-open-ai-model";
    const result = await client.getChatCompletions(deploymentId, messages);

    for (const choice of result.choices) {
      console.log("gptRes", choice.message);
    }

    return result.choices[0].message.content
  } catch (error: any) {
    console.log(error.message)
    throw error;
  }
}

export const checkIfAllQuestionsAnswered = async (interviewKey: string) => {
  try {
    console.log("<<- inside checkIfAllQuestionsAnswered ->>")
    console.log('interviewKey', interviewKey)
    const interview_key = new ObjectId(interviewKey)
    console.log('interview_key', interview_key)
    const userAnswers = await UserAnswers.findOne({ _id: interview_key })
    const questionsSkipped = userAnswers?.total_questions_skipped
    console.log('questionsSkipped', questionsSkipped)
    const smash_user_id = userAnswers?.smash_user_id
    const category_id = userAnswers?.category_id
    if (questionsSkipped === 0) {
      const updateUserHistory = await UserHistory.findOneAndUpdate({ smash_user_id, 'all_categories_accessed.category_id': category_id }, { $set: { 'all_categories_accessed.$.is_skipped': false } })
      console.log('updateUserHistory', updateUserHistory)
      if (updateUserHistory) {
        return true
      }
    }
    return false
  } catch (error: any) {
    console.log(error.message)
    throw error;
  }
}
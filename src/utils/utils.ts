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

    const question_id = parseInt(questionId)

    const interview_key = new ObjectId(interviewKey)

    const userAnswers: any = await UserAnswers.findOne({ _id: interview_key })

    const categoryId = new ObjectId(userAnswers?.category_id)

    const questionsByCategory = await QuestionsByCategory.findOne({ _id: categoryId })

    return questionsByCategory?.questions.find(question => question.question_id === question_id)
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
    updateAnswerQuery[`details.${question_id}`] = {
      ...answerData?.details?.[question_id],
      ...answerObj
    };

    if (answerData?.skip_questions_ids.includes(question_id)) {
      updateAnswerQuery.skip_questions_ids = answerData.skip_questions_ids.filter((id) => id !== question_id)
      updateAnswerQuery.total_questions_skipped = answerData.total_questions_skipped - 1
    }
    console.log('updateAnswerQuery', updateAnswerQuery);
    await UserAnswers.findOneAndUpdate({ _id: interview_key }, { $set: updateAnswerQuery });

    return true;
  } catch (err: any) {
    throw err;
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
    const interview_key = new ObjectId(interviewKey)
    const userAnswers = await UserAnswers.findOne({ _id: interview_key })
    const questionsSkipped = userAnswers?.total_questions_skipped
    const smash_user_id = userAnswers?.smash_user_id
    const category_id = userAnswers?.category_id
    if (questionsSkipped === 0) {
      const updateUserHistory = await UserHistory.findOneAndUpdate({ smash_user_id, 'all_categories_accessed.category_id': category_id }, { $set: { 'all_categories_accessed.$.is_skipped': false } })
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

export const getDataAccordingToPreference = (botPreference: string, questionsByCategory: any) => {
  const bot_preference = botPreference || "male";
  const desktop_video_link = bot_preference === "male" ? questionsByCategory?.desktop_video_link?.male : questionsByCategory?.desktop_video_link?.female
  const mobile_video_link = bot_preference === "male" ? questionsByCategory?.mobile_video_link?.male : questionsByCategory?.mobile_video_link?.female
  const desktop_intro_video_link = bot_preference === "male" ? questionsByCategory?.desktop_intro_video_link?.male : questionsByCategory?.desktop_intro_video_link?.female
  const mobile_intro_video_link = bot_preference === "male" ? questionsByCategory?.mobile_intro_video_link?.male : questionsByCategory?.mobile_intro_video_link?.female
  const listening_timestamps = bot_preference === "male" ? questionsByCategory?.listening_timestamps?.male : questionsByCategory?.listening_timestamps?.female
  const questions_timestamps = bot_preference === "male" ? questionsByCategory?.questions_timestamps?.male : questionsByCategory?.questions_timestamps?.female
  const response_timestamps = bot_preference === "male" ? questionsByCategory?.response_timestamps?.male : questionsByCategory?.response_timestamps?.female
  const skip_timestamps = bot_preference === "male" ? questionsByCategory?.skip_timestamps?.male : questionsByCategory?.skip_timestamps?.female
  const skip_intro_videos = bot_preference === "male" ? questionsByCategory?.skip_intro_videos?.male : questionsByCategory?.skip_intro_videos?.female
  return { desktop_video_link, mobile_video_link, desktop_intro_video_link, mobile_intro_video_link, listening_timestamps, questions_timestamps, response_timestamps, skip_timestamps, skip_intro_videos }
}
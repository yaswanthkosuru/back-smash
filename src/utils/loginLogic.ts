import CategoryOrder from "../models/CategoryOrder";
import UserHistory from "../models/UserHistory";
import UserAnswers from "../models/UserAnswers";
import QuestionsByCategory from "../models/QuestionsByCategory";
import { getDataAccordingToPreference } from "./utils";
import { ObjectId } from "mongodb";

export const getNextCategory = async (userHistory: any, user: any, smash_user_id: string) => {
  try {
  const lastCategoryAccessed = userHistory?.last_category_accessed
  const allCategoriesAccessed = userHistory?.all_categories_accessed;
  console.log('allCategoriesAccessed', allCategoriesAccessed);
  const categoryOrder: any = await CategoryOrder.find()
  const order: any = categoryOrder[0]?.order
  let nextCategory: any = ""
  for (let i = 0; i < order.length; i++) {
    if (order[i].equals(lastCategoryAccessed)) {
      nextCategory = order[(i + 1) % order.length]
      break
    }
  }
  console.log('nextCategory', order.length);
  /** This means that the user has accessed all the categories and we want to only show the categories that were skipped by the user */
  if (allCategoriesAccessed.length === order.length) {
    console.log('no next category available... sending skipped questions');
    const skippedQuestionsData: any = getSkippedCategoryData(userHistory, user, smash_user_id)
    console.log('skippedQuestionsData', skippedQuestionsData);
    return skippedQuestionsData;
  }
  const isCategoryInHistory = userHistory?.all_categories_accessed.find((category: any) => category.category_id.equals(nextCategory))
  if (!isCategoryInHistory) {
    const updateAllCategoriesAccessed = await UserHistory.updateOne({ user_id: new ObjectId(user._id) }, {
      $push: {
        all_categories_accessed: {
          category_id: nextCategory,
          accessed_at: new Date(),
          is_skipped: false,
          skipped_attempt: 0,
          skipped_timestamps: []
        }
      }
    })
  } else {
    const accessTime = await UserHistory.updateOne({ user_id: new ObjectId(user._id), "all_categories_accessed.category_id": nextCategory }, {
      $set: {
        "all_categories_accessed.$.accessed_at": new Date()
      }
    })
  }
  const updateLastCategoryAccessed = await UserHistory.updateOne({ user_id: new ObjectId(user._id) }, {
    $set: {
      last_category_accessed: nextCategory
    },
  })

  const userAnswer = await UserAnswers.findOne({ user_id: new ObjectId(user._id), category_id: nextCategory })
  const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(nextCategory) })
  if (!userAnswer) {
    const details = []
    for (let i = 0; i < (questionsByCategory?.questions?.length ?? 0); i++) {
      details.push({
        question_id: questionsByCategory?.questions[i].question_id,
        is_skipped: false,
        answer_audio_link: null,
        answer_transcript: null,
        summary: '',
        keywords: [],
        answered_at: null
      })
    }
    const createUserAnswer = await UserAnswers.findOneAndUpdate({ smash_user_id, user_id: user._id, category_id: nextCategory }, {
      smash_user_id,
      user_id: user._id,
      category_id: nextCategory,
      attempt_date_time: new Date(),
      details: details
    }, { upsert: true, new: true })
    if (!createUserAnswer) {
      throw { success: false, message: "Failed to create user answer" }
      //return res.status(400).json({ success: false, message: "Failed to create user answer" })
    }
    return { ...questionsByCategory?.toJSON(), ...getDataAccordingToPreference(user?.bot_preference, questionsByCategory), interview_key: createUserAnswer?._id }
  }
    return { ...questionsByCategory?.toJSON(), ...getDataAccordingToPreference(user?.bot_preference, questionsByCategory), interview_key: userAnswer?._id }
    //return res.status(200).json({ success: true, message: "Login Successful", data: data })
    //return res.status(200).json({ success: true, message: "Login Successful", data: data })
  } catch (error) {
    throw error
  }
}

export const getSkippedCategoryData = async (userHistory: any, user: any, smash_user_id: string) => {
  let firstCategorySkipped: any = null
  for (let i = 0; i < (userHistory?.all_categories_accessed.length ?? 0); i++) {
    if (userHistory?.all_categories_accessed[i].is_skipped) {
      firstCategorySkipped = userHistory?.all_categories_accessed[i]
      break;
    }
  }
  if (!firstCategorySkipped) {
      const data = await getNextCategory(userHistory, user, smash_user_id);
      return data;
      //return res.status(200).json({ success: false, message: "No Category Skipped" });
  }
  const userAnswers = await UserAnswers.findOne({ user_id: new ObjectId(user._id), category_id: firstCategorySkipped.category_id })
  const skipped_questions = userAnswers?.skip_questions_ids || []
  const questionsByCategory = await QuestionsByCategory.findOne({ _id: new ObjectId(firstCategorySkipped.category_id) })
  const questions = questionsByCategory?.questions || []
  let questions_timestamps_updated = []
  let response_timestamps_updated = []
  let skip_timestamps_updated = []
  let question_data = []
  const { desktop_video_link, mobile_video_link, desktop_intro_video_link, mobile_intro_video_link, listening_timestamps, questions_timestamps, response_timestamps, skip_timestamps, skip_intro_videos } = getDataAccordingToPreference(user?.bot_preference, questionsByCategory)
  for (let i = 0; i < (questions?.length); i++) {
    if (skipped_questions.includes(questions[i].question_id)) {
      question_data.push(questions[i])
      questions_timestamps_updated.push(questions_timestamps[i])
      response_timestamps_updated.push(response_timestamps[i])
      skip_timestamps_updated.push(skip_timestamps[i])
    }
  }
  question_data.push(questions[questions.length - 1])
  questions_timestamps_updated.push(questions_timestamps[questions.length - 1])
  const intro_link = skip_intro_videos[Math.floor(Math.random() * skip_intro_videos.length)]
  return {
    ...questionsByCategory?.toJSON(),
    desktop_video_link,
    mobile_video_link,
    mobile_intro_video_link,
    listening_timestamps,
    questions_timestamps: questions_timestamps_updated,
    response_timestamps: response_timestamps_updated,
    skip_timestamps: skip_timestamps_updated,
    desktop_intro_video_link: intro_link,
    questions: question_data,
    interview_key: userAnswers?._id
  }
}
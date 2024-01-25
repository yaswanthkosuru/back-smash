import { Request, Response } from "express";
import QuestionsByCategory from "../models/QuestionsByCategory";
import User from "../models/User";
import UserAnswers from "../models/UserAnswers";
import UserHistory from "../models/UserHistory";

const getAllDetails = async (ids: [], pageSize = 10, pageNumber = 1) => {
  let allUsers: any
  if (ids.length > 0) {
    allUsers = await User.find({ smash_user_id: { $in: ids } })
  } else {
    const skip = (pageNumber - 1) * pageSize;
    allUsers = await User.find().limit(pageSize).skip(skip).exec();
  }

  const totalDocuments = await User.countDocuments();
  const allUserAnswers = await UserAnswers.find({});
  const allUserHistory = await UserHistory.find({});
  const questionsByCategory = await QuestionsByCategory.find({});
  const allUserDetails: any = allUsers.map((user: { smash_user_id?: any; bot_preference?: any; createdAt?: any; last_login?: any; name?: any; updatedAt?: any; _id?: any; }) => {
    const { _id } = user;
    const userAnswers = allUserAnswers.filter((answer: any) => answer.user_id.equals(_id));
    const userHistory = allUserHistory.filter((history: any) => history.user_id.equals(_id));
    const userAnswersObj = userAnswers.map((answers) => {
      const { category_id } = answers;
      const categoryData: any = questionsByCategory.filter((categoryData) => categoryData?._id.equals(category_id));
      const questionDetails = categoryData[0]?.questions.map((question: any) => {
        return {
          question: question?.question_text,
          id: question?.question_id
        }
      })

      return {
        attempt_number: answers?.attempt_number,
        attempt_date_time: answers?.attempt_date_time,
        answer_details: answers?.details,
        has_category_skipped: answers?.all_skipped,
        total_questions_answered: answers?.total_questions_answered,
        total_questions_skipped: answers?.total_questions_skipped,
        skip_question_ids: answers?.skip_questions_ids,
        createdAt: answers?.createdAt,
        updatedAt: answers?.updatedAt,
        questions_category: categoryData[0]?.category,
        question_details: questionDetails,
      }
    })

    const userHistoryObj = userHistory.map((history: any) => {
      const { last_category_accessed, all_categories_accessed } = history;
      const categoryData: any = questionsByCategory.filter((categoryData) => categoryData?._id.equals(last_category_accessed));
      const allCategoriesAccessedDetails = all_categories_accessed.map((allCategories: any) => {
        const { category_id, accessed_at, is_skipped, skipped_timestamps, skipped_attempt } = allCategories;
        const categoryDetails = questionsByCategory.filter((categoryData) => categoryData?._id.equals(category_id));
        return {
          category: categoryDetails[0]?.category,
          accessed_at,
          is_skipped,
          skipped_timestamps,
          skipped_attempt
        }
      });

      console.log('allCategoriesAccessed', allCategoriesAccessedDetails);

      return {
        last_category_accessed: categoryData[0].category,
        all_categories_accessed: allCategoriesAccessedDetails
      }
    })

    return {
      user_id: user?.smash_user_id,
      bot_preference: user?.bot_preference,
      created_at: user?.createdAt,
      last_login: user?.last_login,
      name: user?.name,
      lastUpdatedAt: user?.updatedAt,
      answers: userAnswersObj,
      history: userHistoryObj
    }
  })
  return { allUserDetails, totalDocuments }
}

/**
 * API to get paginated user results
 * @param req 
 * @param res 
 * @returns 
 */
const getAllUserDetails = async (req: Request, res: Response) => {
  try {
    const pageSize: any = req?.query?.limit! || '10';
    const pageNumber: any = req?.query?.pageNumber! || '1';

    const intPageSize = parseInt(pageSize, 10);
    const intPageNumber = parseInt(pageNumber, 10);

    if (intPageSize > 20) {
      return res.json({ success: false, message: 'You can retrieve 20 records at a time' });
    }

    const details = await getAllDetails([], intPageSize, intPageNumber);

    return res.json({ success: false, message: "User details fetched successfully", data: details.allUserDetails, totalDocuments: details.totalDocuments })
  } catch (err: any) {
    console.log(err.message)
    return res.json({ success: false, message: "Internal Server Error", error: err.message })
  }
}

/**
 * API to get user details by a single id
 * @param req 
 * @param res 
 * @returns 
 */
const getUserDetailsById = async (req: Request, res: Response) => {
  try {
    const smash_user_id = req?.params?.smash_user_id;
    const user = await User.findOne({ smash_user_id })
    const userAnswers = await UserAnswers.find({ smash_user_id })
    const userHistory = await UserHistory.find({ smash_user_id });
    const questionsByCategory = await QuestionsByCategory.find({});
    const userAnswersObj = userAnswers.map((answers) => {
      const { category_id } = answers;
      const categoryData: any = questionsByCategory.filter((categoryData) => categoryData?._id.equals(category_id));
      const questionDetails = categoryData[0]?.questions.map((question: any) => {
        return {
          question: question?.question_text,
          id: question?.question_id
        }
      })

      return {
        attempt_number: answers?.attempt_number,
        attempt_date_time: answers?.attempt_date_time,
        answer_details: answers?.details,
        has_category_skipped: answers?.all_skipped,
        total_questions_answered: answers?.total_questions_answered,
        total_questions_skipped: answers?.total_questions_skipped,
        skip_question_ids: answers?.skip_questions_ids,
        createdAt: answers?.createdAt,
        updatedAt: answers?.updatedAt,
        questions_category: categoryData[0]?.category,
        question_details: questionDetails,
      }
    })
    const userHistoryObj = userHistory.map((history: any) => {
      const { last_category_accessed, all_categories_accessed } = history;
      const categoryData: any = questionsByCategory.filter((categoryData) => categoryData?._id.equals(last_category_accessed));
      const allCategoriesAccessedDetails = all_categories_accessed.map((allCategories: any) => {
        const { category_id, accessed_at, is_skipped, skipped_timestamps, skipped_attempt } = allCategories;
        const categoryDetails = questionsByCategory.filter((categoryData) => categoryData?._id.equals(category_id));
        return {
          category: categoryDetails[0]?.category,
          accessed_at,
          is_skipped,
          skipped_timestamps,
          skipped_attempt
        }
      });

      return {
        last_category_accessed: categoryData[0].category,
        all_categories_accessed: allCategoriesAccessedDetails
      }
    })
    const details = {
      user_id: user?.smash_user_id,
      bot_preference: user?.bot_preference,
      created_at: user?.createdAt,
      last_login: user?.last_login,
      name: user?.name,
      lastUpdatedAt: user?.updatedAt,
      answers: userAnswersObj,
      history: userHistoryObj
    }
    return res.json({ success: true, message: "User details fetched successfully", data: details })
  } catch (err: any) {
    console.log('error', err.message)
    return res.json({ success: false, message: "Internal Server Error", error: err.message })
  }
}

/**
 * API to get user details by an array of Ids
 * @param req 
 * @param res 
 * @returns 
 */
const getUserDetailsByIds = async (req: Request, res: Response) => {
  try {
    const ids = req.body.ids
    const details = await getAllDetails(ids)
    return res.json({ success: false, message: "User details fetched successfully", data: details.allUserDetails, totalDocuments: details.totalDocuments })
  } catch (err: any) {
    console.log('error', err.message)
    return res.json({ success: false, message: "Internal Server Error", error: err.message })
  }
}

export default { getAllUserDetails, getUserDetailsById, getUserDetailsByIds };
import { Request, Response } from 'express';
import userController from '../src/controllers/userController';
import User from '../src/models/User';
import UserHistory from '../src/models/UserHistory';
import CategoryOrder from '../src/models/CategoryOrder';
import UserAnswers from '../src/models/UserAnswers';
import QuestionsByCategory from '../src/models/QuestionsByCategory';
import * as loginLogic from "../src/utils/loginLogic";
import { ObjectId } from 'mongodb';

jest.mock('openai', () => {
  const originalModule = jest.requireActual('openai'); // Import the actual module

  // Mock the OpenAI class constructor
  return jest.fn(({ apiKey }) => {
    // If apiKey is missing or empty, throw an error
    if (!apiKey) {
      throw new Error('The OPENAI_API_KEY environment variable is missing or empty');
    }

    // Otherwise, return the original OpenAI instance
    return new originalModule({ apiKey });
  });
});

jest.mock('@azure/storage-blob', () => {
  const originalModule = jest.requireActual('@azure/storage-blob'); // Import the actual module

  // Mock the StorageSharedKeyCredential class constructor
  return {
    ...originalModule,
    StorageSharedKeyCredential: jest.fn((account, accessKey) => {
      if (!account || !accessKey) {
        return {
          account: '1234',
          accessKey: '1234'
        }
      }

      // Return your own mock instance or whatever behavior you need
      return {
        account,
        accessKey,
      };
    }),
  };
});

// Mocking the dependencies (e.g., User and UserHistory models)
jest.mock('../src/models/User', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../src/models/UserHistory', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../src/models/CategoryOrder', () => ({
  find: jest.fn(),
}))

jest.mock('../src/models/QuestionsByCategory', () => ({
    findOne: jest.fn().mockResolvedValueOnce({
      questions: [{ question_id: '659d6618847671d66ed5e99d' }],
      // Add a toJSON method to the mock
      toJSON: jest.fn().mockReturnValue({
        questions: [{ question_id: '659d6618847671d66ed5e99d' }],
      }),
    } as any), // Add type assertion here
}))

jest.mock('../src/models/UserAnswers', () => ({
  findOneAndUpdate: jest.fn(),
}))

jest.mock('../src/utils/utils', () => ({
  getDataAccordingToPreference: jest.fn().mockReturnValueOnce({}),
}));

jest.mock('../src/utils/loginLogic', () => ({
  getSkippedCategoryData: jest.fn().mockReturnValueOnce({}),
  getNextCategory: jest.fn().mockReturnValueOnce({}),
}))

// Example test suite
describe('checkUserBotPreferenceAndEndStatus', () => {
  // Test case for a successful scenario
  it('should return success response with user bot preference and completion status', async () => {
    const req: any = { body: { smash_user_id: '1234' } };
    const res = {
      json: jest.fn(),
    } as unknown as Response;

    // Mocking the User model's findOne method
    const mockUser = {
      bot_preference: 'male',
    };
    const userFindOneMock = jest.fn().mockResolvedValue(mockUser);
    User.findOne = userFindOneMock

    // Mocking the UserHistory model's findOne method
    const mockUserHistory = {
      all_categories_accessed: [{ is_skipped: false }, { is_skipped: false }, { is_skipped: false }, { is_skipped: false }, { is_skipped: false }],
    };
    const userHistoryFindOneMock = jest.fn().mockResolvedValue(mockUserHistory);
    UserHistory.findOne = userHistoryFindOneMock

    await userController.checkUserBotPreferenceAndEndStatus(req, res);

    // Assertions
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Bot Preference found',
      data: mockUser.bot_preference,
      isCompleted: true,
    });
  });

  // Test case for a user not found scenario
  it('should return failure response for user not found', async () => {
    const req: any = { body: { smash_user_id: 'notExistingUserId' } };
    const res = {
      json: jest.fn(),
    } as unknown as Response;

    // Mocking the User model's findOne method to simulate no user found
    const userFindOneMock = jest.fn().mockResolvedValue(null);
    User.findOne = userFindOneMock;

    await userController.checkUserBotPreferenceAndEndStatus(req, res);

    // Assertions
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'User not found',
    });
  });

  // // Test case for bot preference not found scenario
  it('should return failure response for bot preference not found', async () => {
    const req: any = { body: { smash_user_id: '5678' } };
    const res = {
      json: jest.fn(),
    } as unknown as Response;

    // Mocking the User model's findOne method to simulate no bot preference found
    const userFindOneMock = jest.fn().mockResolvedValue({ bot_preference: null });
    User.findOne = userFindOneMock;

    await userController.checkUserBotPreferenceAndEndStatus(req, res);

    // Assertions
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Bot Preference not found',
    });
  });
});

describe('loginUser', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new user and return data on successful login', async () => {
    // Mock the findOne function to simulate a user not found
    const userFindOneMock = jest.fn().mockResolvedValue(null);
    User.findOne = userFindOneMock;

    // Mock the findOneAndUpdate function for User, UserAnswers, and UserHistory
    User.findOneAndUpdate = jest.fn().mockResolvedValueOnce({ _id: new ObjectId('659d6618847671d66ed5e99d') });
    UserAnswers.findOneAndUpdate = jest.fn().mockResolvedValueOnce({ _id: new ObjectId('659d6618847671d66ed5e99d') });
    UserHistory.findOneAndUpdate = jest.fn().mockResolvedValueOnce({ _id: new ObjectId('659d6618847671d66ed5e99d') });

    // Mock the find function for CategoryOrder
    CategoryOrder.find = jest.fn().mockResolvedValueOnce([{ order: ['659d6618847671d66ed5e99d'] }]);

    // Mock the findOne function for QuestionsByCategory
    QuestionsByCategory.findOne = jest.fn().mockResolvedValueOnce({
      question_id: '659d6618847671d66ed5e99d',
    });

    const req: any = { body: { name: 'TestUser', smash_user_id: 'testUserId', bot_preference: 'somePreference' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await userController.loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle an existing user with multiple login attempts', async () => {
    // Mock the findOne function to simulate an existing user
    User.findOne = jest.fn().mockResolvedValueOnce({ _id: new ObjectId('659d6618847671d66ed5e99d') });

    // Mock the updateOne function for UserHistory
    UserHistory.updateOne = jest.fn().mockResolvedValueOnce({});

    // Mock the findOne function for UserHistory
    UserHistory.findOne = jest.fn().mockResolvedValueOnce({
      login_timestamps: [new Date(), new Date(), new Date()],
    });

    const req: any = { body: { smash_user_id: 'existingUserId' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await userController.loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle an existing user with login attempts as a multiple of 3', async () => {
    // Mock the findOne function to simulate an existing user
    User.findOne = jest.fn().mockResolvedValueOnce({ _id: new ObjectId('659d6618847671d66ed5e99d') });

    // Mock the updateOne function for UserHistory
    UserHistory.updateOne = jest.fn().mockResolvedValueOnce({});

    // Mock the findOne function for UserHistory
    UserHistory.findOne = jest.fn().mockResolvedValueOnce({
      login_timestamps: [new Date(), new Date(), new Date()],
    });

    const req: any = { body: { smash_user_id: 'existingUserId' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await userController.loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    // Ensure that getSkippedCategoryData was called
    expect(loginLogic.getSkippedCategoryData).toHaveBeenCalled();
  });
})
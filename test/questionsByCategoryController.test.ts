// questionsByCategoryController.test.js
const request = require('supertest');
import { Response } from 'express';
import questionsByCategoryController from '../src/controllers/questionByCategoryController';
import QuestionsByCategory from '../src/models/QuestionsByCategory';

jest.mock('../src/models/QuestionsByCategory');

describe('createQuestionsByCategory', () => {
  it('should create questions by category successfully', async () => {
    // Mock the QuestionsByCategory.create method
    const mockCreate = jest.fn().mockResolvedValueOnce({
      _id: '659d6618847671d66ed5e99d',
      category: 'personal-demographic',
      desktop_video_link: 'desktopVideoLink',
      mobile_video_link: 'mobileVideoLink',
      timestamps: [1, 2, 3],
      listening_timestamp: 4,
      questions: ['question1', 'question2'],
    });
    QuestionsByCategory.create = mockCreate;

    // Mock the request and response objects
    const req: any = {
      body: {
        category: 'personal-demographic',
        desktop_video_link: 'desktopVideoLink',
        mobile_video_link: 'mobileVideoLink',
        timestamps: [1, 2, 3],
        listening_timestamp: 4,
        questions: ['question1', 'question2'],
      },
    };
    const res = { json: jest.fn() } as unknown as Response;

    // Call the function
    await questionsByCategoryController.createQuestionsByCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Questions by category created successfully',
      questionsByCategory: {
        _id: '659d6618847671d66ed5e99d',
        category: 'personal-demographic',
        desktop_video_link: 'desktopVideoLink',
        mobile_video_link: 'mobileVideoLink',
        timestamps: [1, 2, 3],
        listening_timestamp: 4,
        questions: ['question1', 'question2'],
      },
    });
  });

  it('should handle unable to create questions by category', async () => {
    // Mock the QuestionsByCategory.create method to simulate failure
    const mockCreate = jest.fn().mockResolvedValueOnce(null);
    QuestionsByCategory.create = mockCreate;

    // Mock the request and response objects
    const req: any = { body: {} };
    const res = { json: jest.fn() } as unknown as Response;

    // Call the function
    await questionsByCategoryController.createQuestionsByCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Unable to create questions by category',
    });
  });

  it('should handle internal server error', async () => {
    // Mock the QuestionsByCategory.create method to throw an error
    const mockCreate = jest.fn().mockRejectedValueOnce(new Error('Some error'));
    QuestionsByCategory.create = mockCreate;

    // Mock the request and response objects
    const req: any = { body: {} };
    const res = { json: jest.fn() } as unknown as Response;

    // Call the function
    await questionsByCategoryController.createQuestionsByCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      error: 'Some error',
    });
  });
});
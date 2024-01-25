const request = require('supertest');
import categoryOrderController from "../controllers/categoryOrderController";
import { ObjectId } from 'mongodb';
import CategoryOrder from "../models/CategoryOrder";
import { Response } from 'express';

jest.mock('../models/CategoryOrder');

describe('createCategoryOrder', () => {
  it('should create category order successfully', async () => {
    const sampleOrderId1 = "659d6618847671d66ed5e99d";
    const sampleOrderId2 = "659d6618847671d66ed5e99f"
     // Mock the CategoryOrder.create method
     const mockCreate = jest.fn().mockResolvedValueOnce({ _id: 'someId', order: [new ObjectId(sampleOrderId1), new ObjectId(sampleOrderId2)] });
     CategoryOrder.create = mockCreate;
 
     // Mock the request and response objects
     const req: any = { body: { order: [sampleOrderId1, sampleOrderId2] } }; // Use 'any' to make it compatible
     const res: Response = {
       json: jest.fn(),
     } as unknown as Response;
 
     // Call the function
     await categoryOrderController.createCategoryOrder(req, res);
 
     // Check if the response is as expected
     expect(res.json).toHaveBeenCalledWith({
       success: true,
       message: 'Category order created successfully',
       categoryOrder: { _id: 'someId', order: [new ObjectId(sampleOrderId1), new ObjectId(sampleOrderId2)] },
     });
   });

   it('should handle failure to create category order', async () => {
    const sampleOrderId1 = "659d6618847671d66ed5e99d";
    const sampleOrderId2 = "659d6618847671d66ed5e99f"
    // Mock the request and response objects
    const req: any = { body: { order: [new ObjectId(sampleOrderId1), new ObjectId(sampleOrderId2)] } };
    const res = {
      json: jest.fn(),
    } as unknown as Response;

    // Mock the CategoryOrder.create method to simulate failure
    const mockCreate = jest.fn().mockResolvedValueOnce(null);
    CategoryOrder.create = mockCreate;

    // Call the function
    await categoryOrderController.createCategoryOrder(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to create category order' });
  });
})

describe('appendQuestionCategory', () => {
  it('should append category successfully', async () => {
    const id = '659d6618847671d66ed5e99d';
    const category = 'personal-demographic';

    // Mock the CategoryOrder.findById method
    const mockFindById = jest.fn().mockResolvedValueOnce({ _id: id, order: ['learning-experience'] });
    CategoryOrder.findById = mockFindById;

    // Mock the CategoryOrder.findByIdAndUpdate method
    const mockUpdate = jest.fn().mockResolvedValueOnce({ _id: id, order: ['learning-experience', category] });
    CategoryOrder.findByIdAndUpdate = mockUpdate;

    // Mock the request and response objects
    const req: any = { params: { id }, body: { category } };
    const res: Response = { json: jest.fn() } as unknown as Response;

    // Call the function
    await categoryOrderController.appendQuestionCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Category appended successfully',
      append: { _id: id, order: ['learning-experience', category] },
    });
  });

  it('should handle category already exists in order', async () => {
    const id = '659d6618847671d66ed5e99d';
    const category = 'personal-demographic';

    // Mock the CategoryOrder.findById method
    const mockFindById = jest.fn().mockResolvedValueOnce({ _id: id, order: [category] });
    CategoryOrder.findById = mockFindById;

    // Mock the request and response objects
    const req: any = { params: { id }, body: { category } };
    const res: Response = { json: jest.fn() } as unknown as Response;

    // Call the function
    await categoryOrderController.appendQuestionCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Category already exists in order',
    });
  });

  it('should handle failed to find category order', async () => {
    const id = '1234';
    const category = 'newCategory';

    // Mock the CategoryOrder.findById method
    const mockFindById = jest.fn().mockResolvedValueOnce(null);
    CategoryOrder.findById = mockFindById;

    // Mock the request and response objects
    const req: any = { params: { id }, body: { category } };
    const res: Response = { json: jest.fn() } as unknown as Response;

    // Call the function
    await categoryOrderController.appendQuestionCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to find category order',
    });
  });

  it('should handle failed to append category', async () => {
    const id = '659d6618847671d66ed5e99d';
    const category = 'new-category';

    // Mock the CategoryOrder.findById method
    const mockFindById = jest.fn().mockResolvedValueOnce({ _id: id, order: [] });
    CategoryOrder.findById = mockFindById;

    // Mock the CategoryOrder.findByIdAndUpdate method to simulate failure
    const mockUpdate = jest.fn().mockResolvedValueOnce(null);
    CategoryOrder.findByIdAndUpdate = mockUpdate;

    // Mock the request and response objects
    const req: any = { params: { id }, body: { category } };
    const res: Response = { json: jest.fn() } as unknown as Response;

    // Call the function
    await categoryOrderController.appendQuestionCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to append category',
    });
  });

  it('should handle internal server error', async () => {
    const id = '659d6618847671d66ed5e99d';
    const category = 'new-category';

    // Mock the CategoryOrder.findById method to throw an error
    const mockFindById = jest.fn().mockRejectedValueOnce(new Error('Some error'));
    CategoryOrder.findById = mockFindById;

    // Mock the request and response objects
    const req: any = { params: { id }, body: { category } };
    const res: Response = { json: jest.fn() } as unknown as Response;

    // Call the function
    await categoryOrderController.appendQuestionCategory(req, res);

    // Check if the response is as expected
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      error: 'Some error',
    });
  });
});
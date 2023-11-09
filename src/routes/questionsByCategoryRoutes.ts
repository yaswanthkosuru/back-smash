import express, { Router } from 'express';
import questionsByCategoryController from '../controllers/questionByCategoryController';

const router: Router = express.Router();

router.post('/create', questionsByCategoryController.createQuestionsByCategory);

export default router;
import express, { Router } from 'express';
import categoryOrderController from '../controllers/categoryOrderController';

const router: Router = express.Router();

router.post('/create', categoryOrderController.createCategoryOrder);
router.put('/append/:id', categoryOrderController.appendQuestionCategory);

export default router;
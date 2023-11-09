import express, { Router } from 'express';
import userController from '../controllers/userController';
const router: Router = express.Router();

router.post('/login', userController.loginUser);

export default router;
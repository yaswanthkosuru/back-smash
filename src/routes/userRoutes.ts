import express, { Router } from 'express';
import userController from '../controllers/userController';
import fileUpload from 'express-fileupload';
const router: Router = express.Router();

router.post('/login', userController.loginUser);
router.post("/save/answer", fileUpload(), userController.saveAnswerRecordings)

export default router;
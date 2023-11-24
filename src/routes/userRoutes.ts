import express, { Router } from 'express';
import userController from '../controllers/userController';
import fileUpload from 'express-fileupload';
const router: Router = express.Router();

router.post('/login', userController.loginUser);
router.post("/answer/save", fileUpload(), userController.saveAnswerRecordings)
router.post("/answer/skip", userController.skipQuestion)

export default router;
import express, { Router } from 'express';
import userController from '../controllers/userController';
import fileUpload from 'express-fileupload';
const router: Router = express.Router();

router.post('/login', userController.loginUser);
router.post("/transcript", userController.getUserTranscript)
router.post("/answer/save", fileUpload(), userController.saveAnswerRecordings)
router.post("/answer/skip", userController.skipQuestion)
router.post("/answer/skip/all", userController.skipAllQuestions)
router.post("/answer/save/multiple-choice", userController.saveMultipleChoiceAnswer)

export default router;
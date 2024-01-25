import express, { Router } from 'express';
import fileUpload from 'express-fileupload';
import userController from '../controllers/userController';
import userDetailsController from '../controllers/userDetailsController';
const router: Router = express.Router();

router.post('/check', userController.checkUserBotPreferenceAndEndStatus)
router.post('/login', userController.loginUser);
router.post("/transcript", userController.getUserTranscript)
router.post("/answer/save", fileUpload(), userController.saveAnswerRecordings)
router.post("/answer/skip", userController.skipQuestion)
router.post("/answer/skip/all", userController.skipAllQuestions)

/** APIs to be consumed by Smash */
router.get('/details', userDetailsController.getAllUserDetails)
router.get('/details/:smash_user_id', userDetailsController.getUserDetailsById)
router.post('/details', userDetailsController.getUserDetailsByIds)


export default router;
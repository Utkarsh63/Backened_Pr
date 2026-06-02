import { Router } from "express";
import {registerUser , login, logoutUser, verifyEmail, refreshAccessToken, forgotPassword, resetForgotPassword, CurrentUser, changeCurrentPassword, resendEmailVerification} from "../controllers/auth.controllers.js";
import {validate} from "../middlewares/validator.middleware.js";
import {userChangeCurrentPasswordValidator, userForgotPasswordValidator, userRegisterValidator , userResetForgotPasswordValidator, userloginValidator } from "../validators/index.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";



const router = Router();

//unsecure routes
router.route("/register").post(userRegisterValidator(), validate ,registerUser);
router.route("/login").post(userloginValidator(),validate, login);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(userForgotPasswordValidator(), validate, forgotPassword);
router.route("/reset-password/:resetToken").post(userResetForgotPasswordValidator(), validate, resetForgotPassword);

//secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").post(verifyJWT, CurrentUser);
router.route("/change-password").post(verifyJWT, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword);
router.route("/resend-email-verification").post(verifyJWT, resendEmailVerification);

export default router;
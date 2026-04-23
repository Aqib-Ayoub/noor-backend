import { Router } from 'express';
import { sendOtp, verifyOtp, completeRegistration, adminLogin } from '../modules/auth/auth.controller';

/** Authentication router — all routes are public (no auth required) */
const authRouter = Router();

/** POST /api/auth/send-otp — send a mock OTP to the given phone number */
authRouter.post('/send-otp', sendOtp);

/** POST /api/auth/verify-otp — verify OTP; returns isNewUser flag */
authRouter.post('/verify-otp', verifyOtp);

/** POST /api/auth/complete-registration — new users submit name & city after OTP */
authRouter.post('/complete-registration', completeRegistration);

/** POST /api/auth/admin-login — SuperAdmin email/password login */
authRouter.post('/admin-login', adminLogin);

export default authRouter;

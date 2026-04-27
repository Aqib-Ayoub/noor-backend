import { Router } from 'express';
import { getMe, getMasjidContext, getPaymentHistory } from '../controllers/user.controller';
import { authenticate } from '../../../middlewares/auth.middleware';

const userRouter = Router();

/** All user routes require a valid JWT */
userRouter.use(authenticate);

/** GET /api/user/me — returns authenticated user's profile */
userRouter.get('/me', getMe);

/** GET /api/user/masjid-context — returns hub screen context based on role */
userRouter.get('/masjid-context', getMasjidContext);

/** GET /api/user/payment-history — returns user's monthly payments */
userRouter.get('/payment-history', getPaymentHistory);

export default userRouter;

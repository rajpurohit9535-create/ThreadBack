import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rate-limit';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter(15, 60 * 1000), AuthController.register);
authRouter.post('/login', authRateLimiter(15, 60 * 1000), AuthController.login);
authRouter.get('/me', requireAuth, AuthController.me);
authRouter.get('/dev-users', AuthController.listDevUsers);
authRouter.post('/dev-switch', AuthController.devSwitch);

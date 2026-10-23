import { Router } from 'express';
import { AiController } from '../controllers/ai.controller';

export const aiRouter = Router();

aiRouter.post('/chat', AiController.handleChat);
aiRouter.post('/sidequest/chat', AiController.handleSidequestChat);
aiRouter.get('/status', AiController.handleStatus);

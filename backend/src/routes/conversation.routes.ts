import { Router } from 'express';
import { MissionController } from '../controllers/mission.controller';

export const conversationRouter = Router();

conversationRouter.get('/:id/messages', MissionController.getConversationMessages);
conversationRouter.post('/:id/return-to-mission', MissionController.returnToMission);
conversationRouter.post('/:id/share', MissionController.toggleShareConversation);

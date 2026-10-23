import { Router } from 'express';
import { aiRouter } from './ai.routes';
import { missionRouter } from './mission.routes';
import { conversationRouter } from './conversation.routes';
import { authRouter } from './auth.routes';
import { teamRouter, inviteRouter } from './team.routes';
import { projectRouter } from './project.routes';
import githubRouter from './github.routes';
import { AiController } from '../controllers/ai.controller';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', AiController.handleHealth);

// Projects
apiRouter.use('/projects', projectRouter);

// GitHub & Repository Analysis (Phase 2)
apiRouter.use('/github', githubRouter);

// Authentication
apiRouter.use('/auth', authRouter);

// Teams
apiRouter.use('/teams', teamRouter);

// Public invites
apiRouter.use('/invites', inviteRouter);

// AI subroutes
apiRouter.use('/ai', aiRouter);

// Mission operations
apiRouter.use('/missions', missionRouter);

// Conversation operations
apiRouter.use('/conversations', conversationRouter);

import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';

export const projectRouter = Router();

projectRouter.get('/github/status', ProjectController.getGitHubStatus);
projectRouter.get('/', optionalAuth, ProjectController.listProjects);
projectRouter.post('/', optionalAuth, ProjectController.createProject);
projectRouter.get('/:id', optionalAuth, ProjectController.getProject);
projectRouter.patch('/:id', requireAuth, ProjectController.updateProject);
projectRouter.delete('/:id', requireAuth, ProjectController.deleteProject);

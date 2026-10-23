import { Router } from 'express';
import { githubController } from '../controllers/github.controller';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// GitHub Connection & Repositories (Authenticated)
router.post('/connect', requireAuth, githubController.connect);
router.get('/status', requireAuth, githubController.getStatus);
router.get('/repos', requireAuth, githubController.getRepositories);
router.post('/disconnect', requireAuth, githubController.disconnect);
router.post('/simulate-revocation', requireAuth, githubController.triggerRevocation);

// Repository Code & Architecture Analysis (Public / Authenticated)
router.post('/analyze', optionalAuth, githubController.analyze);
router.get('/analyze', optionalAuth, githubController.analyze);

// Decision Drift Detection against Context (Public / Authenticated)
router.post('/drift-analysis', optionalAuth, githubController.driftAnalysis);
router.get('/drift-analysis', optionalAuth, githubController.driftAnalysis);

// Project & Analysis Feedback (Public / Authenticated)
router.post('/feedback', optionalAuth, githubController.createFeedback);
router.get('/feedback', optionalAuth, githubController.listFeedback);

export default router;

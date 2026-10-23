import { Router } from 'express';
import { MissionController } from '../controllers/mission.controller';
import { requireAuth } from '../middleware/auth';

export const missionRouter = Router();

missionRouter.post('/', MissionController.createMission);
missionRouter.get('/', MissionController.listMissions);
missionRouter.get('/:id', MissionController.getMission);
missionRouter.post('/:id/sidequests', MissionController.createSideQuest);

// Shared decisions
missionRouter.get('/:id/decisions', MissionController.listDecisions);
missionRouter.post('/:id/decisions', MissionController.addDecision);
missionRouter.delete('/:id/decisions/:decisionId', MissionController.deleteDecision);

// Account claim & share with team
missionRouter.post('/:id/claim', requireAuth, MissionController.claimMission);
missionRouter.post('/:id/share-with-team', requireAuth, MissionController.shareWithTeam);

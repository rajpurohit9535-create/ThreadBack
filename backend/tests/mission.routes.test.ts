import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Mission and Conversation REST Endpoints', () => {
  it('POST /api/missions creates a mission and main conversation', async () => {
    const res = await request(app)
      .post('/api/missions')
      .send({ objective: 'Build a Go CRUD API' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('mission');
    expect(res.body.mission).toHaveProperty('id');
    expect(res.body.mission.objective).toBe('Build a Go CRUD API');
    expect(res.body.mission.status).toBe('active');

    expect(res.body).toHaveProperty('mainConversation');
    expect(res.body.mainConversation.type).toBe('main');
    expect(res.body.mainConversation.missionId).toBe(res.body.mission.id);
  });

  it('POST /api/missions rejects empty objective with 400', async () => {
    const res = await request(app)
      .post('/api/missions')
      .send({ objective: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('GET /api/missions lists missions', async () => {
    const res = await request(app).get('/api/missions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('missions');
    expect(Array.isArray(res.body.missions)).toBe(true);
  });

  it('GET /api/missions/:id retrieves a mission and its conversations', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({ objective: 'Build a Go CRUD API' });

    const missionId = createRes.body.mission.id;

    const res = await request(app).get(`/api/missions/${missionId}`);
    expect(res.status).toBe(200);
    expect(res.body.mission.id).toBe(missionId);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0]?.type).toBe('main');
  });

  it('GET /api/missions/:id returns 404 for nonexistent mission', async () => {
    const res = await request(app).get('/api/missions/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/missions/:id returns 400 for invalid UUID format', async () => {
    const res = await request(app).get('/api/missions/not-a-valid-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST /api/missions/:id/sidequests creates a SideQuest linked to the mission', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({ objective: 'Build a Go CRUD API' });

    const missionId = createRes.body.mission.id;

    const res = await request(app)
      .post(`/api/missions/${missionId}/sidequests`)
      .send({ topic: 'Middleware in Go' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sideQuest');
    expect(res.body.sideQuest.missionId).toBe(missionId);
    expect(res.body.sideQuest.type).toBe('sidequest');
    expect(res.body.sideQuest.topic).toBe('Middleware in Go');

    // Verify it appears in mission conversations
    const getRes = await request(app).get(`/api/missions/${missionId}`);
    expect(getRes.body.conversations).toHaveLength(2);
  });

  it('POST /api/missions/:id/sidequests returns 404 for nonexistent mission', async () => {
    const res = await request(app)
      .post('/api/missions/00000000-0000-0000-0000-000000000000/sidequests')
      .send({ topic: 'Middleware' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/conversations/:id/messages returns messages chronologically', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({ objective: 'Build a Go CRUD API' });

    const conversationId = createRes.body.mainConversation.id;

    const res = await request(app).get(`/api/conversations/${conversationId}/messages`);
    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe(conversationId);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages).toHaveLength(0);
  });
});

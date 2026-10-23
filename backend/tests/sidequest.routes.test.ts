import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('POST /api/ai/sidequest/chat Integration Tests', () => {
  it('returns 400 INVALID_REQUEST on empty payload', async () => {
    const res = await request(app).post('/api/ai/sidequest/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toBe('The request body is invalid.');
  });

  it('returns 400 when sideQuestTopic is missing', async () => {
    const res = await request(app)
      .post('/api/ai/sidequest/chat')
      .send({
        missionObjective: 'Build a Go CRUD API',
        messages: [{ role: 'user', content: 'What is middleware?' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when final message has assistant role', async () => {
    const res = await request(app)
      .post('/api/ai/sidequest/chat')
      .send({
        missionObjective: 'Build a Go CRUD API',
        sideQuestTopic: 'Middleware in Go',
        messages: [
          { role: 'user', content: 'What is middleware?' },
          { role: 'assistant', content: 'It wraps HTTP handlers.' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when missionObjective is empty string', async () => {
    const res = await request(app)
      .post('/api/ai/sidequest/chat')
      .send({
        missionObjective: '   ',
        sideQuestTopic: 'Middleware in Go',
        messages: [{ role: 'user', content: 'What is middleware?' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns consistent error envelope without exposing secrets', async () => {
    const res = await request(app)
      .post('/api/ai/sidequest/chat')
      .send({ invalid: 'data' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(JSON.stringify(res.body)).not.toContain('AIza');
  });

  it('POST /api/ai/sidequest/chat returns 404 when conversationId does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/sidequest/chat')
      .send({
        conversationId: '00000000-0000-0000-0000-000000000000',
        message: 'Hello',
      });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/ai/sidequest/chat returns 400 for invalid conversationId format', async () => {
    const res = await request(app)
      .post('/api/ai/sidequest/chat')
      .send({
        conversationId: 'not-a-valid-uuid',
        message: 'Hello',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });
});

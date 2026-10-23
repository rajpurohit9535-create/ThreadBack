import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('HTTP Routes Integration Tests', () => {
  it('GET /api/health returns 200 OK with timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/ai/status returns non-sensitive configuration status', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('configured');
    expect(typeof res.body.configured).toBe('boolean');
    expect(res.body).toHaveProperty('model');
    expect(typeof res.body.model).toBe('string');
    // Ensure no secret or key is present
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body).not.toHaveProperty('geminiApiKey');
    expect(JSON.stringify(res.body)).not.toContain('AIza');
  });

  it('POST /api/ai/chat returns 400 INVALID_REQUEST on empty body', async () => {
    const res = await request(app).post('/api/ai/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toBe('The request body is invalid.');
  });

  it('POST /api/ai/chat returns 400 when final message is assistant role', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({
        missionObjective: 'Build a Go CRUD API',
        messages: [
          { role: 'user', content: 'What is middleware in Go?' },
          { role: 'assistant', content: 'Middleware intercepts requests.' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST /api/ai/chat returns 404 when conversationId does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({
        conversationId: '00000000-0000-0000-0000-000000000000',
        message: 'Hello',
      });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/ai/chat returns 400 for invalid conversationId format', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({
        conversationId: 'not-a-valid-uuid',
        message: 'Hello',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 NOT_FOUND for unknown routes with consistent error shape', async () => {
    const res = await request(app).get('/api/unknown-endpoint-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });
});

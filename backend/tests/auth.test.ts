import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Authentication REST Endpoints', () => {
  const uniqueEmail = `test-${Date.now()}@example.com`;

  it('POST /api/auth/register registers a new user with hashed password and token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        name: 'Alice Developer',
        password: 'supersecretpassword123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(uniqueEmail);
    expect(res.body.user.name).toBe('Alice Developer');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /api/auth/register rejects duplicate email with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        name: 'Alice Duplicate',
        password: 'anotherpassword',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already exists');
  });

  it('POST /api/auth/register validates short password and invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        name: '',
        password: '123',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'supersecretpassword123',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(uniqueEmail);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/auth/login rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me returns current user and teams when authenticated', async () => {
    // 1. Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'supersecretpassword123',
      });

    const token = loginRes.body.token;

    // 2. Query /me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(uniqueEmail);
    expect(Array.isArray(meRes.body.teams)).toBe(true);
  });

  it('GET /api/auth/me rejects missing or invalid token with 401', async () => {
    const noTokenRes = await request(app).get('/api/auth/me');
    expect(noTokenRes.status).toBe(401);

    const badTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-string');
    expect(badTokenRes.status).toBe(401);
  });
});

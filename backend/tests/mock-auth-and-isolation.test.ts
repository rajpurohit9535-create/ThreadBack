import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Mock Authentication, Data Isolation and Dev Switcher Tests', () => {
  const ts = Date.now();
  const userAEmail = `usera-${ts}@threadback.io`;
  const userBEmail = `userb-${ts}@threadback.io`;
  const userCEmail = `userc-${ts}@threadback.io`;

  let userAToken: string;
  let userAId: string;

  let userBToken: string;
  let userBId: string;

  let userCToken: string;
  let userCId: string;

  let userAPersonalMissionId: string;
  let userAMainConvId: string;

  let teamId: string;
  let teamMissionId: string;
  let inviteToken: string;

  // =========================================================================
  // 1. Fresh Account Initialization & Isolation
  // =========================================================================
  it('Fresh user registers and starts with 0 missions and 0 decisions', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: userAEmail,
        name: 'User Alpha',
        password: 'password123',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body).toHaveProperty('user');
    expect(regRes.body.user.email).toBe(userAEmail);
    expect(regRes.body.user.name).toBe('User Alpha');
    expect(regRes.body).toHaveProperty('token');

    userAToken = regRes.body.token;
    userAId = regRes.body.user.id;

    // Verify fresh account starts with completely empty workspace
    const listRes = await request(app)
      .get('/api/missions')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.missions).toHaveLength(0);
  });

  it('Rejects duplicate email registration with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: userAEmail,
        name: 'Duplicate Alpha',
        password: 'anotherpassword',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already exists');
  });

  it('Login rejects invalid password and succeeds with valid credentials', async () => {
    // Bad password
    const badRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: userAEmail,
        password: 'wrongpassword',
      });
    expect(badRes.status).toBe(401);

    // Good password
    const goodRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: userAEmail,
        password: 'password123',
      });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.user.id).toBe(userAId);
    expect(goodRes.body).toHaveProperty('token');
  });

  it('Session restoration: GET /api/auth/me returns current user and teams', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(userAId);
    expect(meRes.body.user.email).toBe(userAEmail);
    expect(Array.isArray(meRes.body.teams)).toBe(true);
  });

  // =========================================================================
  // 2. Personal Mission Isolation between Two Users
  // =========================================================================
  it('User A creates a personal mission', async () => {
    const res = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        objective: 'User A Private Architectural Exploration',
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.userId).toBe(userAId);
    expect(res.body.mission.teamId).toBeNull();
    expect(res.body.mission.visibility).toBe('personal');

    userAPersonalMissionId = res.body.mission.id;
    userAMainConvId = res.body.mainConversation.id;
  });

  it('User B registers fresh: sees 0 missions and cannot access User A private mission', async () => {
    // Register User B
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: userBEmail,
        name: 'User Beta',
        password: 'password456',
      });

    expect(regRes.status).toBe(201);
    userBToken = regRes.body.token;
    userBId = regRes.body.user.id;

    // User B's mission list must be completely empty
    const listRes = await request(app)
      .get('/api/missions')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.missions).toHaveLength(0);

    // User B attempting to access User A's mission must be 403 Forbidden
    const getRes = await request(app)
      .get(`/api/missions/${userAPersonalMissionId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('FORBIDDEN');
  });

  // =========================================================================
  // 3. Team Invitations without Fake Account Creation
  // =========================================================================
  it('User A creates a team and invites an unregistered email (no fake account is created)', async () => {
    // Create team
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Alpha Core Team' });

    expect(teamRes.status).toBe(201);
    teamId = teamRes.body.team.id;

    // Create shared mission in team
    const missionRes = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        objective: 'Shared Team Concurrency Pipeline',
        teamId,
      });

    expect(missionRes.status).toBe(201);
    teamMissionId = missionRes.body.mission.id;

    // Invite User B by email
    const inviteRes = await request(app)
      .post(`/api/teams/${teamId}/invites`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        role: 'member',
        email: userBEmail,
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body).toHaveProperty('inviteToken');
    inviteToken = inviteRes.body.inviteToken;

    // Inviting an unregistered email address must NOT create a fake account in users table
    const unregisteredEmail = `ghost-${Date.now()}@unregistered.test`;
    await request(app)
      .post(`/api/teams/${teamId}/invites`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        role: 'member',
        email: unregisteredEmail,
      });

    // Check login fails for the unregistered email
    const ghostLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: unregisteredEmail,
        password: 'anypassword',
      });

    expect(ghostLogin.status).toBe(401);
  });

  it('User B accepts the invitation and accesses the shared mission', async () => {
    // Before accepting, User B cannot access the team mission
    const beforeRes = await request(app)
      .get(`/api/missions/${teamMissionId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(beforeRes.status).toBe(403);

    // User B accepts invite
    const acceptRes = await request(app)
      .post(`/api/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.team.id).toBe(teamId);

    // Now User B can access the team mission
    const afterRes = await request(app)
      .get(`/api/missions/${teamMissionId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(afterRes.status).toBe(200);
    expect(afterRes.body.mission.id).toBe(teamMissionId);

    // User B can list team missions
    const teamMissionsRes = await request(app)
      .get(`/api/missions?teamId=${teamId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(teamMissionsRes.status).toBe(200);
    expect(teamMissionsRes.body.missions).toHaveLength(1);
  });

  it('Outsider User C is blocked from accessing the team mission (403 Forbidden)', async () => {
    // Register User C
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: userCEmail,
        name: 'User Charlie',
        password: 'password789',
      });

    userCToken = regRes.body.token;
    userCId = regRes.body.user.id;

    // Access blocked
    const res = await request(app)
      .get(`/api/missions/${teamMissionId}`)
      .set('Authorization', `Bearer ${userCToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // =========================================================================
  // 4. Developer Mock User Switcher Endpoint
  // =========================================================================
  it('GET /api/auth/dev-users lists registered mock accounts', async () => {
    const res = await request(app).get('/api/auth/dev-users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);

    const userIds = res.body.users.map((u: any) => u.id);
    expect(userIds).toContain(userAId);
    expect(userIds).toContain(userBId);
    expect(userIds).toContain(userCId);
  });

  it('POST /api/auth/dev-switch switches token to target mock user', async () => {
    // Switch to User A
    const switchResA = await request(app)
      .post('/api/auth/dev-switch')
      .send({ userId: userAId });

    expect(switchResA.status).toBe(200);
    expect(switchResA.body.user.id).toBe(userAId);
    expect(switchResA.body.user.email).toBe(userAEmail);
    expect(switchResA.body).toHaveProperty('token');

    // Use returned token to access User A data
    const verifyA = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${switchResA.body.token}`);

    expect(verifyA.status).toBe(200);
    expect(verifyA.body.user.id).toBe(userAId);

    // Switch to User B
    const switchResB = await request(app)
      .post('/api/auth/dev-switch')
      .send({ userId: userBId });

    expect(switchResB.status).toBe(200);
    expect(switchResB.body.user.id).toBe(userBId);

    // Invalid userId returns 404
    const notFoundRes = await request(app)
      .post('/api/auth/dev-switch')
      .send({ userId: '00000000-0000-0000-0000-000000000000' });

    expect(notFoundRes.status).toBe(404);
  });
});

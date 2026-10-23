import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Teams, Multi-User Sharing and Authorization Tests', () => {
  const ts = Date.now();
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let user3Token: string;
  let user3Id: string;

  let teamId: string;
  let teamMissionId: string;
  let personalMissionId: string;

  it('Setup: registers 3 distinct users', async () => {
    // User 1
    const r1 = await request(app).post('/api/auth/register').send({
      email: `user1-${ts}@threadback.test`,
      name: 'Alice Team Lead',
      password: 'password123',
    });
    expect(r1.status).toBe(201);
    user1Token = r1.body.token;
    user1Id = r1.body.user.id;

    // User 2
    const r2 = await request(app).post('/api/auth/register').send({
      email: `user2-${ts}@threadback.test`,
      name: 'Bob Teammate',
      password: 'password123',
    });
    expect(r2.status).toBe(201);
    user2Token = r2.body.token;
    user2Id = r2.body.user.id;

    // User 3 (Unrelated outsider)
    const r3 = await request(app).post('/api/auth/register').send({
      email: `user3-${ts}@threadback.test`,
      name: 'Eve Outsider',
      password: 'password123',
    });
    expect(r3.status).toBe(201);
    user3Token = r3.body.token;
    user3Id = r3.body.user.id;
  });

  it('User 1 creates a team with name', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Core Engineering' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('team');
    expect(res.body.team.name).toBe('Core Engineering');
    expect(res.body.membership.role).toBe('owner');
    teamId = res.body.team.id;
  });

  it('User 1 generates an invite link token for the team', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/invites`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('invitation');
    expect(res.body).toHaveProperty('inviteToken');

    const token = res.body.inviteToken;

    // Public endpoint allows viewing invite details
    const publicRes = await request(app).get(`/api/invites/${token}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.invitation.teamName).toBe('Core Engineering');

    // User 2 accepts the invite
    const acceptRes = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.message).toContain('joined');
  });

  it('Both User 1 and User 2 see team membership', async () => {
    const res = await request(app)
      .get(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    const emails = res.body.members.map((m: any) => m.userEmail);
    expect(emails).toContain(`user1-${ts}@threadback.test`);
    expect(emails).toContain(`user2-${ts}@threadback.test`);
  });

  it('User 1 creates a shared team mission', async () => {
    const res = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        objective: 'Implement OAuth2 and Team Workspaces',
        teamId,
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.teamId).toBe(teamId);
    expect(res.body.mission.visibility).toBe('team');
    teamMissionId = res.body.mission.id;
  });

  it('User 2 can open the shared mission and add an approved decision with attribution', async () => {
    // User 2 opens the mission
    const getRes = await request(app)
      .get(`/api/missions/${teamMissionId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.mission.id).toBe(teamMissionId);

    // User 2 adds an approved decision
    const decRes = await request(app)
      .post(`/api/missions/${teamMissionId}/decisions`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        decision: 'Use PKCE for public OAuth clients',
        category: 'decision',
      });

    expect(decRes.status).toBe(201);
    expect(decRes.body.decision.contributedBy).toBe(user2Id);
    expect(decRes.body.decision.contributorName).toBe('Bob Teammate');
    expect(decRes.body.decision.createdAt).toBeDefined();

    // User 1 sees the decision contributed by User 2
    const decListRes = await request(app)
      .get(`/api/missions/${teamMissionId}/decisions`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(decListRes.status).toBe(200);
    expect(decListRes.body.decisions).toHaveLength(1);
    expect(decListRes.body.decisions[0].contributorName).toBe('Bob Teammate');
    expect(decListRes.body.decisions[0].decision).toBe('Use PKCE for public OAuth clients');
  });

  it('Unrelated User 3 is denied access to the team mission (403 Forbidden)', async () => {
    // User 3 attempts to view team mission
    const viewRes = await request(app)
      .get(`/api/missions/${teamMissionId}`)
      .set('Authorization', `Bearer ${user3Token}`);

    expect(viewRes.status).toBe(403);
    expect(viewRes.body.error.code).toBe('FORBIDDEN');

    // User 3 attempts to create a sidequest on team mission
    const sqRes = await request(app)
      .post(`/api/missions/${teamMissionId}/sidequests`)
      .set('Authorization', `Bearer ${user3Token}`)
      .send({ topic: 'Hacking tokens' });

    expect(sqRes.status).toBe(403);

    // User 3 attempts to access team details
    const teamRes = await request(app)
      .get(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${user3Token}`);

    expect(teamRes.status).toBe(403);
  });

  it('Personal mission isolation: User 1 creates personal mission; teammates cannot access it', async () => {
    const res = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        objective: 'Alice Private Salary Notes',
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.teamId).toBeNull();
    personalMissionId = res.body.mission.id;

    // User 2 (teammate) attempts to access Alice's personal mission
    const teammateRes = await request(app)
      .get(`/api/missions/${personalMissionId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(teammateRes.status).toBe(403);
    expect(teammateRes.body.error.code).toBe('FORBIDDEN');
  });

  it('User 2 leaves the team', async () => {
    const leaveRes = await request(app)
      .post(`/api/teams/${teamId}/leave`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.success).toBe(true);

    // User 2 is no longer in team
    const checkRes = await request(app)
      .get(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(checkRes.status).toBe(403);
  });
});

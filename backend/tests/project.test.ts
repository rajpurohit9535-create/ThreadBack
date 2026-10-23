import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Project Setup and Canvas Board Integration Tests', () => {
  const ts = Date.now();
  const ownerEmail = `project-owner-${ts}@threadback.io`;
  const memberEmail = `project-member-${ts}@threadback.io`;
  const outsiderEmail = `project-outsider-${ts}@threadback.io`;

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let teamId: string;
  let projectId: string;
  let projectMissionId: string;
  let generatedInviteToken: string;

  it('Registers accounts for project testing', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: ownerEmail,
      name: 'Project Owner',
      password: 'password123',
    });
    expect(ownerRes.status).toBe(201);
    ownerToken = ownerRes.body.token;

    const memberRes = await request(app).post('/api/auth/register').send({
      email: memberEmail,
      name: 'Project Member',
      password: 'password123',
    });
    expect(memberRes.status).toBe(201);
    memberToken = memberRes.body.token;

    const outsiderRes = await request(app).post('/api/auth/register').send({
      email: outsiderEmail,
      name: 'Outsider User',
      password: 'password123',
    });
    expect(outsiderRes.status).toBe(201);
    outsiderToken = outsiderRes.body.token;
  });

  it('Creates a team for the project', async () => {
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Alpha Engineering Team' });

    expect(teamRes.status).toBe(201);
    teamId = teamRes.body.team.id;
  });

  it('Rejects project creation when name is empty', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: '   ',
        description: 'Empty name project',
      });

    expect(res.status).toBe(400);
  });

  it('Creates a project with invitations and associates with team', async () => {
    const invitedEmail = `colleague-${ts}@example.test`;
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Auth Microservice Redesign',
        description: 'Migrating legacy monolith auth to modern Go microservice',
        teamId,
        githubRepo: 'org/auth-service',
        invitations: [
          { email: memberEmail, role: 'member' },
          { email: invitedEmail, role: 'member' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.project).toBeDefined();
    expect(res.body.project.name).toBe('Auth Microservice Redesign');
    expect(res.body.project.teamId).toBe(teamId);
    expect(res.body.project.githubRepo).toBe('org/auth-service');
    expect(res.body.invitations).toHaveLength(2);

    projectId = res.body.project.id;
    generatedInviteToken = res.body.invitations[0].token;
  });

  it('Lists projects for authorized team members and creators', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it('Member accepts invitation and gains access to the project', async () => {
    const acceptRes = await request(app)
      .post(`/api/invites/${generatedInviteToken}/accept`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(acceptRes.status).toBe(200);

    const projectRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(projectRes.status).toBe(200);
    expect(projectRes.body.project.id).toBe(projectId);
  });

  it('Outsider is blocked from accessing the team project (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('Creates a mission linked to the project and verifies filtering', async () => {
    const missionRes = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        objective: 'Implement OAuth2 PKCE handler in Go',
        teamId,
        projectId,
        visibility: 'team',
      });

    expect(missionRes.status).toBe(201);
    expect(missionRes.body.mission.projectId).toBe(projectId);
    projectMissionId = missionRes.body.mission.id;

    // Filter missions by projectId
    const listRes = await request(app)
      .get(`/api/missions?projectId=${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.missions).toHaveLength(1);
    expect(listRes.body.missions[0].id).toBe(projectMissionId);
  });

  it('GitHub status endpoint honestly reports configuration state', async () => {
    const res = await request(app).get('/api/projects/github/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('configured');
    expect(res.body).toHaveProperty('status');
    expect(res.body.repositories).toEqual([]);
    expect(typeof res.body.message).toBe('string');
  });
});

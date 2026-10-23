import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Project GitHub Repository URL Integration Tests', () => {
  const ts = Date.now();
  const userEmail = `repo-user-${ts}@threadback.io`;
  let userToken: string;

  let projectAId: string;
  let projectBId: string;
  let projectNoRepoId: string;

  const urlA = 'https://github.com/codecrafters-io/build-your-own-x';
  const urlB = 'https://github.com/facebook/react';

  it('Registers a test user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: userEmail,
      name: 'Repo Tester',
      password: 'Password123!',
    });
    expect(res.status).toBe(201);
    userToken = res.body.token;
  });

  it('Creates Project A with repository URL A', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Project Alpha (Build Your Own X)',
        description: 'First project testing repository URL association',
        githubRepo: urlA,
      });

    expect(res.status).toBe(201);
    expect(res.body.project).toBeDefined();
    expect(res.body.project.githubRepo).toBe(urlA);
    projectAId = res.body.project.id;
  });

  it('Confirms saved Project A retains repository URL A', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectAId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.githubRepo).toBe(urlA);
  });

  it('Creates Project B with repository URL B', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Project Beta (React)',
        description: 'Second project with separate repository URL',
        githubRepo: urlB,
      });

    expect(res.status).toBe(201);
    expect(res.body.project).toBeDefined();
    expect(res.body.project.githubRepo).toBe(urlB);
    projectBId = res.body.project.id;
  });

  it('Switches between projects and confirms each retains its own repository URL', async () => {
    const resA = await request(app)
      .get(`/api/projects/${projectAId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(resA.status).toBe(200);
    expect(resA.body.project.githubRepo).toBe(urlA);

    const resB = await request(app)
      .get(`/api/projects/${projectBId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(resB.status).toBe(200);
    expect(resB.body.project.githubRepo).toBe(urlB);

    // Verify list projects contains both with distinct URLs
    const listRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.status).toBe(200);
    const pA = listRes.body.projects.find((p: any) => p.id === projectAId);
    const pB = listRes.body.projects.find((p: any) => p.id === projectBId);
    expect(pA.githubRepo).toBe(urlA);
    expect(pB.githubRepo).toBe(urlB);
  });

  it('Runs repository analysis on Project A using projectId and confirms it analyzes URL A', async () => {
    const res = await request(app)
      .post('/api/github/analyze')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        projectId: projectAId,
      });

    expect(res.status).toBe(200);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.repository.fullName).toBe('codecrafters-io/build-your-own-x');
    expect(res.body.report.repository.url).toBe(urlA);
  });

  it('Creates a project without a repository URL and confirms it works', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Project Gamma (No Repo)',
        description: 'Project without GitHub repository',
      });

    expect(res.status).toBe(201);
    expect(res.body.project.githubRepo).toBeNull();
    projectNoRepoId = res.body.project.id;

    // Fetch and confirm
    const getRes = await request(app)
      .get(`/api/projects/${projectNoRepoId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.project.githubRepo).toBeNull();
  });

  it('Rejects malformed repository URLs safely with 400 Bad Request', async () => {
    // Non-github domain
    const badDomain = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Bad Domain Project',
        githubRepo: 'https://gitlab.com/owner/repo',
      });
    expect(badDomain.status).toBe(400);

    // Incomplete URL
    const incomplete = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Incomplete Repo',
        githubRepo: 'not-a-repo',
      });
    expect(incomplete.status).toBe(400);

    // Invalid characters
    const invalidChars = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Invalid Chars',
        githubRepo: 'https://github.com/owner/repo<script>',
      });
    expect(invalidChars.status).toBe(400);
  });

  it('Returns honest 400 when analyzing a project without a repository and without repo param', async () => {
    const res = await request(app)
      .post('/api/github/analyze')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        projectId: projectNoRepoId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Repository URL is required');
  });

  it('Allows updating the repository URL on an existing project', async () => {
    const updateRes = await request(app)
      .patch(`/api/projects/${projectNoRepoId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        githubRepo: 'https://github.com/vuejs/core',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.project.githubRepo).toBe('https://github.com/vuejs/core');
  });
});

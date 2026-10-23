import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { getDatabase } from '../src/db/database';

describe('Phase 2: Secure GitHub Connection & Repository Selection', () => {
  const ts = Date.now();

  async function createRegisteredUser(email: string, name: string) {
    const res = await request(app).post('/api/auth/register').send({
      email,
      name,
      password: 'password123',
    });
    return { user: res.body.user, token: res.body.token };
  }


  it('connects GitHub securely, encrypts token at rest, and never exposes credentials in response', async () => {
    const dev = await createRegisteredUser(`dev-${ts}@threadback.io`, 'Dev Engineer');

    const connectRes = await request(app)
      .post('/api/github/connect')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({
        accessToken: 'gho_secret_token_1234567890abcdef',
        accountId: `github_user_${ts}`,
        accountLogin: 'octocat',
        accountType: 'user',
        scope: 'repo,read:user',
      });

    expect(connectRes.status).toBe(200);
    const conn = connectRes.body.connection;
    expect(conn.accountLogin).toBe('octocat');
    expect(conn.status).toBe('active');

    // CRITICAL SECURITY ASSERTION: Never expose credentials or encrypted tokens to frontend
    expect(conn.accessToken).toBeUndefined();
    expect(conn.encryptedAccessToken).toBeUndefined();
    expect(conn.tokenIv).toBeUndefined();
    expect(conn.tokenTag).toBeUndefined();

    // Verify token is encrypted in SQLite
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM github_connections WHERE user_id = ?').get(dev.user.id) as any;
    expect(row).toBeDefined();
    expect(row.encrypted_access_token).not.toBe('gho_secret_token_1234567890abcdef');
    expect(row.token_iv).toBeDefined();
    expect(row.token_tag).toBeDefined();
  });

  it('retrieves sanitized connection status', async () => {
    const dev = await createRegisteredUser(`status-${ts}@threadback.io`, 'Status User');

    // Before connecting
    const emptyRes = await request(app)
      .get('/api/github/status')
      .set('Authorization', `Bearer ${dev.token}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.connected).toBe(false);

    // Connect
    await request(app)
      .post('/api/github/connect')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({
        accessToken: 'mock_gh_token_777',
        accountId: `acc_${ts}`,
        accountLogin: 'threadback-org',
      });

    // After connecting
    const connectedRes = await request(app)
      .get('/api/github/status')
      .set('Authorization', `Bearer ${dev.token}`);
    expect(connectedRes.status).toBe(200);
    expect(connectedRes.body.connected).toBe(true);
    expect(connectedRes.body.connection.accountLogin).toBe('threadback-org');
    expect(connectedRes.body.connection.accessToken).toBeUndefined();
  });

  it('allows user to select from authorized repositories', async () => {
    const dev = await createRegisteredUser(`repos-${ts}@threadback.io`, 'Repo User');

    await request(app)
      .post('/api/github/connect')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({
        accessToken: 'test_gho_valid_token_abc',
        accountId: `acc_repos_${ts}`,
        accountLogin: 'testdev',
      });

    const reposRes = await request(app)
      .get('/api/github/repos')
      .set('Authorization', `Bearer ${dev.token}`);

    expect(reposRes.status).toBe(200);
    expect(Array.isArray(reposRes.body.repositories)).toBe(true);
    expect(reposRes.body.repositories.length).toBeGreaterThanOrEqual(1);

    const firstRepo = reposRes.body.repositories[0];
    expect(firstRepo).toHaveProperty('name');
    expect(firstRepo).toHaveProperty('fullName');
    expect(firstRepo).toHaveProperty('defaultBranch');
    expect(firstRepo).toHaveProperty('isPrivate');
  });

  it('handles simulated revocation and blocks subsequent repository queries', async () => {
    const dev = await createRegisteredUser(`revoke-${ts}@threadback.io`, 'Revoke User');

    await request(app)
      .post('/api/github/connect')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({
        accessToken: 'test_token_will_revoke',
        accountId: `acc_revoke_${ts}`,
        accountLogin: 'revokeme',
      });

    // Trigger revocation
    const revokeRes = await request(app)
      .post('/api/github/simulate-revocation')
      .set('Authorization', `Bearer ${dev.token}`);
    expect(revokeRes.status).toBe(200);

    // Querying repos should now yield 403 Forbidden
    const reposRes = await request(app)
      .get('/api/github/repos')
      .set('Authorization', `Bearer ${dev.token}`);
    expect(reposRes.status).toBe(403);
    const errText = typeof reposRes.body.error === 'object' ? reposRes.body.error.message : reposRes.body.error;
    expect(errText).toMatch(/revoked/i);
  });


  it('supports explicit disconnect and purges active connection', async () => {
    const dev = await createRegisteredUser(`dc-${ts}@threadback.io`, 'Disconnect User');

    await request(app)
      .post('/api/github/connect')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({
        accessToken: 'mock_token_to_disconnect',
        accountId: `acc_dc_${ts}`,
        accountLogin: 'dcorig',
      });

    const dcRes = await request(app)
      .post('/api/github/disconnect')
      .set('Authorization', `Bearer ${dev.token}`);
    expect(dcRes.status).toBe(200);
    expect(dcRes.body.success).toBe(true);

    const statusRes = await request(app)
      .get('/api/github/status')
      .set('Authorization', `Bearer ${dev.token}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.connected).toBe(false);
  });

  it('submits and retrieves feedback for a project or repository analysis', async () => {
    const dev = await createRegisteredUser(`fb-${ts}@threadback.io`, 'Feedback User');

    const createFbRes = await request(app)
      .post('/api/github/feedback')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({
        targetType: 'repo_analysis',
        targetId: 'codecrafters-io/build-your-own-x',
        rating: 5,
        comment: 'Exceptional architectural breakdown and SideQuest guidance!',
      });

    expect(createFbRes.status).toBe(201);
    expect(createFbRes.body.feedback).toBeDefined();
    expect(createFbRes.body.feedback.rating).toBe(5);
    expect(createFbRes.body.feedback.userName).toBe('Feedback User');

    const listRes = await request(app)
      .get('/api/github/feedback?targetType=repo_analysis&targetId=codecrafters-io/build-your-own-x');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.feedback)).toBe(true);
    expect(listRes.body.feedback.length).toBeGreaterThanOrEqual(1);
  });
});

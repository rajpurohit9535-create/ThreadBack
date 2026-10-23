import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { parseGitHubRepoIdentifier, repoAnalysisService } from '../src/services/repo-analysis.service';

describe('Repository Code & Architecture Analysis', () => {
  it('correctly parses various GitHub URL and identifier formats', () => {
    expect(parseGitHubRepoIdentifier('https://github.com/codecrafters-io/build-your-own-x')).toEqual({
      owner: 'codecrafters-io',
      repo: 'build-your-own-x',
    });

    expect(parseGitHubRepoIdentifier('codecrafters-io/build-your-own-x')).toEqual({
      owner: 'codecrafters-io',
      repo: 'build-your-own-x',
    });

    expect(parseGitHubRepoIdentifier('https://github.com/codecrafters-io/build-your-own-x.git')).toEqual({
      owner: 'codecrafters-io',
      repo: 'build-your-own-x',
    });
  });

  it('analyzes codecrafters-io/build-your-own-x and extracts comprehensive architectural report', async () => {
    const report = await repoAnalysisService.analyzeRepository('https://github.com/codecrafters-io/build-your-own-x');

    expect(report).toBeDefined();
    expect(report.repository.fullName).toBe('codecrafters-io/build-your-own-x');
    expect(report.repository.name).toBe('build-your-own-x');
    expect(report.repository.stars).toBeGreaterThan(100000);
    expect(report.repository.defaultBranch).toBeDefined();

    // Verify commit association
    expect(report.latestCommit).toBeDefined();
    expect(report.latestCommit.sha).toBeDefined();
    expect(report.latestCommit.sha.length).toBeGreaterThan(5);

    // Verify file and architectural breakdown
    expect(report.fileSummary.topLevelCount).toBeGreaterThan(0);
    expect(report.fileSummary.items.some((i) => i.includes('README.md'))).toBe(true);
    expect(report.architecturalOverview).toBeDefined();
    expect(report.keyCategoriesOrModules.length).toBeGreaterThan(5);

    // Verify ThreadBack Engineering recommendations
    expect(report.threadBackEngineeringInsights.recommendedSideQuests.length).toBeGreaterThan(0);
  });

  it('exposes repository analysis via HTTP endpoint /api/github/analyze', async () => {
    const res = await request(app)
      .post('/api/github/analyze')
      .send({ repo: 'https://github.com/codecrafters-io/build-your-own-x' });

    expect(res.status).toBe(200);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.repository.fullName).toBe('codecrafters-io/build-your-own-x');
  });

  it('returns 400 when repository input is missing or malformed', async () => {
    const res = await request(app).post('/api/github/analyze').send({});
    expect(res.status).toBe(400);

    const badFormatRes = await request(app).post('/api/github/analyze').send({ repo: 'not-a-repo' });
    expect(badFormatRes.status).toBe(400);
  });
});

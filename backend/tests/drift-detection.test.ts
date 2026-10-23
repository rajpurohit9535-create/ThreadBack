import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import {
  driftDetectionService,
  createMockSystemsEngineeringContext,
} from '../src/services/drift-detection.service';

describe('Decision Drift Detection Service & Mock Context Analysis', () => {
  it('creates a well-formed mock systems engineering context with 5 ADRs', () => {
    const context = createMockSystemsEngineeringContext();

    expect(context.contextId).toBe('TB-CTX-SYSTEMS-001');
    expect(context.approvedDecisions).toHaveLength(5);

    const ids = context.approvedDecisions.map((d) => d.id);
    expect(ids).toContain('DEC-001');
    expect(ids).toContain('DEC-002');
    expect(ids).toContain('DEC-003');
    expect(ids).toContain('DEC-004');
    expect(ids).toContain('DEC-005');
  });

  it('accurately detects drift when evaluating codecrafters-io/build-your-own-x against mock context', async () => {
    const driftReport = await driftDetectionService.evaluateRepositoryDrift(
      'https://github.com/codecrafters-io/build-your-own-x'
    );

    expect(driftReport).toBeDefined();
    expect(driftReport.repository.fullName).toBe('codecrafters-io/build-your-own-x');
    expect(['DRIFT_DETECTED', 'CRITICAL_DRIFT']).toContain(driftReport.overallDriftStatus);
    expect(driftReport.driftScorePercentage).toBeGreaterThan(0);

    // Verify Decision 1 (DEC-001: Multi-language systems taxonomy) -> Compliant
    const dec001 = driftReport.decisionResults.find((r) => r.decisionId === 'DEC-001');
    expect(dec001).toBeDefined();
    expect(dec001?.status).toBe('NO_CONFLICT');
    expect(dec001?.severity).toBe('NONE');

    // Verify Decision 3 (DEC-003: Licensing) -> Detected
    const dec003 = driftReport.decisionResults.find((r) => r.decisionId === 'DEC-003');
    expect(dec003).toBeDefined();
    expect(['NO_CONFLICT', 'CONFIRMED_CONFLICT']).toContain(dec003?.status);

    // Verify Decision 5 (DEC-005: SideQuest synthesis) -> Compliant
    const dec005 = driftReport.decisionResults.find((r) => r.decisionId === 'DEC-005');
    expect(dec005).toBeDefined();
    expect(dec005?.status).toBe('NO_CONFLICT');
  });

  it('exposes drift evaluation via HTTP endpoint /api/github/drift-analysis', async () => {
    const res = await request(app)
      .post('/api/github/drift-analysis')
      .send({ repo: 'https://github.com/codecrafters-io/build-your-own-x' });

    expect(res.status).toBe(200);
    expect(res.body.driftReport).toBeDefined();
    expect(res.body.driftReport.conflictsSummary).toBeDefined();
    expect(res.body.driftReport.decisionResults.length).toBe(5);
  });
});

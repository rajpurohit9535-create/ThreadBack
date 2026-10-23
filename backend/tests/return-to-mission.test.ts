import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReturnToMissionService } from '../src/services/return-to-mission.service';
import { GenerateGemmaParams } from '../src/lib/gemma-client';
import {
  initDatabase,
  closeDatabase,
  missionRepository,
  conversationRepository,
  messageRepository,
  memoryRepository,
} from '../src/db';
import { SideQuestLearningSummary } from '../src/schemas/return-to-mission.schema';

describe('ReturnToMissionService (Unit & Boundary Tests)', () => {
  let missionId: string;
  let mainConvId: string;
  let sideQuestId: string;

  beforeEach(() => {
    closeDatabase();
    initDatabase(':memory:');

    const created = missionRepository.createMissionWithMainConversation('Build a Go CRUD API');
    missionId = created.mission.id;
    mainConvId = created.mainConversation.id;

    const sq = conversationRepository.createSideQuestConversation(missionId, 'Middleware in Go');
    sideQuestId = sq.id;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('generates and persists a valid learning summary from SideQuest history', async () => {
    messageRepository.createMessage(sideQuestId, 'user', 'What is middleware in Go?');
    messageRepository.createMessage(
      sideQuestId,
      'assistant',
      'In Go, middleware is a function that wraps an http.Handler. For example, func Logging(next http.Handler) http.Handler.'
    );
    messageRepository.createMessage(sideQuestId, 'user', 'Should we use standard net/http handlers?');
    messageRepository.createMessage(
      sideQuestId,
      'assistant',
      'Yes, adhering to standard net/http http.Handler ensures broad compatibility across packages.'
    );

    const validSummary: SideQuestLearningSummary = {
      topic: 'Middleware in Go',
      keyLearnings: [
        'Middleware wraps http.Handler using closures.',
        'Standard library net/http handlers maximize ecosystem compatibility.',
      ],
      decisions: ['Standardize on http.Handler for all route middleware.'],
      usefulExamples: ['func Logging(next http.Handler) http.Handler'],
      unresolvedQuestions: ['How should panic recovery be handled across goroutines?'],
      missionRelevance: 'Allows structured request logging and auth for the Go CRUD API.',
    };

    let capturedParams: GenerateGemmaParams | null = null;
    const stubGenerateFn = vi.fn(async (params: GenerateGemmaParams): Promise<string> => {
      capturedParams = params;
      return JSON.stringify(validSummary);
    });

    const service = new ReturnToMissionService(stubGenerateFn, 'gemma-4-26b-a4b-it');
    const result = await service.returnToMission(sideQuestId);

    expect(result.summary).toEqual(validSummary);
    expect(result.missionId).toBe(missionId);
    expect(result.mainConversationId).toBe(mainConvId);
    expect(result.sideQuestConversationId).toBe(sideQuestId);

    // Verify stored in sidequest_memories
    const stored = memoryRepository.getSideQuestStructuredSummary(sideQuestId);
    expect(stored).not.toBeNull();
    expect(stored?.topic).toBe('Middleware in Go');
    expect(stored?.decisions).toContain('Standardize on http.Handler for all route middleware.');

    // Verify mission memory was updated with decisions
    const missionMem = memoryRepository.getMissionMemory(missionId);
    expect(missionMem).not.toBeNull();
    expect(missionMem?.decisions).toContain('Standardize on http.Handler for all route middleware.');

    // Verify Gemma prompt received transcript
    expect(capturedParams?.contents[0]?.parts[0]?.text).toContain('What is middleware in Go?');
  });

  it('handles empty SideQuest history gracefully without calling AI provider', async () => {
    const stubGenerateFn = vi.fn();
    const service = new ReturnToMissionService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    const result = await service.returnToMission(sideQuestId);

    expect(stubGenerateFn).not.toHaveBeenCalled();
    expect(result.summary.topic).toBe('Middleware in Go');
    expect(result.summary.keyLearnings[0]).toContain('No messages were exchanged');
    expect(result.summary.decisions).toEqual([]);

    const stored = memoryRepository.getSideQuestStructuredSummary(sideQuestId);
    expect(stored?.keyLearnings[0]).toContain('No messages were exchanged');
  });

  it('handles insufficient SideQuest history when AI notes lack of technical depth', async () => {
    messageRepository.createMessage(sideQuestId, 'user', 'Hi');
    messageRepository.createMessage(sideQuestId, 'assistant', 'Hello! What would you like to explore about middleware?');

    const insufficientSummary: SideQuestLearningSummary = {
      topic: 'Middleware in Go',
      keyLearnings: ['Conversation was brief and insufficient to establish key technical learnings.'],
      decisions: [],
      usefulExamples: [],
      unresolvedQuestions: ['What specific middleware patterns are needed?'],
      missionRelevance: 'Exploration was initiated on middleware, but no architecture was finalized.',
    };

    const stubGenerateFn = vi.fn(async () => JSON.stringify(insufficientSummary));
    const service = new ReturnToMissionService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    const result = await service.returnToMission(sideQuestId);
    expect(result.summary.keyLearnings[0]).toContain('insufficient');
  });

  it('rejects nonexistent conversationId with 404', async () => {
    const service = new ReturnToMissionService(vi.fn(), 'gemma-4-26b-a4b-it');
    await expect(
      service.returnToMission('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(/not found/i);
  });

  it('rejects Main conversation ID with 400', async () => {
    const service = new ReturnToMissionService(vi.fn(), 'gemma-4-26b-a4b-it');
    await expect(
      service.returnToMission(mainConvId)
    ).rejects.toThrow(/is a Main conversation, not a SideQuest/i);
  });

  it('does not save summary when provider fails', async () => {
    messageRepository.createMessage(sideQuestId, 'user', 'Explain middleware');

    const stubGenerateFn = vi.fn(async () => {
      throw new Error('Gemma provider timeout');
    });
    const service = new ReturnToMissionService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    await expect(service.returnToMission(sideQuestId)).rejects.toThrow(/provider error/i);

    // Assert nothing was saved
    const stored = memoryRepository.getSideQuestMemory(sideQuestId);
    expect(stored).toBeNull();
  });

  it('does not save invalid summary when provider outputs malformed JSON', async () => {
    messageRepository.createMessage(sideQuestId, 'user', 'Explain middleware');

    const stubGenerateFn = vi.fn(async () => 'This is not JSON at all! { missing braces');
    const service = new ReturnToMissionService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    await expect(service.returnToMission(sideQuestId)).rejects.toThrow(/malformed or invalid/i);

    const stored = memoryRepository.getSideQuestMemory(sideQuestId);
    expect(stored).toBeNull();
  });

  it('handles repeated Return to Mission requests safely without duplicate records or decisions', async () => {
    messageRepository.createMessage(sideQuestId, 'user', 'Explain middleware');
    messageRepository.createMessage(sideQuestId, 'assistant', 'Middleware wraps handlers.');

    const summary: SideQuestLearningSummary = {
      topic: 'Middleware in Go',
      keyLearnings: ['Middleware wraps http.Handler.'],
      decisions: ['Use standard net/http.'],
      usefulExamples: [],
      unresolvedQuestions: [],
      missionRelevance: 'Relevant to API.',
    };

    const stubGenerateFn = vi.fn(async () => JSON.stringify(summary));
    const service = new ReturnToMissionService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    // First call
    const res1 = await service.returnToMission(sideQuestId);
    expect(res1.summary.topic).toBe('Middleware in Go');

    // Second call (repeated)
    const res2 = await service.returnToMission(sideQuestId);
    expect(res2.summary.topic).toBe('Middleware in Go');

    // Check decisions in mission memory are not duplicated
    const missionMem = memoryRepository.getMissionMemory(missionId);
    expect(missionMem?.decisions).toEqual(['Use standard net/http.']);
  });

  it('preserves existing useful mission memory information when merging decisions', () => {
    memoryRepository.upsertMissionMemory({
      missionId,
      summary: 'Established Go CRUD repository layout.',
      progress: '40% complete',
      decisions: ['Use PostgreSQL as primary DB'],
      blockers: ['Awaiting schema confirmation'],
      nextStep: 'Implement routes',
    });

    // Merge new decisions from SideQuest
    const updated = memoryRepository.mergeDecisionsIntoMissionMemory(
      missionId,
      ['Use Chi router for URL params'],
      'Fallback summary'
    );

    // Verify existing useful fields are preserved
    expect(updated.summary).toBe('Established Go CRUD repository layout.');
    expect(updated.progress).toBe('40% complete');
    expect(updated.blockers).toEqual(['Awaiting schema confirmation']);
    expect(updated.nextStep).toBe('Implement routes');

    // Verify decisions list contains both decisions deduplicated
    expect(updated.decisions).toContain('Use PostgreSQL as primary DB');
    expect(updated.decisions).toContain('Use Chi router for URL params');
    expect(updated.decisions).toHaveLength(2);
  });
});

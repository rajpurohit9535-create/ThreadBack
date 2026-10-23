import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../src/db/schema';
import { MissionRepository } from '../src/db/repositories/mission.repo';
import { ConversationRepository } from '../src/db/repositories/conversation.repo';
import { MessageRepository } from '../src/db/repositories/message.repo';
import { MemoryRepository } from '../src/db/repositories/memory.repo';
import fs from 'fs';
import path from 'path';

describe('SQLite Database & Repositories Unit Tests', () => {
  let db: Database.Database;
  let missionRepo: MissionRepository;
  let convRepo: ConversationRepository;
  let msgRepo: MessageRepository;
  let memRepo: MemoryRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);

    const getDb = () => db;
    missionRepo = new MissionRepository(getDb);
    convRepo = new ConversationRepository(getDb);
    msgRepo = new MessageRepository(getDb);
    memRepo = new MemoryRepository(getDb);
  });

  afterEach(() => {
    db.close();
  });

  it('creates mission and main conversation in an atomic transaction', () => {
    const result = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');
    expect(result.mission.id).toBeDefined();
    expect(result.mission.objective).toBe('Build a Go CRUD API');
    expect(result.mission.status).toBe('active');

    expect(result.mainConversation.id).toBeDefined();
    expect(result.mainConversation.missionId).toBe(result.mission.id);
    expect(result.mainConversation.type).toBe('main');
    expect(result.mainConversation.topic).toBeNull();
  });

  it('enforces foreign-key constraints when inserting conversation with invalid mission_id', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO conversations (id, mission_id, type, topic, created_at, updated_at)
        VALUES ('conv-1', 'nonexistent-mission', 'main', NULL, datetime('now'), datetime('now'))
      `).run();
    }).toThrow();
  });

  it('enforces uniqueness constraint of exactly one main conversation per mission', () => {
    const { mission } = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');

    // Attempt to insert a second main conversation for the same mission
    expect(() => {
      db.prepare(`
        INSERT INTO conversations (id, mission_id, type, topic, created_at, updated_at)
        VALUES ('conv-duplicate', ?, 'main', NULL, datetime('now'), datetime('now'))
      `).run(mission.id);
    }).toThrow();
  });

  it('rolls back transaction on related-write failure', () => {
    expect(() => {
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO missions (id, objective, status, created_at, updated_at)
          VALUES ('m-fail', 'Fail Test', 'active', datetime('now'), datetime('now'))
        `).run();

        // Deliberate constraint violation to trigger rollback
        throw new Error('Simulated failure during related write');
      });
      tx();
    }).toThrow('Simulated failure during related write');

    const mission = missionRepo.getMissionById('m-fail');
    expect(mission).toBeNull();
  });

  it('creates SideQuest associated with mission and retrieves conversations', () => {
    const { mission, mainConversation } = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');

    const sideQuest = convRepo.createSideQuestConversation(mission.id, 'Middleware in Go');
    expect(sideQuest.id).toBeDefined();
    expect(sideQuest.missionId).toBe(mission.id);
    expect(sideQuest.type).toBe('sidequest');
    expect(sideQuest.topic).toBe('Middleware in Go');

    const missionData = missionRepo.getMissionWithConversations(mission.id);
    expect(missionData).not.toBeNull();
    expect(missionData?.conversations).toHaveLength(2);
    expect(missionData?.conversations[0]?.id).toBe(mainConversation.id);
    expect(missionData?.conversations[1]?.id).toBe(sideQuest.id);
  });

  it('persists messages and retrieves them in chronological order', () => {
    const { mainConversation } = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');

    const msg1 = msgRepo.createMessage(mainConversation.id, 'user', 'What is middleware?');
    const msg2 = msgRepo.createMessage(mainConversation.id, 'assistant', 'Middleware wraps handlers.');
    const msg3 = msgRepo.createMessage(mainConversation.id, 'user', 'How do I log requests?');

    const messages = msgRepo.getMessagesByConversationId(mainConversation.id);
    expect(messages).toHaveLength(3);
    expect(messages[0]?.id).toBe(msg1.id);
    expect(messages[1]?.id).toBe(msg2.id);
    expect(messages[2]?.id).toBe(msg3.id);
  });

  it('limits recent context messages to requested window size while maintaining chronological order', () => {
    const { mainConversation } = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');

    for (let i = 1; i <= 10; i++) {
      msgRepo.createMessage(mainConversation.id, i % 2 === 1 ? 'user' : 'assistant', `Message ${i}`);
    }

    const window = msgRepo.getRecentContextMessages(mainConversation.id, 4);
    expect(window).toHaveLength(4);
    expect(window[0]?.content).toBe('Message 7');
    expect(window[1]?.content).toBe('Message 8');
    expect(window[2]?.content).toBe('Message 9');
    expect(window[3]?.content).toBe('Message 10');
  });

  it('keeps Main AI and SideQuest messages strictly separate', () => {
    const { mission, mainConversation } = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');
    const sideQuest = convRepo.createSideQuestConversation(mission.id, 'Go Interfaces');

    msgRepo.createMessage(mainConversation.id, 'user', 'Main mission step 1');
    msgRepo.createMessage(sideQuest.id, 'user', 'Sidequest question 1');

    const mainMsgs = msgRepo.getMessagesByConversationId(mainConversation.id);
    const sideMsgs = msgRepo.getMessagesByConversationId(sideQuest.id);

    expect(mainMsgs).toHaveLength(1);
    expect(mainMsgs[0]?.content).toBe('Main mission step 1');

    expect(sideMsgs).toHaveLength(1);
    expect(sideMsgs[0]?.content).toBe('Sidequest question 1');
  });

  it('persists memories with uniqueness constraints', () => {
    const { mission } = missionRepo.createMissionWithMainConversation('Build a Go CRUD API');

    const mem1 = memRepo.upsertMissionMemory({
      missionId: mission.id,
      summary: 'Initial architecture established',
      progress: '50%',
      decisions: ['Use Gin framework', 'PostgreSQL DB'],
      blockers: [],
      nextStep: 'Setup router',
    });

    expect(mem1.summary).toBe('Initial architecture established');
    expect(mem1.decisions).toContain('Use Gin framework');

    // Update memory
    const mem2 = memRepo.upsertMissionMemory({
      missionId: mission.id,
      summary: 'Updated architecture',
      progress: '70%',
      decisions: ['Use Gin framework', 'Switch to SQLite'],
      blockers: ['Awaiting specs'],
      nextStep: 'Write tests',
    });

    expect(mem2.id).toBe(mem1.id); // Same ID due to upsert
    expect(mem2.summary).toBe('Updated architecture');
    expect(mem2.blockers).toContain('Awaiting specs');

    const fetched = memRepo.getMissionMemory(mission.id);
    expect(fetched?.summary).toBe('Updated architecture');
  });

  it('persists data across database reconnection (restart simulation)', () => {
    const tempDir = path.resolve(__dirname, '..', 'data', 'test-scratch');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempDbPath = path.join(tempDir, `test-restart-${Date.now()}.db`);

    try {
      // 1. Initial connection: create data
      let testDb = new Database(tempDbPath);
      testDb.pragma('foreign_keys = ON');
      initializeSchema(testDb);

      const repo1 = new MissionRepository(() => testDb);
      const msgRepo1 = new MessageRepository(() => testDb);

      const { mission, mainConversation } = repo1.createMissionWithMainConversation('Persistent Mission');
      msgRepo1.createMessage(mainConversation.id, 'user', 'Preserved across restarts');

      testDb.close();

      // 2. Reinitialize connection (simulating server restart)
      testDb = new Database(tempDbPath);
      testDb.pragma('foreign_keys = ON');
      initializeSchema(testDb);

      const repo2 = new MissionRepository(() => testDb);
      const msgRepo2 = new MessageRepository(() => testDb);

      const retrievedMission = repo2.getMissionById(mission.id);
      expect(retrievedMission).not.toBeNull();
      expect(retrievedMission?.objective).toBe('Persistent Mission');

      const retrievedMessages = msgRepo2.getMessagesByConversationId(mainConversation.id);
      expect(retrievedMessages).toHaveLength(1);
      expect(retrievedMessages[0]?.content).toBe('Preserved across restarts');

      testDb.close();
    } finally {
      // Clean up scratch file
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
      if (fs.existsSync(`${tempDbPath}-wal`)) {
        fs.unlinkSync(`${tempDbPath}-wal`);
      }
      if (fs.existsSync(`${tempDbPath}-shm`)) {
        fs.unlinkSync(`${tempDbPath}-shm`);
      }
    }
  });
});

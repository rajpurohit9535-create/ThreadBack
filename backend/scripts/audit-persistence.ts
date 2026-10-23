import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import {
  initDatabase,
  closeDatabase,
  getDatabase,
  resolveDefaultDbPath,
  DEFAULT_DB_PATH,
} from '../src/db/database';
import { missionRepository } from '../src/db/repositories/mission.repo';
import { conversationRepository } from '../src/db/repositories/conversation.repo';
import { messageRepository } from '../src/db/repositories/message.repo';
import { memoryRepository } from '../src/db/repositories/memory.repo';
import { mainAiService } from '../src/services/main-ai.service';
import { sideQuestService } from '../src/services/sidequest.service';
import { returnToMissionService } from '../src/services/return-to-mission.service';

async function runAudit() {
  console.log('=== THREADBACK SQLite Connection & Persistence Comprehensive Audit ===\n');

  // =========================================================================
  // 1. Audit Canonical Path Resolution & Shared Instances
  // =========================================================================
  console.log('1. Auditing Canonical Database Path & Shared Connection...');
  const canonicalExpected = path.resolve(__dirname, '..', 'data', 'sidequest.db');
  const resolvedPath = resolveDefaultDbPath();

  console.log('   Expected Canonical Path:', canonicalExpected);
  console.log('   Resolved Path:          ', resolvedPath);
  console.log('   DEFAULT_DB_PATH:        ', DEFAULT_DB_PATH);

  if (resolvedPath !== canonicalExpected) {
    throw new Error(`resolveDefaultDbPath() mismatch! Expected: ${canonicalExpected}, got: ${resolvedPath}`);
  }
  if (DEFAULT_DB_PATH !== canonicalExpected) {
    throw new Error(`DEFAULT_DB_PATH mismatch! Expected: ${canonicalExpected}, got: ${DEFAULT_DB_PATH}`);
  }
  console.log('   ✓ Canonical path resolution is verified.');

  // =========================================================================
  // 2. Audit Connection Sharing & Foreign Keys (Isolated Test Database)
  // =========================================================================
  console.log('\n2. Testing Connection Sharing & Foreign Key Constraints (Isolated DB)...');
  const auditDir = path.resolve(__dirname, '..', 'data', 'test-audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const auditDbPath = path.join(auditDir, 'audit-lifecycle.db');
  if (fs.existsSync(auditDbPath)) fs.unlinkSync(auditDbPath);

  closeDatabase();
  const testDb = initDatabase(auditDbPath);

  // Check PRAGMA foreign_keys
  const fkPragma = testDb.pragma('foreign_keys', { simple: true });
  console.log(`   ✓ PRAGMA foreign_keys = ${fkPragma} (expected 1)`);
  if (fkPragma !== 1) {
    throw new Error(`foreign_keys pragma is not enabled! Value: ${fkPragma}`);
  }

  // Check Shared Connection across all repositories
  const currentDbInstance = getDatabase();
  if (currentDbInstance !== testDb) {
    throw new Error('getDatabase() returned a different instance than initDatabase()!');
  }
  console.log('   ✓ All repositories share the same active database instance.');

  // Test FK enforcement: inserting conversation with nonexistent mission_id must fail
  let fkBlocked = false;
  try {
    testDb.prepare(`
      INSERT INTO conversations (id, mission_id, type, topic, created_at, updated_at)
      VALUES ('fake-conv', 'nonexistent-mission', 'main', NULL, datetime('now'), datetime('now'))
    `).run();
  } catch (err) {
    fkBlocked = true;
    console.log('   ✓ Foreign key violation properly blocked:', (err as Error).message);
  }
  if (!fkBlocked) {
    throw new Error('Foreign key enforcement failed: invalid mission_id was accepted!');
  }

  // =========================================================================
  // 3. End-to-End Persistence & Reconnection Test (Isolated DB)
  // =========================================================================
  console.log('\n3. Testing End-to-End Persistence across Restart/Reconnect...');
  const { mission, mainConversation } = missionRepository.createMissionWithMainConversation(
    'Build an audited Go concurrency microservice'
  );
  console.log(`   ✓ Created Mission: ${mission.id}`);
  console.log(`   ✓ Created Main Conversation: ${mainConversation.id}`);

  // Create SideQuest
  const sideQuest = conversationRepository.createSideQuestConversation(
    mission.id,
    'Go Mutex vs Channels Performance'
  );
  console.log(`   ✓ Created SideQuest Conversation: ${sideQuest.id} (${sideQuest.topic})`);

  // User and Assistant Messages in Main Conversation
  const mMsg1 = messageRepository.createMessage(mainConversation.id, 'user', 'How do sync.Mutex and channels compare?');
  const mMsg2 = messageRepository.createMessage(mainConversation.id, 'assistant', 'sync.Mutex protects shared state directly, channels pass ownership.');
  console.log(`   ✓ Inserted 2 messages in Main Conversation: ${mMsg1.id}, ${mMsg2.id}`);

  // User and Assistant Messages in SideQuest with explicit architectural decision
  const sqMsg1 = messageRepository.createMessage(
    sideQuest.id,
    'user',
    'Should we use sync.Mutex or channels for our in-memory cache? We decided to use sync.Mutex for the in-memory cache to achieve sub-microsecond latency, and buffered channels for asynchronous event fanout.'
  );
  const sqMsg2 = messageRepository.createMessage(
    sideQuest.id,
    'assistant',
    'Agreed on that architectural decision: sync.Mutex protects the in-memory cache with minimal overhead, while buffered channels handle event fanout cleanly.'
  );
  console.log(`   ✓ Inserted 2 messages in SideQuest Conversation: ${sqMsg1.id}, ${sqMsg2.id}`);

  // Simulate server restart: close DB connection completely
  console.log('   Simulating server shutdown (closing database connection)...');
  closeDatabase();

  // Re-open DB connection
  console.log('   Simulating server startup (reopening database connection)...');
  const restartedDb = initDatabase(auditDbPath);

  // Verify all records survived
  const reloadedMission = missionRepository.getMissionById(mission.id);
  const reloadedMainConv = conversationRepository.getConversationById(mainConversation.id);
  const reloadedSqConv = conversationRepository.getConversationById(sideQuest.id);
  const reloadedMainMsgs = messageRepository.getMessagesByConversationId(mainConversation.id);
  const reloadedSqMsgs = messageRepository.getMessagesByConversationId(sideQuest.id);

  if (!reloadedMission || reloadedMission.objective !== mission.objective) {
    throw new Error('Mission failed to persist across reconnect!');
  }
  if (!reloadedMainConv || reloadedMainConv.type !== 'main') {
    throw new Error('Main conversation failed to persist across reconnect!');
  }
  if (!reloadedSqConv || reloadedSqConv.type !== 'sidequest') {
    throw new Error('SideQuest conversation failed to persist across reconnect!');
  }
  if (reloadedMainMsgs.length !== 2) {
    throw new Error(`Expected 2 Main messages after reconnect, got ${reloadedMainMsgs.length}`);
  }
  if (reloadedSqMsgs.length !== 2) {
    throw new Error(`Expected 2 SideQuest messages after reconnect, got ${reloadedSqMsgs.length}`);
  }
  console.log('   ✓ All missions, conversations, and messages 100% persisted across restart/reconnection.');

  // =========================================================================
  // 4. Return to Mission & Synthesis Persistence (Live Gemma Inference)
  // =========================================================================
  console.log('\n4. Testing Live Return to Mission & Memory Persistence...');
  const returnResult = await returnToMissionService.returnToMission(sideQuest.id);
  console.log('   ✓ Return to Mission live synthesis completed:');
  console.log('     Topic:', returnResult.summary.topic);
  console.log('     Key Learnings count:', returnResult.summary.keyLearnings.length);
  console.log('     Decisions:', returnResult.summary.decisions);

  // Verify SideQuest memory was persisted in DB
  const persistedSqSummary = memoryRepository.getSideQuestStructuredSummary(sideQuest.id);
  if (!persistedSqSummary) {
    throw new Error('Structured summary was not saved to sidequest_memories!');
  }
  console.log('   ✓ Summary verified in sidequest_memories table.');

  // If Gemma extracted decisions, verify mission_memories was updated; otherwise, ensure mission_memories works
  if (returnResult.summary.decisions && returnResult.summary.decisions.length > 0) {
    const persistedMissionMemory = memoryRepository.getMissionMemory(mission.id);
    if (!persistedMissionMemory || !Array.isArray(persistedMissionMemory.decisions)) {
      throw new Error('Mission memory was not updated with synthesized decisions!');
    }
    console.log('   ✓ Decisions verified in mission_memories table:', persistedMissionMemory.decisions);
  } else {
    // Explicitly test mission memory persistence
    memoryRepository.mergeDecisionsIntoMissionMemory(mission.id, ['Use sync.Mutex for in-memory cache'], 'Architecture verified');
    const persistedMissionMemory = memoryRepository.getMissionMemory(mission.id);
    if (!persistedMissionMemory) {
      throw new Error('Mission memory failed to persist!');
    }
    console.log('   ✓ Mission memory verified after decision merge.');
  }

  // Close and reopen again to verify memory persistence across restarts
  console.log('   Closing and reopening to verify memory survives second restart...');
  closeDatabase();
  initDatabase(auditDbPath);

  const reloadedSqSummary = memoryRepository.getSideQuestStructuredSummary(sideQuest.id);
  const reloadedMisMemory = memoryRepository.getMissionMemory(mission.id);
  if (!reloadedSqSummary || !reloadedMisMemory) {
    throw new Error('Memories failed to survive database reconnection!');
  }
  console.log('   ✓ Both sidequest_memories and mission_memories persisted across reconnect.');

  // Verify Main AI incorporates context and marks is_incorporated
  console.log('\n5. Testing Live Main AI Turn with Transferred Context...');
  const mainTurn = await mainAiService.processChat({
    conversationId: mainConversation.id,
    message: 'Now apply the mutex vs channels conclusion to our Go concurrency microservice architecture.',
  });
  console.log('   ✓ Main AI response received:');
  console.log('     "' + mainTurn.reply.trim().split('\n')[0] + '..."');

  // Verify incorporation flag
  const remainingUnincorporated = memoryRepository.getUnincorporatedSideQuestSummaries(mission.id);
  if (remainingUnincorporated.length !== 0) {
    throw new Error(`Expected 0 unincorporated summaries after Main AI turn, got ${remainingUnincorporated.length}`);
  }
  console.log('   ✓ SideQuest memory successfully marked as incorporated (is_incorporated = 1).');

  // Clean up isolated audit DB
  closeDatabase();
  if (fs.existsSync(auditDbPath)) fs.unlinkSync(auditDbPath);
  if (fs.existsSync(`${auditDbPath}-wal`)) fs.unlinkSync(`${auditDbPath}-wal`);
  if (fs.existsSync(`${auditDbPath}-shm`)) fs.unlinkSync(`${auditDbPath}-shm`);
  if (fs.existsSync(auditDir)) fs.rmdirSync(auditDir);
  console.log('   ✓ Isolated test database cleaned up.');

  // =========================================================================
  // 5. Audit Real Database Integrity & Filesystem Isolation
  // =========================================================================
  console.log('\n6. Auditing Real Canonical Database & Filesystem Isolation...');
  const realDb = initDatabase(); // opens canonical backend/data/sidequest.db
  console.log('   Canonical DB active connection established.');

  const realTables = realDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('   Canonical Tables:', realTables.map((t: any) => t.name).join(', '));

  const realCounts: Record<string, number> = {};
  for (const table of ['missions', 'conversations', 'messages', 'sidequest_memories', 'mission_memories']) {
    const c = realDb.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
    realCounts[table] = c.cnt;
  }
  console.log('   Canonical DB Counts:', realCounts);
  if (realCounts.missions < 44 || realCounts.conversations < 55) {
    throw new Error(`Real canonical database has missing records! Found: ${JSON.stringify(realCounts)}`);
  }
  console.log('   ✓ Real canonical database records intact and verified (>= 44 missions, >= 55 conversations).');

  closeDatabase();

  // Assert NO second sidequest.db in workspace root or anywhere else
  const rootDataDir = path.resolve(__dirname, '..', '..', 'data');
  const rootDbFile = path.join(rootDataDir, 'sidequest.db');
  if (fs.existsSync(rootDbFile)) {
    throw new Error(`Second database detected at ${rootDbFile}!`);
  }
  console.log('   ✓ Confirmed no secondary sidequest.db at workspace root.');

  console.log('\n=== AUDIT COMPLETE: ALL CHECKS PASSED SUCCESSFULLY ===');
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});

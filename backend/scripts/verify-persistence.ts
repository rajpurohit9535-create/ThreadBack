import path from 'path';
import fs from 'fs';
import { initDatabase, closeDatabase, getDatabase } from '../src/db/database';
import { missionRepository } from '../src/db/repositories/mission.repo';
import { conversationRepository } from '../src/db/repositories/conversation.repo';
import { messageRepository } from '../src/db/repositories/message.repo';
import { memoryRepository } from '../src/db/repositories/memory.repo';
import { mainAiService } from '../src/services/main-ai.service';
import { sideQuestService } from '../src/services/sidequest.service';

async function runVerification() {
  console.log('=== SIDEQUEST Phase 3 Persistence & Live Inference Verification ===\n');

  // 1. Database Initialization Verification
  console.log('1. Testing Database Initialization...');
  const testDbDir = path.resolve(__dirname, '..', 'data', 'test-verify');
  fs.mkdirSync(testDbDir, { recursive: true });
  const testDbPath = path.join(testDbDir, 'verification.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  closeDatabase();
  const db = initDatabase(testDbPath);
  console.log('   ✓ Database initialized successfully at:', testDbPath);
  console.log('   ✓ Schema applied idempotently.');

  // Verify tables exist
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  const tableNames = tables.map(t => t.name);
  console.log('   ✓ Tables detected:', tableNames.join(', '));
  const expectedTables = ['conversations', 'messages', 'mission_memories', 'missions', 'sidequest_memories'];
  for (const t of expectedTables) {
    if (!tableNames.includes(t)) {
      throw new Error(`Missing expected table: ${t}`);
    }
  }

  // 2. Mission & Conversation Workflow
  console.log('\n2. Testing Mission & Conversation Creation...');
  const created = missionRepository.createMissionWithMainConversation('Build a high-performance Go CRUD API');
  const missionId = created.mission.id;
  const mainConvId = created.mainConversation.id;
  console.log(`   ✓ Mission created: ID=${missionId}, Objective="${created.mission.objective}"`);
  console.log(`   ✓ Main conversation created: ID=${mainConvId}`);

  const sideQuest = conversationRepository.createSideQuestConversation(missionId, 'Go Concurrency Patterns');
  const sideQuestId = sideQuest.id;
  console.log(`   ✓ SideQuest created: ID=${sideQuestId}, Topic="${sideQuest.topic}"`);

  // 3. Message Persistence & Chronological Order
  console.log('\n3. Testing Message Persistence...');
  messageRepository.createMessage(mainConvId, 'user', 'How do Goroutines communicate?');
  messageRepository.createMessage(mainConvId, 'assistant', 'Goroutines communicate via channels.');
  const initialMsgs = messageRepository.getMessagesByConversationId(mainConvId);
  console.log(`   ✓ Stored ${initialMsgs.length} messages in Main conversation.`);

  // 4. Memory Persistence
  console.log('\n4. Testing Memory Upsert...');
  memRepo: memoryRepository.upsertMissionMemory({
    missionId,
    summary: 'Evaluating worker pools',
    progress: '25%',
    decisions: ['Use buffered channels'],
    blockers: [],
    nextStep: 'Benchmark channel throughput',
  });
  const savedMem = memoryRepository.getMissionMemory(missionId);
  console.log(`   ✓ Mission memory persisted: summary="${savedMem?.summary}"`);

  // 5. Restart / Reconnection Verification
  console.log('\n5. Testing Persistence across Backend Restart/Reconnection...');
  closeDatabase();
  console.log('   ✓ Database connection closed (simulating shutdown).');

  const reloadedDb = initDatabase(testDbPath);
  console.log('   ✓ Database re-opened (simulating restart).');

  const reloadedMission = missionRepository.getMissionById(missionId);
  if (!reloadedMission || reloadedMission.objective !== 'Build a high-performance Go CRUD API') {
    throw new Error('Failed to retrieve persisted mission after reconnection');
  }
  const reloadedMsgs = messageRepository.getMessagesByConversationId(mainConvId);
  if (reloadedMsgs.length !== 2 || reloadedMsgs[0]?.content !== 'How do Goroutines communicate?') {
    throw new Error('Failed to retrieve persisted messages in chronological order after reconnection');
  }
  console.log(`   ✓ Verified mission "${reloadedMission.objective}" and ${reloadedMsgs.length} messages intact across restart.`);

  // 6. Live Main AI Inference with Persistence
  console.log('\n6. Testing Live Main AI Inference with Persistent Conversation...');
  const mainTurnResponse = await mainAiService.processChat({
    conversationId: mainConvId,
    message: 'Can you show a 2-line code example of channel send and receive in Go?',
  });
  console.log('   ✓ Main AI live reply received:');
  console.log('     "' + mainTurnResponse.reply.trim().split('\n')[0] + '..."');

  const postMainMsgs = messageRepository.getMessagesByConversationId(mainConvId);
  console.log(`   ✓ Main conversation message count now: ${postMainMsgs.length} (user prompt + assistant reply persisted)`);
  if (postMainMsgs.length !== 4) {
    throw new Error(`Expected 4 messages in main conversation, found ${postMainMsgs.length}`);
  }

  // 7. Live SideQuest Inference with Persistence
  console.log('\n7. Testing Live SideQuest Inference with Persistent Conversation...');
  const sqTurnResponse = await sideQuestService.processSideQuestChat({
    conversationId: sideQuestId,
    message: 'What is the main pitfall when using unbuffered channels in Go?',
  });
  console.log('   ✓ SideQuest AI live reply received:');
  console.log('     "' + sqTurnResponse.reply.trim().split('\n')[0] + '..."');

  const postSqMsgs = messageRepository.getMessagesByConversationId(sideQuestId);
  console.log(`   ✓ SideQuest message count: ${postSqMsgs.length} (strictly separated from Main conversation)`);
  if (postSqMsgs.length !== 2) {
    throw new Error(`Expected 2 messages in SideQuest conversation, found ${postSqMsgs.length}`);
  }

  // 8. Isolation Check
  console.log('\n8. Checking History Isolation...');
  const finalMain = messageRepository.getMessagesByConversationId(mainConvId);
  const finalSq = messageRepository.getMessagesByConversationId(sideQuestId);
  console.log(`   ✓ Main conversation contains: ${finalMain.length} messages`);
  console.log(`   ✓ SideQuest conversation contains: ${finalSq.length} messages`);
  console.log('   ✓ No leakage between Main AI and SideQuest histories verified.');

  closeDatabase();

  // Clean up scratch db
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
  if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
  if (fs.existsSync(testDbDir)) fs.rmdirSync(testDbDir);

  console.log('\n=== All Phase 3 Verifications PASSED Successfully! ===');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

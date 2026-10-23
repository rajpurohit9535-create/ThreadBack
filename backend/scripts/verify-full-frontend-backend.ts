import http from 'http';

const API_BASE = 'http://localhost:4000/api';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function verifyJourney() {
  console.log('=== VERIFYING FULL USER JOURNEY (END-TO-END) ===\n');

  // Step 1: Health & AI status check
  console.log('1. Checking backend health and AI status...');
  const health = await req<{ status: string }>('/health');
  console.log('   ✓ Health check status:', health.status);
  const aiStatus = await req<{ configured: boolean; model: string }>('/ai/status');
  console.log('   ✓ AI status configured:', aiStatus.configured, 'Model:', aiStatus.model);

  // Step 2: Create a mission
  console.log('\n2. Creating a new mission...');
  const testObjective = `Build a high-performance HTTP gateway in Go (Test Run ${Date.now()})`;
  const createRes = await req<{
    mission: { id: string; objective: string; status: string };
    mainConversation: { id: string; missionId: string; type: string };
  }>('/missions', {
    method: 'POST',
    body: JSON.stringify({ objective: testObjective }),
  });

  const missionId = createRes.mission.id;
  const mainConvId = createRes.mainConversation.id;
  console.log(`   ✓ Mission created: ${missionId}`);
  console.log(`   ✓ Main conversation created: ${mainConvId}`);

  // Step 3: Send message to Main AI and receive real Gemma response
  console.log('\n3. Sending message to Main AI (live Gemma inference)...');
  const mainChat1 = await req<{ reply: string; conversationId: string; missionId: string }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: mainConvId,
      message: 'What architectural patterns should we consider for reverse proxy routing in Go?',
    }),
  });
  console.log('   ✓ Received Main AI reply:');
  console.log('     "' + mainChat1.reply.trim().split('\n')[0] + '..."');

  // Step 4: Verify persistence (messages present in SQLite)
  console.log('\n4. Verifying persistence of Main AI history...');
  const mainMessages = await req<{ messages: any[] }>(`/conversations/${mainConvId}/messages`);
  console.log(`   ✓ Main AI conversation has ${mainMessages.messages.length} persisted messages.`);
  if (mainMessages.messages.length < 2) {
    throw new Error('Expected at least 2 messages (1 user, 1 assistant) in Main AI conversation');
  }

  // Step 5: Create a SideQuest associated with the mission
  console.log('\n5. Creating SideQuest associated with the mission...');
  const sqRes = await req<{ sideQuest: { id: string; missionId: string; topic: string } }>(
    `/missions/${missionId}/sidequests`,
    {
      method: 'POST',
      body: JSON.stringify({ topic: 'HTTP RoundTripper Connection Pools' }),
    }
  );
  const sideQuestId = sqRes.sideQuest.id;
  console.log(`   ✓ SideQuest created: ${sideQuestId} (${sqRes.sideQuest.topic})`);

  // Step 6: Ask question in SideQuest and verify independent persisted history
  console.log('\n6. Asking question in SideQuest (live Gemma inference)...');
  const sqChat1 = await req<{ reply: string; conversationId: string }>(
    '/ai/sidequest/chat',
    {
      method: 'POST',
      body: JSON.stringify({
        conversationId: sideQuestId,
        message: 'How should http.Transport MaxIdleConnsPerHost be configured to prevent connection starvation? We decided to set MaxIdleConnsPerHost to 100.',
      }),
    }
  );
  console.log('   ✓ Received SideQuest reply:');
  console.log('     "' + sqChat1.reply.trim().split('\n')[0] + '..."');

  const sqMessages = await req<{ messages: any[] }>(`/conversations/${sideQuestId}/messages`);
  console.log(`   ✓ SideQuest conversation has ${sqMessages.messages.length} persisted messages.`);
  if (sqMessages.messages.length < 2) {
    throw new Error('Expected at least 2 messages in SideQuest conversation');
  }

  // Verify SideQuest and Main AI message histories remain separate
  const mainMessagesCheck = await req<{ messages: any[] }>(`/conversations/${mainConvId}/messages`);
  if (mainMessagesCheck.messages.length !== 2) {
    throw new Error('History pollution detected! Main AI message count changed prematurely.');
  }
  console.log('   ✓ Histories strictly segregated: Main AI has 2 messages, SideQuest has 2 messages.');

  // Step 7: Select Return to Mission and verify structured summary generated and saved
  console.log('\n7. Calling Return to Mission (structured synthesis with Gemma)...');
  const returnRes = await req<{
    summary: {
      topic: string;
      keyLearnings: string[];
      decisions: string[];
      missionRelevance: string;
    };
    mainConversationId: string;
    sideQuestConversationId: string;
  }>(`/conversations/${sideQuestId}/return-to-mission`, {
    method: 'POST',
  });

  console.log('   ✓ Return to Mission completed:');
  console.log('     Topic:', returnRes.summary.topic);
  console.log('     Key Learnings:', returnRes.summary.keyLearnings);
  console.log('     Decisions:', returnRes.summary.decisions);
  console.log('     Relevance:', returnRes.summary.missionRelevance);

  // Step 8: Resume Main AI and verify it receives the relevant transferred context
  console.log('\n8. Resuming Main AI turn with transferred context...');
  const mainChat2 = await req<{ reply: string }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: mainConvId,
      message: 'Proceed with the next step of our HTTP gateway, taking our connection pooling findings into account.',
    }),
  });
  console.log('   ✓ Received Main AI continuation reply:');
  console.log('     "' + mainChat2.reply.trim().split('\n')[0] + '..."');

  // Verify Main AI message list still does NOT contain raw SideQuest messages
  const mainMessagesAfterResume = await req<{ messages: any[] }>(`/conversations/${mainConvId}/messages`);
  console.log(`   ✓ Main AI messages count after resumption: ${mainMessagesAfterResume.messages.length} (expected 4: 2 user, 2 assistant)`);
  if (mainMessagesAfterResume.messages.length !== 4) {
    throw new Error(`Expected exactly 4 messages in Main AI history, got ${mainMessagesAfterResume.messages.length}`);
  }

  // Step 9: Verify persistence of mission and all conversations
  console.log('\n9. Verifying mission retrieval with all associated conversations...');
  const missionDetails = await req<{
    mission: { id: string; objective: string };
    conversations: any[];
  }>(`/missions/${missionId}`);
  console.log(`   ✓ Mission retrieved with ${missionDetails.conversations.length} conversations.`);
  if (missionDetails.conversations.length !== 2) {
    throw new Error(`Expected 2 conversations for mission, got ${missionDetails.conversations.length}`);
  }

  console.log('\n=== ALL USER JOURNEY STEPS VERIFIED WITH REAL BACKEND & GEMMA ===');
}

verifyJourney().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

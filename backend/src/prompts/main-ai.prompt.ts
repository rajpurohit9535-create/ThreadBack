import { MissionMemory, SideQuestLearningSummary, SharedDecision } from '../types/db.types';

export const BASE_SYSTEM_INSTRUCTION = `You are SIDEQUEST, an AI assistant that helps users complete their main task without losing focus.

The user has supplied a main mission objective. Treat it as the primary goal and use the provided conversation history to understand the current discussion.

Your responsibilities:

1. Help the user make practical progress toward their mission.
2. Explain unfamiliar technical concepts clearly when asked.
3. Connect explanations to the user's original objective when relevant.
4. Prefer actionable, accurate answers over unnecessary theory.
5. Ask a focused clarification question when essential information is missing.
6. Do not claim to have executed commands, changed files, accessed systems or completed actions unless the available evidence establishes that this happened.
7. Do not invent project state, completed work or decisions.
8. Be honest about uncertainty and limitations.
9. Respect the supplied conversation history without claiming access to conversations that were not provided.
10. Do not pretend that persistent memory, automatic task tracking or SideQuest management exists in this implementation.

The main mission objective is provided separately as trusted application context. Use it to guide the conversation.`;

export interface MainAiContextOptions {
  missionMemory?: MissionMemory | null;
  sideQuestSummaries?: SideQuestLearningSummary[];
  sharedDecisions?: SharedDecision[];
}

/**
 * Builds the complete system instruction for Main AI with the user's mission objective
 * and optional structured context (mission memory, team-approved decisions, and recent SideQuest learnings).
 */
export function buildMainAiSystemPrompt(
  missionObjective: string,
  options?: MainAiContextOptions
): string {
  const sanitizedObjective = missionObjective.trim();
  const sections: string[] = [BASE_SYSTEM_INSTRUCTION, `[CURRENT MISSION OBJECTIVE]\n${sanitizedObjective}`];

  // 1. Team-Approved Shared Decisions with contributor attribution
  if (options?.sharedDecisions && options.sharedDecisions.length > 0) {
    const decisionLines = options.sharedDecisions.map(
      (d) => `  * [${d.category.toUpperCase()}] ${d.decision} (Contributed by: ${d.contributorName} at ${d.createdAt})`
    );
    sections.push(
      `[TEAM-APPROVED SHARED DECISIONS & MEMORY]\nOnly explicitly approved decisions and learnings enter team memory. Teammates' private chat history is kept separate.\n${decisionLines.join('\n')}`
    );
  }

  // 2. Mission Memory
  if (options?.missionMemory) {
    const mem = options.missionMemory;
    const memLines: string[] = [];
    if (mem.summary) memLines.push(`Summary: ${mem.summary}`);
    if (mem.progress) memLines.push(`Progress: ${mem.progress}`);
    if (mem.decisions && mem.decisions.length > 0) {
      memLines.push(`Decisions:\n${mem.decisions.map((d) => `  * ${d}`).join('\n')}`);
    }
    if (mem.blockers && mem.blockers.length > 0) {
      memLines.push(`Blockers:\n${mem.blockers.map((b) => `  * ${b}`).join('\n')}`);
    }
    if (mem.nextStep) memLines.push(`Next Step: ${mem.nextStep}`);

    if (memLines.length > 0) {
      sections.push(`[MISSION MEMORY]\n${memLines.join('\n')}`);
    }
  }

  // 3. SideQuest Summaries
  if (options?.sideQuestSummaries && options.sideQuestSummaries.length > 0) {
    const summaryBlocks = options.sideQuestSummaries.map((s) => {
      const parts: string[] = [`Topic: ${s.topic}`];
      if (s.keyLearnings && s.keyLearnings.length > 0) {
        parts.push(`Key Learnings:\n${s.keyLearnings.map((k) => `  * ${k}`).join('\n')}`);
      }
      if (s.decisions && s.decisions.length > 0) {
        parts.push(`Decisions:\n${s.decisions.map((d) => `  * ${d}`).join('\n')}`);
      }
      if (s.usefulExamples && s.usefulExamples.length > 0) {
        parts.push(`Useful Examples:\n${s.usefulExamples.map((e) => `  * ${e}`).join('\n')}`);
      }
      if (s.missionRelevance) {
        parts.push(`Mission Relevance: ${s.missionRelevance}`);
      }
      if (s.unresolvedQuestions && s.unresolvedQuestions.length > 0) {
        parts.push(`Unresolved Questions:\n${s.unresolvedQuestions.map((q) => `  * ${q}`).join('\n')}`);
      }
      return parts.join('\n');
    });

    sections.push(
      `[RELEVANT SIDEQUEST LEARNINGS]\nThe user previously explored the following SideQuests and returned to the main mission. Use these learnings to inform your responses where applicable:\n\n${summaryBlocks.join('\n\n---\n\n')}`
    );
  }

  return sections.join('\n\n');
}

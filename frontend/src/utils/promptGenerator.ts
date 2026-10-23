import { Mission, QueryBranch } from '../types';

export function generateContinuationPrompt(mission: Mission, branch: QueryBranch | null): string {
  const completedText = mission.completedSteps.length > 0
    ? `The following steps are already completed: ${mission.completedSteps.join(', ')}.`
    : 'No completed steps recorded yet.';

  const constraintsText = mission.constraints.length > 0
    ? `Preserve these non-negotiable constraints: ${mission.constraints.join('; ')}.`
    : '';

  const blockerText = mission.currentBlocker
    ? `Prior blocker: ${mission.currentBlocker}`
    : '';

  const nextActionText = mission.nextAction
    ? `The immediate next action is: ${mission.nextAction}.`
    : 'Resume execution of the primary objective.';

  let branchInsight = '';
  if (branch) {
    if (branch.learningNotes && branch.learningNotes.length > 0) {
      branchInsight = `During a side exploration on "${branch.title}", we verified: ${branch.learningNotes.join(' ')}`;
    } else if (branch.messages && branch.messages.length > 1) {
      // Pick assistant's first sentence
      const assistantMsg = branch.messages.find(m => m.role === 'assistant');
      if (assistantMsg) {
        const firstSentence = assistantMsg.content.split('\n')[0].replace(/[#*`]/g, '').trim();
        branchInsight = `Key takeaway from investigated sidequest "${branch.title}": ${firstSentence}`;
      } else {
        branchInsight = `Recently investigated sidequest: "${branch.title}".`;
      }
    } else {
      branchInsight = `Context preserved from side investigation: "${branch.title}".`;
    }
  }

  // Construct cohesive prompt like the prompt specification
  const parts: string[] = [];

  parts.push(`Continue the primary task: "${mission.title}" (${mission.objective}).`);
  parts.push(completedText);
  parts.push(nextActionText);

  if (branchInsight) {
    parts.push(`Incorporate this insight: ${branchInsight}`);
  }

  if (constraintsText) {
    parts.push(constraintsText);
  }

  if (blockerText) {
    parts.push(`Ensure the following is addressed: ${blockerText}`);
  }

  parts.push(`Do not assume any unverified steps are finished. Maintain focus on the next action.`);

  return parts.join(' ');
}

export function synthesizeBranchLearning(branch: QueryBranch | null): string {
  if (!branch) {
    return 'No sidequest branch selected. Context represents overall mission root.';
  }

  if (branch.learningNotes && branch.learningNotes.length > 0) {
    return branch.learningNotes.join(' • ');
  }

  const assistantMsg = branch.messages.find(m => m.role === 'assistant');
  if (assistantMsg) {
    return assistantMsg.content.slice(0, 180) + '...';
  }

  return `Explored topic: "${branch.title}". Preserving thread for future reference.`;
}

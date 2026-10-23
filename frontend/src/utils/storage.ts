import { Mission, QueryBranch } from '../types';
import { INITIAL_MISSION, INITIAL_BRANCHES, SECONDARY_SAMPLE_MISSION } from '../data/mockData';

const MISSIONS_KEY = 'threadback_missions_v1';
const BRANCHES_KEY = 'threadback_branches_v1';
const ACTIVE_MISSION_ID_KEY = 'threadback_active_mission_id';
const ACTIVE_BRANCH_ID_KEY = 'threadback_active_branch_id';

export function loadMissions(): Mission[] {
  try {
    const raw = localStorage.getItem(MISSIONS_KEY);
    if (!raw) {
      const initial = [INITIAL_MISSION, SECONDARY_SAMPLE_MISSION];
      saveMissions(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_MISSION];
  } catch (e) {
    console.error('Failed to load missions from localStorage:', e);
    return [INITIAL_MISSION];
  }
}

export function saveMissions(missions: Mission[]): void {
  try {
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
  } catch (e) {
    console.error('Failed to save missions to localStorage:', e);
  }
}

export function loadBranches(): QueryBranch[] {
  try {
    const raw = localStorage.getItem(BRANCHES_KEY);
    if (!raw) {
      saveBranches(INITIAL_BRANCHES);
      return INITIAL_BRANCHES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_BRANCHES;
  } catch (e) {
    console.error('Failed to load branches from localStorage:', e);
    return INITIAL_BRANCHES;
  }
}

export function saveBranches(branches: QueryBranch[]): void {
  try {
    localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
  } catch (e) {
    console.error('Failed to save branches to localStorage:', e);
  }
}

export function loadActiveMissionId(): string {
  try {
    return localStorage.getItem(ACTIVE_MISSION_ID_KEY) || INITIAL_MISSION.id;
  } catch {
    return INITIAL_MISSION.id;
  }
}

export function saveActiveMissionId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_MISSION_ID_KEY, id);
  } catch (e) {
    console.error(e);
  }
}

export function loadActiveBranchId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_BRANCH_ID_KEY) || 'branch-middleware';
  } catch {
    return 'branch-middleware';
  }
}

export function saveActiveBranchId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_BRANCH_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_BRANCH_ID_KEY);
    }
  } catch (e) {
    console.error(e);
  }
}

export function resetToDemoData(): { missions: Mission[]; branches: QueryBranch[] } {
  try {
    localStorage.removeItem(MISSIONS_KEY);
    localStorage.removeItem(BRANCHES_KEY);
    localStorage.removeItem(ACTIVE_MISSION_ID_KEY);
    localStorage.removeItem(ACTIVE_BRANCH_ID_KEY);
  } catch (e) {
    console.error(e);
  }
  const missions = [INITIAL_MISSION, SECONDARY_SAMPLE_MISSION];
  const branches = INITIAL_BRANCHES;
  saveMissions(missions);
  saveBranches(branches);
  saveActiveMissionId(INITIAL_MISSION.id);
  saveActiveBranchId('branch-middleware');
  return { missions, branches };
}

import Database from 'better-sqlite3';

export const SCHEMA_SQL = `
-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- 3. Team Memberships table
CREATE TABLE IF NOT EXISTS team_memberships (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships(team_id);

-- 4. Team Invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);

-- 5. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  github_repo TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- 6. Missions table
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'personal' CHECK(visibility IN ('personal', 'team')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Conversations table (one main conversation, zero or more sidequests per mission)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('main', 'sidequest')),
  topic TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_shared INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_main_conversation 
  ON conversations(mission_id) WHERE type = 'main';

CREATE INDEX IF NOT EXISTS idx_conversations_mission_id 
  ON conversations(mission_id);

-- 7. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at 
  ON messages(conversation_id, created_at ASC);

-- 8. Mission Memories table (at most one memory record per mission)
CREATE TABLE IF NOT EXISTS mission_memories (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  progress TEXT NOT NULL DEFAULT '',
  decisions TEXT NOT NULL DEFAULT '[]',
  blockers TEXT NOT NULL DEFAULT '[]',
  next_step TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_memories_mission_id 
  ON mission_memories(mission_id);

-- 9. SideQuest Memories table (at most one memory record per sidequest conversation)
CREATE TABLE IF NOT EXISTS sidequest_memories (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  learning_summary TEXT NOT NULL DEFAULT '',
  unresolved_questions TEXT NOT NULL DEFAULT '[]',
  is_incorporated INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sidequest_memories_conversation_id 
  ON sidequest_memories(conversation_id);

-- 10. Shared Decisions table (records approved decisions with contributor and timestamp)
CREATE TABLE IF NOT EXISTS shared_decisions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'decision' CHECK(category IN ('decision', 'learning', 'blocker', 'next_step')),
  contributed_by TEXT NOT NULL REFERENCES users(id),
  contributor_name TEXT NOT NULL,
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_decisions_mission ON shared_decisions(mission_id, created_at ASC);

-- 11. GitHub Connections table (Phase 2) - Credentials encrypted at rest with AES-256-GCM
CREATE TABLE IF NOT EXISTS github_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK(account_type IN ('user', 'app_installation')),
  encrypted_access_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_tag TEXT NOT NULL,
  scope TEXT,
  token_type TEXT DEFAULT 'bearer',
  status TEXT NOT NULL CHECK(status IN ('active', 'revoked', 'disconnected')),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_github_connections_user ON github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_github_connections_status ON github_connections(status);

-- 12. Project Feedback table (records user feedback on reports, missions, and sidequests)
CREATE TABLE IF NOT EXISTS project_feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  target_type TEXT NOT NULL CHECK(target_type IN ('repo_analysis', 'mission', 'sidequest')),
  target_id TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_feedback_project ON project_feedback(project_id, created_at DESC);
`;

/**
 * Initializes database schema idempotently and applies non-destructive column migrations.
 */
export function initializeSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);

  // Helper function to safely add a column if not present
  const addColumnIfNotExists = (table: string, column: string, definition: string) => {
    try {
      const columns = db.pragma(`table_info(${table})`) as { name: string }[];
      if (Array.isArray(columns) && !columns.some((c) => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    } catch {
      // Ignore migration errors if already applied
    }
  };

  // 1. sidequest_memories.is_incorporated
  addColumnIfNotExists('sidequest_memories', 'is_incorporated', 'INTEGER NOT NULL DEFAULT 0');

  // 2. missions (team_id, user_id, visibility)
  addColumnIfNotExists('missions', 'team_id', 'TEXT REFERENCES teams(id) ON DELETE CASCADE');
  addColumnIfNotExists('missions', 'user_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
  addColumnIfNotExists('missions', 'visibility', "TEXT NOT NULL DEFAULT 'personal'");

  // 3. conversations (user_id, is_shared)
  addColumnIfNotExists('conversations', 'user_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
  addColumnIfNotExists('conversations', 'is_shared', 'INTEGER NOT NULL DEFAULT 1');

  // 4. messages (user_id, user_name)
  addColumnIfNotExists('messages', 'user_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
  addColumnIfNotExists('messages', 'user_name', 'TEXT');

  // 5. missions (project_id)
  addColumnIfNotExists('missions', 'project_id', 'TEXT REFERENCES projects(id) ON DELETE CASCADE');

  // Create indexes on migrated columns safely after columns exist
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_missions_team_id ON missions(team_id);
      CREATE INDEX IF NOT EXISTS idx_missions_user_id ON missions(user_id);
      CREATE INDEX IF NOT EXISTS idx_missions_project_id ON missions(project_id);
    `);
  } catch {
    // Ignore if already created
  }
}

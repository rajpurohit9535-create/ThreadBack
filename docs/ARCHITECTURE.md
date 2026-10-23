# Architecture Documentation — ThreadBack

## 1. System Overview
ThreadBack combines a visual mission board (Canvas Board built on `@xyflow/react`) with an intelligent dual-agent conversational engine (Main AI and SideQuests). Phase 1 expands ThreadBack into a multi-user workspace supporting teams, team invitations, shared missions, and team-approved decision memory while preserving individual private context.

```
┌─────────────────────────────────────────────────────────────┐
│                       React 19 Frontend                     │
│  ┌───────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │  FlowCanvas   │ │ SideChatDrawer │ │ Team & Auth UIs  │  │
│  └───────┬───────┘ └───────┬────────┘ └────────┬─────────┘  │
│          └─────────────────┼───────────────────┘            │
│                       canvasStore                           │
│              (Zustand + 4s Auto-Sync Poller)                │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP / JSON
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express 5 Backend                        │
│  ┌───────────────────────┬───────────────────────────────┐  │
│  │ auth & rate-limit mw  │     role & team access mw     │  │
│  └───────────┬───────────┴───────────────┬───────────────┘  │
│              ▼                           ▼                  │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │ Auth & Team Control   │   │ Mission & AI Control      │  │
│  └───────────┬───────────┘   └───────────┬───────────────┘  │
│              │                           │                  │
│              ▼                           ▼                  │
│   ┌─────────────────────┐    ┌───────────────────────────┐  │
│   │  Repositories Layer │    │ Gemma 4 AI Inference (SDK)│  │
│   └──────────┬──────────┘    └───────────────────────────┘  │
│              ▼                                              │
│   SQLite Database (WAL mode, foreign keys ON)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Entities & Schema
The SQLite database is initialized by `initializeSchema` in `backend/src/db/schema.ts` with WAL journal mode and foreign key enforcement.

### Entity Relationship Diagram
```
 users
  ├── id (PK)
  ├── email (UNIQUE)
  ├── name
  └── password_hash
       │
       ├─────────────────────────────────┐
       ▼ (1:N)                           ▼ (1:N)
 teams                             team_memberships
  ├── id (PK)                       ├── id (PK)
  ├── name                          ├── team_id (FK -> teams.id)
  └── created_by (FK -> users.id)   ├── user_id (FK -> users.id)
       │                            └── role ('owner'|'admin'|'member')
       │                                 [UNIQUE(team_id, user_id)]
       ├─────────────────────────────────┐
       ▼ (1:N)                           ▼ (1:N)
 team_invitations                  projects
  ├── id (PK)                       ├── id (PK)
  ├── team_id (FK -> teams.id)      ├── name
  ├── token (UNIQUE, 24 bytes)      ├── description
  ├── role ('admin'|'member')       ├── team_id (FK -> teams.id, nullable)
  ├── invited_by (FK -> users.id)   ├── user_id (FK -> users.id, nullable)
  ├── status ('pending'|...)        ├── github_repo (nullable)
  └── expires_at                    ├── status ('active'|'archived')
                                    ├── created_at
                                    └── updated_at
                                         │
                                         ▼ (1:N)
                                    missions
                                     ├── id (PK)
                                     ├── project_id (FK -> projects.id, nullable)
                                     ├── objective
                                     ├── status ('active'|'completed'|'archived')
                                     ├── team_id (FK -> teams.id, nullable)
                                     ├── user_id (FK -> users.id, nullable)
                                     ├── visibility ('personal'|'team')
                                     ├── created_at
                                     └── updated_at
                                         │
                                         ├────────────────────────┐
                                         ▼ (1:N)                  ▼ (1:N)
                                   conversations            shared_decisions
                                    ├── id (PK)              ├── id (PK)
                                    ├── mission_id (FK)      ├── mission_id (FK)
                                    ├── type ('main'|'sq')   ├── decision
                                    ├── topic                ├── category ('decision'|...)
                                    ├── user_id (FK)         ├── contributed_by (FK)
                                    └── is_shared (0|1)      ├── contributor_name
                                         │                   ├── source_conv_id (FK)
                                         ▼ (1:N)             └── created_at
                                   messages
                                    ├── id (PK)
                                    ├── conversation_id (FK)
                                    ├── role ('user'|'assistant')
                                    ├── content
                                    ├── user_id (FK)
                                    ├── user_name
                                    └── created_at
```

---

## 3. Authentication & Security Lifecycle
1. **Registration**: Validates input (email, name, password >= 6 chars). Hashes password with random salt using Node.js `scryptSync(password, salt, 64)`. Generates an HMAC-SHA256 signed token.
2. **Login**: Validates credentials using `crypto.timingSafeEqual`. Generates and returns signed token.
3. **Session Restoration**: Frontend stores token in `localStorage`. On page load, `checkAuthSession` calls `GET /api/auth/me`. If valid, user state and teams are restored; if expired, token is cleared.
4. **Rate Limiting**: `authRateLimiter` enforces max 15 requests/minute per IP on auth routes.
5. **Secrets**: Kept strictly in `process.env.AUTH_SECRET` and `process.env.GEMINI_API_KEY`. No secrets are exposed to the client or committed to git.

---

## 4. Multi-User Team Sharing & Permissions
- **Team Creation**: Any authenticated user can create a team and automatically becomes its `owner`.
- **Invitations**: Team `owner` or `admin` can invite users by email or generate a secure 24-byte link token. The link expires after 7 days.
- **Acceptance**: Prospective members authenticate and call `POST /api/invites/:token/accept`. The backend transaction marks the invitation accepted and creates `team_memberships`.
- **Authorization Enforcement**:
  - `requireTeamRole(teamIdParam, minimumRole)` middleware ensures the requester is an active team member.
  - Cross-team ID guessing on missions (`GET /api/missions/:id`, `POST /api/missions/:id/sidequests`, etc.) validates membership and returns `403 Forbidden` if unauthorized.
  - Personal missions (`teamId == null`) are strictly private to their owner (`userId`).

---

## 5. Context Isolation & Decision Memory
1. **Private Chat vs Shared Memory**:
   - SideQuests created in team missions default to shared, but can be made private (`is_shared = 0`).
   - Personal conversations are never leaked to teammates.
2. **Return to Mission**:
   - `ReturnToMissionService` synthesizes technical exploration into key learnings, decisions, and relevance using Gemma.
   - Synthesized decisions are saved to `shared_decisions` attributed to the user (`contributed_by`, `contributor_name`, `created_at`).
3. **Main AI System Prompt**:
   - Injected with:
     - `[CURRENT MISSION OBJECTIVE]`
     - `[TEAM-APPROVED SHARED DECISIONS & MEMORY]` (attributed decisions)
     - `[MISSION MEMORY]` (summary, progress, blockers)
     - `[RELEVANT SIDEQUEST LEARNINGS]` (bounded, recent unincorporated summaries)
   - Teammates' full chat transcripts are **never** dumped into the prompt, preventing context pollution and token exhaustion.

---

## 6. Real Collaboration & Synchronization
- Real-time persistence backed by SQLite.
- The frontend `canvasStore` runs a non-intrusive 4-second synchronization poller (`pollMissionUpdates`) while a mission is open.
- When teammates create branches or approved decisions, updates are merged into state without resetting the user's active viewport, selected node, or input draft.

---

## 7. Mock Authentication & Developer Switcher
1. **Mock Registration & Login**:
   - Built on native Node.js `scrypt` hashing and signed tokens without requiring external identity providers or real SMTP servers in local development.
   - Form validations enforce email format and password length.
   - Transparent disclaimer alerts developers that email transmission is simulated.
2. **Developer Mock User Switcher**:
   - Endpoints: `GET /api/auth/dev-users` and `POST /api/auth/dev-switch` are strictly gated behind `process.env.NODE_ENV !== 'production'`.
   - UI: `DevUserSwitcher` rendered only when `import.meta.env.DEV` is true.
   - Frontend State Reset: `canvasStore.switchMockUser` cancels polling intervals, clears `activeMission`, canvas `nodes`, and conversation cache before fetching the newly selected mock user's dataset.

---

## 8. Zero-Seed Startup & Data Isolation
1. **No Automatic Predefined Data**:
   - `INITIAL_FALLBACK_MISSION` removed from initial state.
   - `initializeWorkspace()` no longer auto-creates a fallback mission.
   - When a user has 0 missions, `EmptyWorkspaceView` renders a modern dark empty state with a call to action.
2. **Strict Mission Scoping**:
   - `listMissions({ userId })` enforces `WHERE user_id = ? AND team_id IS NULL`, preventing unassigned legacy missions from appearing in newly registered accounts.
3. **Vitest Isolation**:
   - `vitest.config.ts` redirects `DATABASE_PATH` to `backend/data/test-suite.db`.
   - `backend/data/sidequest.db` remains 100% free of test pollution.

---

## 9. Initial Project Setup & BinaryBombers 3D Frontend Integration
1. **Direct 3D Frontend Code Reuse**:
   - Copied directly from `D:\Projects\binary\Binary-main\React-Frontend`:
     - `Background3D.tsx`: 5,000 particle starfield + floating wireframe tech blocks with cursor parallax using Three.js and `@react-three/fiber`.
     - `ThreeCanvas.tsx`: Organic rotating distorting iridescent sphere with `@react-three/drei` `MeshDistortMaterial`.
     - `hero.png`: Copied into `frontend/src/assets/hero.png`.
2. **Project Setup Wizard (`ProjectSetupPage.tsx`)**:
   - Step 1: Project Details (Name required, Description optional, Team selector / inline creation).
   - Step 2: Add Team Members (Email input, role selection, pending invite badges, simulated delivery notice, skippable).
   - Step 3: Connect GitHub (Calls `GET /api/projects/github/status`, honestly reports if unconfigured without fake repos, skippable).
   - Submission: Calls `POST /api/projects` and batch invitations `POST /api/teams/:id/invites`, selects the newly created project, and opens the Canvas Board.
3. **Canvas Board Visual Preservation**:
   - All dark 3D backgrounds and styles are scoped strictly inside `.binary-setup-page`.
   - Global `html, body` styles maintain `#f8fafc`, and the Canvas Board maintains its white card background (`bg-white rounded-3xl border border-slate-200/90`), subtle dotted grid (`#cbd5e1`), navbar, sidebar, floating toolbar, and bottom prompt dock pixel-for-pixel.



---

## 10. Phase 2 GitHub & Repository Analysis Engine
1. **AES-256-GCM Token Encryption**:
   - `encryptToken` and `decryptToken` in `backend/src/utils/crypto.ts` use Node.js `crypto.createCipheriv('aes-256-gcm', key, iv)`.
   - Access tokens are encrypted at rest with a random 12-byte IV and 16-byte authentication tag derived from `AUTH_SECRET`.
   - Plaintext tokens are never stored, logged, or returned to the client.
2. **GitHub Repository Listing & Association**:
   - `github.service.ts` lists authenticated repositories via `https://api.github.com/user/repos` and associates repositories with ThreadBack projects.
   - Disconnection clears token credentials; simulation endpoint permits testing token revocation workflows.
3. **Repository Analysis & Architecture Synthesis**:
   - `repo-analysis.service.ts` analyzes directory structures, package descriptors, and architecture patterns.
   - Built-in resilient analysis model with fallback for `codecrafters-io/build-your-own-x`.
4. **Drift Detection Engine**:
   - `drift-detection.service.ts` evaluates repository patterns against team-approved decisions in `shared_decisions`, generating drift severity scores (low/medium/high) and remediation guidance.
5. **Project & Repo Feedback Persistence**:
   - `feedback.repo.ts` persists 1-5 star ratings and comments linked to specific analysis targets or projects.

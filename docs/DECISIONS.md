# Architecture Decision Records (ADRs) — ThreadBack

## ADR-001: Minimal Native Crypto for Authentication and Signed Tokens
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: The existing application lacked user authentication. We needed a secure solution compatible with Node.js and Express without adding heavy external dependencies that might complicate compilation on Windows.
- **Decision**: Used Node.js built-in `node:crypto` with `scryptSync` (16-byte salt, 64-byte key) for password hashing and timing-safe comparison. Issued signed JWT-compatible HMAC-SHA256 bearer tokens. Added in-memory IP rate limiting (15 requests/minute) on auth routes.
- **Consequences**: Zero new npm runtime dependencies required. Fast, secure, completely cross-platform, and fully verified by unit and integration tests.

---

## ADR-002: Idempotent Column Additions & SQLite WAL Mode
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Existing databases (`backend/data/sidequest.db`) contained missions, messages, and memories that had to be preserved without data loss or downtime.
- **Decision**: Added tables (`users`, `teams`, `team_memberships`, `team_invitations`, `shared_decisions`) with `CREATE TABLE IF NOT EXISTS`. Added columns (`team_id`, `user_id`, `visibility`, `is_shared`, `user_name`) via `PRAGMA table_info` checks and `ALTER TABLE ADD COLUMN` statements inside `initializeSchema`. Created indexes on migrated columns only after confirming their existence.
- **Consequences**: Legacy databases upgrade seamlessly on startup without requiring manual scripts or data wipes.

---

## ADR-003: Distinct Decision Memory vs Full Chat Dump
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: When multiple team members work on a shared mission, blindly dumping all members' chat histories into the Main AI prompt would rapidly exhaust the context window and leak private exploratory deliberations.
- **Decision**: Maintained strict separation between:
  1. Authoritative Main conversation history.
  2. Isolated SideQuest conversation histories.
  3. Structured `shared_decisions` table recording explicitly approved findings with author and timestamp attribution.
  Injected only approved decisions into the Main AI prompt block `[TEAM-APPROVED SHARED DECISIONS & MEMORY]`.
- **Consequences**: The Main AI maintains sharp focus on verified facts, private exploration remains private, and token consumption is bounded.

---

## ADR-004: Polling-Based Collaboration Synchronization for Phase 1
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Team members opening the same mission need to see shared branches, messages, and approved decisions in near real time without introducing the operational complexity of WebSockets in Phase 1.
- **Decision**: Implemented client-side non-intrusive polling (`pollMissionUpdates`) in `canvasStore.ts` every 4 seconds. Merges newly added branches and decisions smoothly without disrupting the user's canvas panning, node selection, or prompt drafting.
- **Consequences**: Simple, reliable, zero socket reconnect overhead, and easily upgradable to Server-Sent Events (SSE) or WebSockets in Phase 2 if real-time typing indicators are desired.

---

## ADR-005: Elimination of Predefined Mock Data & Clean Empty Workspace State
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Initial application startup previously injected sample missions ("Original Mission Root", "Alice Private Salary Notes"), pre-set constraints ('Use Go', 'Use PostgreSQL'), and sample nodes. A new account had immediate cluttered state, and test runs polluted the primary database.
- **Decision**: 
  1. Removed `INITIAL_FALLBACK_MISSION` and automatic mission creation on workspace startup.
  2. Implemented `EmptyWorkspaceView` component for uninitialized states.
  3. Scoped backend queries in `mission.repo.ts` strictly to `user_id = ? AND team_id IS NULL` for personal missions, preventing unassigned legacy missions from appearing in newly registered accounts.
  4. Removed prefill buttons from `AuthModal` to avoid accidental fixture creation during public use.
- **Consequences**: Every new account starts with a completely pristine, empty workspace and clear project creation call to action.

---

## ADR-006: Gated Development-Only Mock User Switcher
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Developers need an ergonomic way to test team invitations, shared missions, and decision attribution across multiple accounts without managing separate browser profiles or incognito tabs. However, account switching must not exist in production or bypass security.
- **Decision**: Added `DevUserSwitcher` component in the frontend top navbar, strictly gated by `import.meta.env.DEV` on frontend and `NODE_ENV !== 'production'` on backend (`GET /api/auth/dev-users` and `POST /api/auth/dev-switch`). On switch, `canvasStore` cancels in-flight polling timers, purges active mission, canvas nodes, and conversation cache, and reloads the new user's state cleanly.
- **Consequences**: Seamless multi-user testing in local development with zero security risk in production environments.

---

## ADR-007: Test Database Path Redirection and Vitest Isolation
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Vitest integration tests created test users, teams, and missions directly inside `backend/data/sidequest.db`, leaving residual records that contaminated the dev database.
- **Decision**: Configured `vitest.config.ts` and `backend/tests/global-setup.ts` to redirect `DATABASE_PATH` to `backend/data/test-suite.db`, running tests with `fileParallelism: false`. Added an explicit cleanup script `backend/scripts/clean-test-data.ts` to safely sanitize leftover test fixtures without touching real user data.
- **Consequences**: Zero test bleed into the development SQLite database.

---

## ADR-008: Scoped BinaryBombers 3D Frontend & Pixel-Preserved Canvas Board
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: The project setup experience required direct integration of the actual BinaryBombers 3D animated starfield, floating wireframe tech blocks, and iridescent distorting orb from `D:\Projects\binary\Binary-main\React-Frontend`. However, ThreadBack's existing Canvas Board relies on a clean, light, white background (`#ffffff` / `#f8fafc` / `#f1f3f6`) with a subtle dotted grid (`#cbd5e1`), sidebar, floating toolbar, and bottom prompt dock that must NOT be visually compromised.
- **Decision**:
  1. Directly copied the Three.js and `@react-three/fiber` components (`Background3D.tsx`, `ThreeCanvas.tsx`) and hero asset (`hero.png`).
  2. Encapsulated the entire 3D animated setup experience inside `ProjectSetupPage.tsx` under a scoped CSS class `.binary-setup-page`.
  3. Reverted global `html, body` styles in `index.css` to `#f8fafc` and `'Plus Jakarta Sans'`, preventing global bleed.
  4. Preserved the white card background (`bg-white rounded-3xl border border-slate-200/90`) and subtle gray dotted grid on the Canvas Board at all times.
- **Consequences**: Full fidelity to the original BinaryBombers 3D visual animation during onboarding/setup, while completely preserving ThreadBack's existing Canvas Board aesthetics.

---

## ADR-009: Entity Hierarchy (Team -> Project -> Mission) with Non-Destructive Migrations
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: The setup flow required project creation (`Create Project`), but ThreadBack historically treated missions as top-level workspace anchors. We needed a clean representation of projects without breaking existing missions, conversations, decisions, or database tables.
- **Decision**:
  1. Introduced a new `projects` table (id, name, description, team_id, user_id, github_repo, status, created_at, updated_at).
  2. Idempotently added `project_id` to the existing `missions` table using `PRAGMA table_info` migration check.
  3. Linked missions to their parent project while maintaining backwards compatibility (existing missions with `project_id IS NULL` remain fully operational).
  4. Added dedicated repository `project.repo.ts`, validation schemas `project.schema.ts`, and controller `project.controller.ts` with comprehensive authorization guards.
- **Consequences**: Full support for projects and team-scoped project workspaces with zero regressions or data loss.



---

## ADR-010: AES-256-GCM Encrypted Token Storage
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Phase 2 integrates GitHub Personal Access Tokens and OAuth credentials. Storing tokens in plaintext is unacceptable for security and compliance.
- **Decision**: Implemented `encryptToken` and `decryptToken` using native Node.js `crypto.createCipheriv('aes-256-gcm', key, iv)`. Tokens are stored in SQLite as ciphertext with a random 12-byte IV and 16-byte authentication tag. Decryption occurs strictly on the backend when dispatching external requests to GitHub API.
- **Consequences**: Zero plaintext token exposure; verified by `tests/github.test.ts`.

---

## ADR-011: Source C Frontend Integration & Projects Hub
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: The updated UI (`mainfrontendui.zip`) introduced a modern Projects & GitHub hub, Generated Nodes RFC drawer, dual-agent chat enhancements, and keyboard shortcuts (`Cmd+1`, `Cmd+2`).
- **Decision**: Integrated `ProjectsModal.tsx` as a unified workspace hub and `GeneratedNodesDrawer.tsx` for quick node inspection without altering ThreadBack's existing Canvas Board light aesthetics (`#f8fafc`, `#cbd5e1`). Connected all UI controls to actual ThreadBack API client methods and Zustand store.
- **Consequences**: Cohesive modern design with 100% functional controls and zero broken mock placeholders.

---

## ADR-012: Resilient Repository Analysis and Architecture Drift Detection
- **Date**: 2026-10-23
- **Status**: Accepted & Implemented
- **Context**: Technical exploration requires deep repository inspection and tracking whether implementation diverges from agreed team decisions.
- **Decision**: Implemented `RepoAnalysisService` with live GitHub inspection and deterministic synthesis fallback for reference repositories (`codecrafters-io/build-your-own-x`). Implemented `DriftDetectionService` comparing repository architecture against `shared_decisions` stored in SQLite.
- **Consequences**: Fast, robust architectural analysis and drift detection verified by automated tests.

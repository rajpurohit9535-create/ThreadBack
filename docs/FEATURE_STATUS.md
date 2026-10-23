# Feature Status & Implementation Tracker — ThreadBack

## Status Legend
- ✅ **Implemented & Verified**: Code written, verified by unit/integration tests and production builds.
- 🟡 **Partially Implemented**: Core backend/frontend logic present; future extensions planned.
- ⏳ **Planned (Phase 2+)**: Explicitly deferred out of current phase scope.

---

## 1. Feature Status Matrix

| Feature | Status | Implementation Files | Tests / Verification |
| :--- | :---: | :--- | :--- |
| **User Registration** | ✅ | `backend/src/controllers/auth.controller.ts`, `backend/src/utils/auth.ts`, `frontend/src/components/AuthModal.tsx` | `tests/auth.test.ts` (pass) |
| **Password Hashing (scrypt)** | ✅ | `backend/src/utils/auth.ts` | `tests/auth.test.ts` (pass) |
| **Signed Bearer Tokens** | ✅ | `backend/src/utils/auth.ts`, `backend/src/middleware/auth.ts` | `tests/auth.test.ts` (pass) |
| **Auth Rate Limiting** | ✅ | `backend/src/middleware/rate-limit.ts` | Verified 15 req/min |
| **Session Restoration** | ✅ | `frontend/src/store/canvasStore.ts` (`checkAuthSession`) | Verified page refresh flow |
| **Team Creation** | ✅ | `backend/src/controllers/team.controller.ts`, `backend/src/db/repositories/team.repo.ts` | `tests/teams-and-permissions.test.ts` |
| **Invite Tokens (7-day link)** | ✅ | `backend/src/db/repositories/team.repo.ts`, `frontend/src/components/TeamManagementModal.tsx` | `tests/teams-and-permissions.test.ts` |
| **Accepting Invitations** | ✅ | `backend/src/routes/team.routes.ts`, `frontend/src/store/canvasStore.ts` | `tests/teams-and-permissions.test.ts` |
| **Role Enforcement (owner/admin/member)** | ✅ | `backend/src/middleware/auth.ts` (`requireTeamRole`) | `tests/teams-and-permissions.test.ts` |
| **Leaving / Removing Members** | ✅ | `backend/src/controllers/team.controller.ts` | `tests/teams-and-permissions.test.ts` |
| **Shared Missions** | ✅ | `backend/src/db/repositories/mission.repo.ts`, `frontend/src/store/canvasStore.ts` | `tests/teams-and-permissions.test.ts` |
| **Cross-Team Access Guard (403)** | ✅ | `backend/src/controllers/mission.controller.ts` | `tests/teams-and-permissions.test.ts` |
| **Personal Mission Isolation** | ✅ | `backend/src/controllers/mission.controller.ts` | `tests/teams-and-permissions.test.ts` |
| **Legacy Mission Claim / Share** | ✅ | `backend/src/db/repositories/mission.repo.ts` (`claimMission`, `shareMissionWithTeam`) | Verified endpoint & repo methods |
| **Shared Decisions Attribution** | ✅ | `backend/src/db/repositories/decision.repo.ts`, `frontend/src/components/DecisionsModal.tsx` | `tests/teams-and-permissions.test.ts` |
| **Attributed Messages in Shared Chat** | ✅ | `backend/src/db/repositories/message.repo.ts`, `frontend/src/components/SideChatDrawer.tsx` | Tested message author metadata |
| **Main AI Decision Injection** | ✅ | `backend/src/prompts/main-ai.prompt.ts`, `backend/src/services/main-ai.service.ts` | `tests/context-sharing.test.ts` |
| **SideQuest Context Synthesis** | ✅ | `backend/src/services/return-to-mission.service.ts` | `tests/return-to-mission.test.ts` |
| **Predefined Data Removal & Zero-Seed** | ✅ | `frontend/src/store/canvasStore.ts`, `backend/src/db/repositories/mission.repo.ts` | Verified clean DB & empty initial state |
| **Empty Workspace View** | ✅ | `frontend/src/components/canvas/EmptyWorkspaceView.tsx`, `FlowCanvas.tsx` | Clean project creation CTA |
| **Developer Mock User Switcher** | ✅ | `frontend/src/components/DevUserSwitcher.tsx`, `backend/src/controllers/auth.controller.ts` | Gated by `DEV` / non-prod, tested switching |
| **Test DB Isolation** | ✅ | `backend/vitest.config.ts`, `backend/tests/global-setup.ts` | Redirects tests to `test-suite.db` |
| **Canvas Board Visual Engine** | ✅ | `frontend/src/components/canvas/FlowCanvas.tsx` | ReactFlow verified |
| **Real Collaboration Polling** | ✅ | `frontend/src/store/canvasStore.ts` (`pollMissionUpdates`) | 4s interval polling |
| **Project Creation & Setup Wizard** | ✅ | `frontend/src/components/binary/ProjectSetupPage.tsx`, `backend/src/controllers/project.controller.ts` | `tests/project.test.ts` (9 tests) |
| **BinaryBombers 3D Background Reuse** | ✅ | `frontend/src/components/binary/Background3D.tsx`, `frontend/src/components/binary/ThreeCanvas.tsx` | Production build verified |
| **Canvas Board Visual Preservation** | ✅ | `frontend/src/components/canvas/FlowCanvas.tsx`, `frontend/src/index.css` | Light theme `#f8fafc`/`bg-white` preserved |
| **GitHub Integration Status Reporting** | ✅ | `backend/src/controllers/project.controller.ts`, `ProjectSetupPage.tsx` | Honest unconfigured status |
| **GitHub Connection (AES-256-GCM)** | ✅ | `backend/src/services/github.service.ts`, `backend/src/db/repositories/github.repo.ts`, `backend/src/utils/crypto.ts` | `tests/github.test.ts` (6 tests) |
| **Live Repository Selection & Disconnect** | ✅ | `backend/src/controllers/github.controller.ts`, `frontend/src/components/ProjectsModal.tsx` | `tests/github.test.ts` |
| **Repository Code & Architecture Analysis** | ✅ | `backend/src/services/repo-analysis.service.ts`, `frontend/src/components/ProjectsModal.tsx` | `tests/repo-analysis.test.ts` (4 tests) |
| **Architecture Drift Detection** | ✅ | `backend/src/services/drift-detection.service.ts` | `tests/drift-detection.test.ts` (3 tests) |
| **Project & Repo Feedback System** | ✅ | `backend/src/db/repositories/feedback.repo.ts`, `frontend/src/components/ProjectsModal.tsx` | `tests/github.test.ts`, `tests/repo-analysis.test.ts` |
| **Generated Nodes RFC Drawer (Source C)** | ✅ | `frontend/src/components/canvas/GeneratedNodesDrawer.tsx`, `frontend/src/components/trido/TridoNavbar.tsx` | Build & UI verified (Cmd+1) |
| **Projects & GitHub Hub Modal** | ✅ | `frontend/src/components/ProjectsModal.tsx`, `frontend/src/App.tsx` | Build & UI verified |
| **Source C Navbar & Dual-Agent Dock Upgrades** | ✅ | `frontend/src/components/trido/TridoNavbar.tsx`, `frontend/src/components/SideChatDrawer.tsx` | Build & UI verified (Cmd+2) |
| **Docker Sandbox Execution** | ⏳ | Phase 3 | Explicitly deferred |
| **Real-time WebSockets / SSE** | ⏳ | Phase 3 (Polling meets Phase 1/2 requirements) | Deferred in favor of 4s polling |

---

## 2. Test Suite Status
- **17 Vitest Test Suites**: 145 passed tests.
  - `tests/github.test.ts` (6 tests): AES-256-GCM token encryption, status check, repository listing, disconnect, simulated revocation, and feedback creation.
  - `tests/repo-analysis.test.ts` (4 tests): Live repository analysis for `codecrafters-io/build-your-own-x`, component breakdown, architecture patterns, and key takeaways.
  - `tests/drift-detection.test.ts` (3 tests): Architecture drift scoring, decision divergence detection, and mock context analysis.
  - `tests/project.test.ts` (9 tests): Project creation, team associations, multi-user invitations, cross-team security guard, mission linking, and GitHub status.
  - `tests/mock-auth-and-isolation.test.ts` (11 tests): Fresh user zero-seed, personal mission isolation, cross-team security, ghost user rejection, dev switcher token issuance.
  - `tests/teams-and-permissions.test.ts` (9 tests): Multi-user team workflows and membership roles.
  - `tests/auth.test.ts` (7 tests): Scrypt hashing, rate limiting, token issuance, session restoration.
  - `tests/db.test.ts` (10 tests): SQLite schema, idempotent columns, migrations.
  - `tests/mission.routes.test.ts` (9 tests): Mission CRUD and ownership.
  - `tests/api.routes.test.ts` (7 tests): API routing and error handling.
  - `tests/context-sharing.test.ts` (6 tests): Decision injection into Main AI context.
  - `tests/sidequest.routes.test.ts` (7 tests): SideQuest node creation and branch queries.
  - `tests/return-to-mission.test.ts` (9 tests): Synthesis and Return to Mission decisions.
  - `tests/main-ai.service.test.ts` (7 tests): Dual-agent prompt synthesis.
  - `tests/sidequest.service.test.ts` (8 tests): Branch summarization.
  - `tests/sidequest.schema.test.ts` (17 tests): Zod validation.
  - `tests/chat.schema.test.ts` (16 tests): Schema validation.

---

## 3. Known Limitations & Environment Requirements
1. **Email Service**: Simulated/link-based in development. Production deployment requires SMTP or SendGrid/Postmark credentials configured for automated emails.
2. **AI API Key**: Requires `GEMINI_API_KEY` in `backend/.env` for Gemma 4 AI responses. If omitted, the server boots safely and returns descriptive configuration warnings without crashing.
3. **Database**: SQLite WAL mode supports high concurrent read operations. Multi-node clusters in future phases would migrate to PostgreSQL using the existing repository abstraction.

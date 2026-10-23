# AGENTS.md — ThreadBack Engineering Guide for Coding Agents

## 1. Product Vision & Architectural Rules
ThreadBack is an AI-powered mission workspace with dedicated SideQuests and context-guarding memory. It prevents developers and engineering teams from losing context when exploring technical tangents.

### Core Architectural Rules
1. **Context & Account Isolation**: Main AI conversations, SideQuests, personal missions, and shared team missions are isolated. Teammates' private conversations must never be automatically exposed to team members. Different mock accounts must see strictly their own missions and shared team missions.
2. **Zero Automatic Predefined Data**: Do NOT automatically inject sample users (Alice, Bob), missions, conversations, decisions, or Canvas Board nodes during app startup. A fresh account must begin with an empty personal workspace ("No projects yet").
3. **Explicit Decision Approval**: Only explicitly approved decisions/findings enter team-shared mission memory. The Main AI prompt receives only approved shared decisions and bounded SideQuest summaries, never everyone's full unapproved chat history.
4. **Attribution & Timestamps**: Every shared decision, message, and contribution records its author identity (`userId`, `userName`) and timestamp.
5. **Refactor-Before-Adding**: Always inspect and reuse existing entities, repositories, and routes before introducing new abstractions. Never create duplicate models or endpoints.
6. **Idempotent Non-Destructive Migrations**: The SQLite database (`backend/data/sidequest.db`) must preserve existing data. Migrations use idempotent checks and never drop or wipe existing tables. Vitest test suites MUST run against isolated `data/test-suite.db` and never write to `sidequest.db`.
7. **No Phantom Work**: Do not claim that an AI feature or external integration executed unless established by verified code execution and tests. GitHub connections remain labeled as Phase 2.
8. **Document & Test**: Every agent modifying code must update tests, run typecheck, and keep `docs/` synchronized.

---

## 2. Technology Stack & Repository Map

### Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, @xyflow/react.
- **Backend**: Node.js, Express 5, TypeScript, Better-SQLite3, Zod.
- **AI Inference**: `@google/genai` with Gemma 4 (`gemma-4-26b-a4b-it`) via Gemini API.
- **Authentication**: Native Node.js `crypto` (`scryptSync` salted password hashing, HMAC-SHA256 signed bearer tokens, in-memory rate limiting).

### Repository Map
```
ThreadBack/
├── AGENTS.md                      # Agent rules, workflows, commands
├── docs/
│   ├── ARCHITECTURE.md            # Data flow, schema, auth, memory model
│   ├── FEATURE_STATUS.md          # Implementation tracker and known gaps
│   ├── WORKFLOWS.md               # User & team lifecycle walkthroughs
│   └── DECISIONS.md               # Architecture decision records
├── backend/
│   ├── data/                      # Persistent SQLite DB (sidequest.db)
│   ├── src/
│   │   ├── config/env.ts          # Environment variables & AI config status
│   │   ├── controllers/           # auth, team, project, mission, ai, github controllers
│   │   ├── db/
│   │   │   ├── database.ts        # Database connection & WAL mode
│   │   │   ├── schema.ts          # Schema DDL & idempotent column migrations
│   │   │   └── repositories/      # user, team, project, mission, conversation, message, memory, decision, github, feedback
│   │   ├── lib/gemma-client.ts    # Google GenAI Gemma caller
│   │   ├── middleware/            # auth (optionalAuth, requireAuth), rate-limit, error-handler
│   │   ├── prompts/               # main-ai.prompt, sidequest.prompt
│   │   ├── routes/                # auth, team, project, mission, conversation, ai, github routes
│   │   ├── schemas/               # zod validation schemas (project, mission, chat, sidequest, github)
│   │   ├── services/              # main-ai, sidequest, return-to-mission, github, repo-analysis, drift-detection
│   │   └── utils/                 # auth (scrypt & JWT HMAC), crypto (AES-256-GCM), api-error
│   └── tests/                     # 17 vitest test suites covering auth, teams, projects, memory, db, isolation, github, repo-analysis, drift-detection
└── frontend/
    ├── src/
    │   ├── api/client.ts          # Typed fetch client with Bearer auth token injection
    │   ├── components/            # AuthModal, TeamManagementModal, DecisionsModal, SideChatDrawer, DevUserSwitcher, ProjectsModal
    │   │   ├── binary/            # ProjectSetupPage, Background3D, ThreeCanvas (copied from BinaryBombers)
    │   │   ├── canvas/            # FlowCanvas, EmptyWorkspaceView, GeneratedNodesDrawer
    │   │   └── trido/             # TridoNavbar, TridoSidebar, TridoBottomBar
    │   ├── store/canvasStore.ts   # Unified Zustand store with 4s collaboration polling & state reset
    │   └── types/index.ts         # User, Team, Project, Mission, QNode, SharedDecision interfaces
```

---

## 3. Authentication, Authorization & Privacy Rules
- **Authentication**: JWT-compatible signed tokens with HMAC-SHA256. Passwords hashed using `scrypt` with 16-byte random salt.
- **Mock Account Isolation & Dev Switcher**:
  - Registration accepts any valid email format and password, rejecting duplicates.
  - No public demo profile quick-buttons in production login forms.
  - A development-only `DevUserSwitcher` component (`import.meta.env.DEV` & `NODE_ENV !== 'production'`) allows testing multi-user collaboration by listing registered mock accounts from `GET /api/auth/dev-users` and issuing new tokens via `POST /api/auth/dev-switch`.
  - Switching accounts immediately purges the active mission, canvas nodes, in-flight polling timers, and loads strictly the new account's data.
- **Authorization**:
  - Team-owned missions (`teamId !== null`) strictly require authentication and active membership in that team. Cross-team ID guessing returns `403 Forbidden`.
  - Personal missions assigned to a user (`userId !== null`) are private to that user. Teammates cannot access them unless explicitly shared via `POST /api/missions/:id/share-with-team`.
  - Team invitations use 24-byte cryptographically secure tokens expiring in 7 days.
- **Rate Limiting**: `authRateLimiter` enforces max 15 requests/minute per IP on `/api/auth/register` and `/api/auth/login`.

---

## 4. Development, Test, Typecheck & Build Commands

### Backend Commands (run in `backend/` or with `npm --prefix backend`)
- Dev server: `npm --prefix backend run dev`
- Typecheck: `npm --prefix backend run typecheck`
- Test suite: `npm --prefix backend test`
- Build: `npm --prefix backend run build`

### Frontend Commands (run in `frontend/` or with `npm --prefix frontend`)
- Dev server: `npm --prefix frontend run dev`
- Typecheck & Build: `npm --prefix frontend run build`

### Root Commands
- Run both: `npm run dev`
- Build all: `npm run build`
- Typecheck all: `npm run typecheck`
- Test all: `npm run test`

---

## 5. Instructions for Future Coding Agents
1. **Targeted Inspection**: Do NOT execute blind full-repository search or dump entire files. Read `AGENTS.md` and `docs/FEATURE_STATUS.md` first. Inspect only the files related to your specific task.
2. **Never Break Tests**: Always execute `npm --prefix backend test` and `npm --prefix frontend run build` before claiming completion.
3. **Update Documentation**: When adding or modifying endpoints, tables, or store actions, update `docs/ARCHITECTURE.md` and `docs/FEATURE_STATUS.md`.

# THREADBACK — Backend (Phase 1 to Phase 4: Return to Mission & Context Sharing)

The backend service for **ThreadBack**, an AI-powered mission workspace that helps users complete complex objectives without losing focus by offering dedicated exploratory **SideQuests** alongside their primary mission.

This service is built using Node.js, Express, TypeScript, SQLite (`better-sqlite3`), and Google's official `@google/genai` SDK targeting hosted Gemma instruction-tuned models via the Gemini API (defaulting to `gemma-4-26b-a4b-it`).

---

## 1. Features & Capabilities

- **Return to Mission & Context Transfer (Phase 4)**:
  - `POST /api/conversations/:id/return-to-mission`: Synthesizes a structured technical learning summary from a SideQuest transcript using Gemma, stores it in `sidequest_memories`, merges decisions into `mission_memories`, and prepares it for context transfer.
  - **Context Sharing without History Pollution**: Transfers concise, structured SideQuest learnings (`[RELEVANT SIDEQUEST LEARNINGS]`) into the Main AI system context on the subsequent turn, while keeping raw message histories strictly segregated.
  - **Bounded & Deduplicated Context**: Bounded context injection (at most 2 most recent completed summaries) and automated incorporation tracking (`is_incorporated`) prevents bloating prompts or repeatedly injecting identical summary blocks across subsequent turns.
- **SQLite Database Persistence (Phase 3)**: High-performance, zero-external-dependency local database powered by `better-sqlite3` stored at `backend/data/sidequest.db`.
- **Atomic Mission & Conversation Management**:
  - `POST /api/missions`: Atomically creates a mission and its primary main conversation.
  - `GET /api/missions`: Lists recent missions.
  - `GET /api/missions/:id`: Retrieves a mission together with all its conversations.
  - `POST /api/missions/:id/sidequests`: Creates a dedicated SideQuest linked to an existing mission.
  - `GET /api/conversations/:id/messages`: Retrieves complete conversation history in chronological order.
- **Persistent AI Conversation Mode**:
  - `POST /api/ai/chat`: Continues a persistent Main conversation by passing `conversationId` and `message`. Authoritative history is loaded from SQLite.
  - `POST /api/ai/sidequest/chat`: Continues a persistent SideQuest conversation by passing `conversationId` and `message`.
- **Backward-Compatible Stateless AI Mode**: Existing clients can continue sending stateless payloads with `missionObjective` and `messages`.
- **Sliding Context Window**: Gemma requests receive a recent-turn window (default 30 messages) to preserve prompt token efficiency while keeping full history in SQLite.
- **Strict History Isolation**: Main AI and SideQuest AI histories and system prompts remain strictly segregated.
- **Failure Resilience**: If AI generation fails, no fabricated assistant responses or invalid summaries are persisted, and orphaned user messages are rolled back cleanly.
- **Real Hosted Inference**: Direct integration with Google GenAI using official SDK methods (`ai.models.generateContent`).
- **Health & Status Diagnostics**: Lightweight health check (`/api/health`) and configuration status (`/api/ai/status`).

---

## 2. End-to-End User Workflow

```
1. User chats with Main AI
   (POST /api/ai/chat with conversationId)
   └─ Main AI assists with mission objective.
       │
2. User starts & explores a SideQuest
   (POST /api/missions/:id/sidequests -> POST /api/ai/sidequest/chat)
   └─ SideQuest AI focuses exclusively on the subtopic.
       │
3. User completes exploration & calls Return to Mission
   (POST /api/conversations/:sidequestId/return-to-mission)
   └─ Gemma synthesizes structured learning summary.
   └─ Saved to sidequest_memories; decisions merged into mission_memories.
       │
4. Main AI continues the mission with transferred context
   (POST /api/ai/chat with mainConversationId)
   └─ Main AI prompt receives [RELEVANT SIDEQUEST LEARNINGS] and [MISSION MEMORY].
   └─ Raw SideQuest transcript is NOT merged into Main AI message rows.
   └─ Summary marked incorporated; subsequent turns avoid duplicate summary injection.
```

---

## 3. Database Choice & Architecture

### Library: `better-sqlite3`
- **Synchronous Execution**: Eliminates async overhead and event loop delays for local disk operations.
- **Type-safe & Stable**: Robust TypeScript definitions and actively maintained.
- **Full Foreign Key Support**: SQLite foreign keys enforced via `PRAGMA foreign_keys = ON`.
- **WAL Mode & Concurrency**: Configured with `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000` to prevent database locks.
- **Automatic Directory & Schema Initialization**: The `data/` directory is created automatically on startup, and the schema is applied idempotently (`CREATE TABLE IF NOT EXISTS`, idempotent column migrations).

### Local Database Path
- **File path**: `backend/data/sidequest.db` (relative to the project root).
- **Git-ignored**: `data/`, `backend/data/` and all SQLite database, journal, WAL, and shared-memory files (`*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`) are excluded from Git in `.gitignore`.

---

## 4. Database Schema

```
missions (1) ────< conversations (1..*)
                      │
                      ├── type = 'main' (exactly 1 per mission)
                      └── type = 'sidequest' (0..* per mission)
                      │
                      ├──< messages (1..*)
                      │
                      └──< sidequest_memories (0..1 per sidequest conversation)

missions (1) ────< mission_memories (0..1 per mission)
```

### 1. `missions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Mission UUID. |
| `objective` | `TEXT` | `NOT NULL` | The user's primary goal. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'` | Mission status (`active`, `completed`, `archived`). |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp. |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 update timestamp. |

### 2. `conversations`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Conversation UUID. |
| `mission_id` | `TEXT` | `NOT NULL REFERENCES missions(id) ON DELETE CASCADE` | Associated mission ID. |
| `type` | `TEXT` | `NOT NULL CHECK(type IN ('main', 'sidequest'))` | Conversation type. |
| `topic` | `TEXT` | `NULL` | SideQuest topic name (NULL for main). |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp. |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 update timestamp. |

### 3. `messages`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Message UUID. |
| `conversation_id`| `TEXT` | `NOT NULL REFERENCES conversations(id) ON DELETE CASCADE` | Associated conversation ID. |
| `role` | `TEXT` | `NOT NULL CHECK(role IN ('user', 'assistant'))` | Message role. |
| `content` | `TEXT` | `NOT NULL` | Exact raw message text. |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp. |

### 4. `mission_memories`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Memory UUID. |
| `mission_id` | `TEXT` | `NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE` | Associated mission ID (1:1). |
| `summary` | `TEXT` | `NOT NULL DEFAULT ''` | High-level mission summary. |
| `progress` | `TEXT` | `NOT NULL DEFAULT ''` | Progress description or metric. |
| `decisions` | `TEXT` | `NOT NULL DEFAULT '[]'` | JSON array of key architectural decisions. |
| `blockers` | `TEXT` | `NOT NULL DEFAULT '[]'` | JSON array of active blockers. |
| `next_step` | `TEXT` | `NOT NULL DEFAULT ''` | Immediate next milestone. |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 update timestamp. |

### 5. `sidequest_memories`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Memory UUID. |
| `conversation_id`| `TEXT` | `NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE` | Associated SideQuest conversation ID (1:1). |
| `learning_summary`| `TEXT` | `NOT NULL DEFAULT ''` | Serialized structured `SideQuestLearningSummary` JSON. |
| `unresolved_questions` | `TEXT` | `NOT NULL DEFAULT '[]'` | JSON array of pending open questions. |
| `is_incorporated`| `INTEGER`| `NOT NULL DEFAULT 0` | Flag (0 or 1) tracking context transfer to Main AI. |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 update timestamp. |

---

## 5. Prerequisites & Installation

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Google Gemini API Key**: An active API key with access to Gemini API models.

```bash
npm install
cp .env.example .env
```

Ensure `GEMINI_API_KEY` is set in `.env`:
```env
PORT=4000
GEMINI_API_KEY=your_actual_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
CORS_ORIGIN=http://localhost:3000
```

---

## 6. Running the Application

### Development Mode (with hot-reload)
```bash
npm run dev
```

### Production Build & Start
```bash
npm run build
npm start
```

### Type Checking & Test Suite
```bash
npm run typecheck
npm test
```

### Live Phase 4 Verification Script
```bash
npx tsx scripts/verify-phase4.ts
```

---

## 7. API Endpoints

### Return to Mission & Context Sharing

#### `POST /api/conversations/:id/return-to-mission`
Synthesizes the SideQuest into a structured learning summary and prepares it for context transfer to the Main AI.

- **URL Parameter**: `:id` (UUID of the SideQuest conversation).
- **Success Response (`200 OK`)**:
  ```json
  {
    "summary": {
      "topic": "JWT Authentication Middleware in Go",
      "keyLearnings": [
        "Middleware in Go uses the 'Wrapper' pattern: func(http.Handler) http.Handler.",
        "The Factory Signature pattern allows safe configuration injection.",
        "Request context (r.WithContext) passes user identity to downstream handlers."
      ],
      "decisions": [
        "Use Factory Signature pattern for middleware.",
        "Utilize 'github.com/golang-jwt/jwt/v5' library."
      ],
      "usefulExamples": [
        "func AuthMiddleware(secret []byte) func(http.Handler) http.Handler"
      ],
      "unresolvedQuestions": [],
      "missionRelevance": "Provides the authentication layer for securing CRUD API routes."
    },
    "missionId": "21bcc7f6-99d1-491b-bcb5-a12dbf2460f9",
    "mainConversationId": "15c58f23-3b88-414b-aba1-664898a30c9d",
    "sideQuestConversationId": "034722a0-eaa4-4d17-9539-9199928a5eba"
  }
  ```

---

### Main AI Chat

#### `POST /api/ai/chat`
Continues the main mission conversation. Automatically includes relevant SideQuest learnings in prompt context without mutating message history.

- **Request Body (Persistent Mode)**:
  ```json
  {
    "conversationId": "15c58f23-3b88-414b-aba1-664898a30c9d",
    "message": "Now that we decided on JWT middleware, let's wire it up to our protected routes."
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "reply": "To wire up authentication, integrate the JWT Middleware (which you've already designed) into your Router...",
    "conversationId": "15c58f23-3b88-414b-aba1-664898a30c9d",
    "missionId": "21bcc7f6-99d1-491b-bcb5-a12dbf2460f9"
  }
  ```

---

### SideQuest AI Chat

#### `POST /api/ai/sidequest/chat`
Explores an unfamiliar technical concept in an isolated conversation.

- **Request Body (Persistent Mode)**:
  ```json
  {
    "conversationId": "034722a0-eaa4-4d17-9539-9199928a5eba",
    "message": "Explain how to implement a JWT authentication middleware in Go."
  }
  ```

---

### Mission & Conversation Management

- `POST /api/missions`: Creates mission and main conversation.
- `GET /api/missions`: Lists recent missions.
- `GET /api/missions/:id`: Retrieves mission with its main and sidequest conversations.
- `POST /api/missions/:id/sidequests`: Creates a SideQuest conversation linked to a mission.
- `GET /api/conversations/:id/messages`: Retrieves chronological message history.

---

## 8. Automated Test Suite

Vitest executes **96 automated tests** across 10 test suites:

- `tests/return-to-mission.test.ts`: Synthesis generation, empty/insufficient history fallback, invalid IDs, provider failure guard, decision merging.
- `tests/context-sharing.test.ts`: Context transfer into Main AI, strict history isolation, deduplication across turns, bounded context limits, HTTP routes.
- `tests/db.test.ts`: Atomic transactions, uniqueness constraints, foreign-key enforcement, sliding context window, reconnection persistence.
- `tests/mission.routes.test.ts`: REST endpoints for missions, sidequests, and chronological message retrieval.
- `tests/main-ai.service.test.ts`: Main AI orchestration, persistent chat turns, provider failure rollback, ID mismatch validation.
- `tests/sidequest.service.test.ts`: SideQuest prompt injection, persistent chat turns, provider failure rollback, history isolation.
- `tests/api.routes.test.ts`: HTTP status codes, health checks, route validation, error envelopes.
- `tests/sidequest.routes.test.ts`: SideQuest route validation, 404/400 handling.
- `tests/chat.schema.test.ts`: Main AI schema validation for stateless and persistent payloads.
- `tests/sidequest.schema.test.ts`: SideQuest schema validation for stateless and persistent payloads.

Run tests:
```bash
npm test
```

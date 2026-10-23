# ThreadBack — Complete Workflow

> **Stay focused on the mission. Explore anything. Bring back only what matters.**

---

## 1. What ThreadBack does

ThreadBack is a collaborative AI development platform where each teammate can explore ideas independently using a personal sub-agent, while the Main Agent maintains the shared project context and coordinates the team's overall direction.

The goal is to let teammates investigate different topics without flooding the Main Agent with every message, while preserving important findings, decisions, and context for the entire team.

---

## 2. Complete workflow

### 1. Create a workspace and project
A user creates a project, invites teammates, and connects the GitHub repository they want to work on (`https://github.com/owner/repository`). The project becomes the shared workspace for team activity, code understanding, decisions, and AI-assisted development.

- Project setup includes a 3-step guided flow: **Project Details → Invite Teammates → Connect GitHub Repository**.
- The repository URL is validated on both client and server, stored in SQLite (`projects.github_repo`), and authoritatively associated with the project.
- Multiple projects maintain distinct, isolated repository associations when switching or reopening.

### 2. Each teammate works independently
Every teammate can interact with their own SideQuest sub-agent. They can ask questions, investigate technologies, explore implementation approaches, debug problems, or research a specific part of the project.

For example, one teammate investigates database architecture, another explores authentication, and another studies API performance. Each SideQuest conversation maintains its own history, so one teammate's investigation does not automatically become part of another teammate's conversation.

### 3. Why use sub-agents?
A teammate may need dozens of messages to investigate a problem. Sending every message directly to the Main Agent would consume context, introduce irrelevant details, and mix unrelated investigations.

The sub-agent handles the detailed exploration locally. It helps the teammate understand the topic, develop an approach, and identify useful findings. Only relevant outcomes need to be incorporated into the shared project context.

### 4. The teammate returns important findings
When the teammate finishes an investigation, ThreadBack's **Return to Mission** workflow brings the SideQuest findings back into the main project context.

The system uses the conversation to identify relevant conclusions, technical findings, proposed solutions, and decisions. These are stored as SideQuest and mission memories, with incorporation tracked so the system can distinguish findings that have been integrated from those that have not.

The purpose is to preserve useful knowledge without transferring the entire investigation into the Main Agent's context.

### 5. The Main Agent coordinates the project
The Main Agent serves as the central AI for the shared project. It uses the available project context, incorporated memories, and team decisions to help teammates understand the current direction and make consistent decisions.

For example, if one teammate establishes that the project uses SQLite and another investigates authentication, the Main Agent can use those incorporated findings when helping with a new implementation task.

The Main Agent is not simply another personal chatbot: it is the shared coordination point for project-level reasoning. Its usefulness depends on the quality and freshness of the information incorporated into the project.

### 6. Shared decisions and project memory
Important decisions and conclusions become part of the project's persistent context rather than remaining buried in individual conversations.

This helps teammates understand why a particular approach was chosen, avoid repeating investigations, and work from a more consistent understanding of the project.

Individual SideQuest histories remain separate from the Main Agent's conversation history. Findings are incorporated through the explicit return workflow rather than silently merging all conversations.

### 7. GitHub and repository understanding
When a repository is connected, ThreadBack can use the repository integration to retrieve repository information and analyze the selected codebase, depending on the configured services and available credentials.

- **Repository Analysis**: Deep structural inspection covering top-level layout, file counts, programming languages, architectural overview, key subsystems, and engineering insights.
- **Project-Scoped Analysis**: Repository operations automatically resolve the active project's saved repository URL, eliminating hardcoded fallbacks.
- **User Feedback**: Engineers can submit evaluations (1–5 stars and comments) to build institutional knowledge on report accuracy.

### 8. The team continues building
As development progresses, teammates can create new SideQuests for unresolved questions, return important findings to the project, and use the Main Agent with the accumulated project context.

The cycle repeats:
- Investigate independently.
- Extract useful findings.
- Incorporate important knowledge into the shared project.
- Coordinate through the Main Agent.
- Continue development with better context.

---

## 3. Why both agents are necessary

| SideQuest sub-agent | Main Agent |
| :--- | :--- |
| Focuses on one teammate's specific investigation | Focuses on the shared project |
| Maintains its own conversation history | Uses available project-wide context and incorporated findings |
| Supports detailed exploration and follow-up questions | Helps coordinate decisions and maintain consistency |
| Keeps exploratory details separate | Uses relevant conclusions from multiple investigations |
| Returns useful findings through the incorporation workflow | Uses incorporated findings to guide subsequent work |

---

## 4. The central idea

SideQuest is where teammates think deeply about individual problems. The Main Agent is where the project brings together the important knowledge from those investigations.

ThreadBack is designed to combine independent exploration with shared project intelligence, reducing duplicated effort and context overload while helping teammates make consistent decisions.

The key distinction is that a sub-agent's entire conversation does not automatically become shared knowledge. The return-and-incorporation workflow is what connects individual investigations to the team's evolving project context.

---

## 5. Architectural Drift Detection & Main AI Decisions

A critical question in collaborative AI development is: **Does repository analysis detect if code implementation is drifting from decisions made in the Main AI?**

**Yes.** ThreadBack integrates Main AI decisions directly into drift analysis:

1. **Context Extraction**: When drift detection runs for a project (`POST /api/github/drift-analysis` with `projectId`), the backend queries `shared_decisions` and mission objectives for that project.
2. **Decision Synthesis**: Approved decisions (agreed upon in the Main Agent or returned from SideQuests) form the authoritative charter for that evaluation.
3. **Drift Evaluation**: The repository's files, commit history, dependencies, and structure are verified against those exact decisions.
4. **Scoring & Remediations**: The system calculates a drift percentage score, classifies each decision (`NO_CONFLICT`, `CONFIRMED_CONFLICT`, `POSSIBLE_CONFLICT`, or `INCOMPLETE_IMPLEMENTATION`), cites concrete evidence, and proposes corrective action.

---

## 6. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, `@xyflow/react` |
| **Backend** | Node.js, Express 5, TypeScript, Better-SQLite3, Zod |
| **Database** | SQLite with WAL mode (`backend/data/sidequest.db`) |
| **AI Inference** | Google GenAI SDK (`@google/genai`) with Gemma 4 (`gemma-4-26b-a4b-it`) |
| **Security & Auth** | Node.js native `crypto` (`scryptSync` salted hashing, HMAC-SHA256 tokens, AES-256-GCM vault) |
| **Testing** | Vitest (18 test suites, 155 automated unit & integration tests) |

---

## 7. Quickstart & Commands

### One-Command Startup
Run both backend (`http://localhost:4000`) and frontend (`http://localhost:5173`) concurrently:
```bash
npm run dev
```

### Build & Typecheck
```bash
# Build full application
npm run build

# Typecheck backend and frontend
npm run typecheck
```

### Run Test Suite
Execute all 18 Vitest suites (155 tests) across auth, projects, teams, memory, GitHub, drift detection, and isolation:
```bash
npm test
```

---

## 8. License

This project is licensed under the terms of the [MIT License](LICENSE).
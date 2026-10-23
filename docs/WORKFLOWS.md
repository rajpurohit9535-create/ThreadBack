# User & Team Lifecycle Workflows — ThreadBack

## 1. Mock Registration & Login Workflow
1. User clicks **Sign In** in the top-right navbar or sidebar profile pill.
2. In `AuthModal`, user selects **Register** or **Sign In**.
   - Public demo profile quick-fill buttons have been removed to prevent accidental pollution.
   - Form validates email format (`user@example.com`) and required fields.
   - Shows simulated authentication notice (explaining this is an engineering prototype with secure local `scrypt` hashing and JWT-compatible HMAC-SHA256 tokens).
3. Submitting **Register** calls `POST /api/auth/register`, creating an isolated user account in SQLite.
4. Submitting **Sign In** calls `POST /api/auth/login`, verifying password hash and issuing a signed bearer token.
5. Frontend stores token in `localStorage` under `threadback_auth_token`.
6. On page refresh or app reload, `checkAuthSession` calls `GET /api/auth/me` with `Authorization: Bearer <token>`, restoring user profile and team memberships seamlessly.
7. Signing out clears token, stops polling timers, and clears all user-specific state.

---

## 2. BinaryBombers 3D Project Setup Experience
1. When a user creates a new project or enters setup mode:
   - Full-screen BinaryBombers 3D experience launches with rotating organic iridescent orb (`ThreeCanvas`) and 5,000-particle starfield with cursor parallax (`Background3D`).
   - Guided 3-step wizard with step navigation:
2. **Step 1: Project Details**:
   - Project Name (required) and Description (optional).
   - Team selector allowing choice between existing teams, Personal workspace, or inline creation of a new team.
3. **Step 2: Add Team Members**:
   - Multiple email addresses with role selection (`member` / `admin`).
   - Added invites are displayed as removable badge tags.
   - Clear simulated delivery notice; skippable step.
4. **Step 3: Connect GitHub**:
   - Live check to `GET /api/projects/github/status`.
   - Honest reporting: displays unconfigured status message if credentials are not configured, rather than generating fake repositories.
   - Skippable step.
5. **Completion**:
   - Clicks **Create Project & Open Canvas**.
   - Validates input, persists project and associated team invitations, and smoothly transitions into ThreadBack's existing pixel-consistent white Canvas Board.

---

## 3. Developer Mock User Switcher Workflow (Dev-Only)
1. In development mode (`import.meta.env.DEV`), authenticated users see a **Developer: Switch Mock User** selector in the top navigation bar.
2. The dropdown fetches registered mock users via `GET /api/auth/dev-users`.
3. Selecting a different mock user:
   - Calls `canvasStore.switchMockUser(targetUserId)`.
   - Halts any in-flight 4-second collaboration polling timers.
   - Immediately purges active mission, canvas nodes, decisions, and conversation history from memory.
   - Calls `POST /api/auth/dev-switch`, acquiring a valid signed token for the target user.
   - Stores the new token and initializes the new user's workspace cleanly without data leakage.

---

## 4. Team Creation & Invitation Workflow
1. User opens **Teams & Workspaces** from sidebar or top navbar workspace pill.
2. Under the **New Team** tab, user enters team name (e.g., "Acme Core Team") and clicks **Create Team & Workspace**.
3. Backend creates team and grants creator the `owner` role atomically.
4. User navigates to the **Invite** tab:
   - Selects role (`member` or `admin`).
   - Optionally enters teammate's email.
   - Clicks **Generate Secure Invite Link**.
5. Backend issues a cryptographically secure 24-byte hex token with a 7-day expiration timestamp (`expires_at`).
6. User copies the link (`http://localhost:5173?invite=<token>`).
7. Teammate opens link:
   - If not logged in, `AuthModal` prompts sign up.
   - Once authenticated, frontend calls `POST /api/invites/<token>/accept`.
   - Backend registers membership and switches teammate to the shared workspace.

---

## 5. Shared Missions & Collaboration Workflow
1. User creates a mission via **New Mission Thread**:
   - In `MissionModal`, user selects target workspace: **Personal Workspace** or **Team: Acme Core Team**.
2. If created in the team, the mission has `visibility = 'team'` and `team_id = <teamId>`.
3. All team members see the mission in their **Thread History** panel.
4. Team members open the shared mission canvas:
   - See the shared **Main AI Mission Anchor**.
   - See all shared **SideQuest** nodes on the board.
   - Background polling synchronizes messages and new branches every 4 seconds.
5. In chat, messages display author attribution (e.g., `Alice (Lead)` vs `Bob (Teammate)`).

---

## 6. Context Isolation & Decision Approval Workflow
1. A team member opens a SideQuest or clicks on the canvas to investigate a topic (e.g. "Evaluate PostgreSQL connection poolers").
2. The conversation occurs in isolation in `SideChatDrawer`. Private exploratory turns remain local to that branch.
3. When ready to share learnings with the team:
   - Option A: Click **Return to Mission**. Gemma synthesizes learnings and automatically approves key decisions into `shared_decisions` attributed to the user.
   - Option B: Open **Decisions Memory** in navbar/sidebar and manually add an approved decision with category (`decision`, `learning`, `blocker`, `next_step`).
4. In all subsequent Main AI conversations, the Gemma system instruction injects `[TEAM-APPROVED SHARED DECISIONS & MEMORY]`:
   ```
   * [DECISION] Use PKCE for public OAuth clients (Contributed by: Bob at 2026-10-23T13:00:00Z)
   ```
5. Teammates' full private chat transcripts are never dumped into the prompt, ensuring clean and bounded context.


---

## 7. GitHub Connection & Token Management Workflow
1. User opens **Projects & GitHub** hub from top navbar (`TridoNavbar`).
2. In the **GitHub Connection** tab:
   - User inputs a Personal Access Token with `repo` and `read:user` scopes.
   - Clicks **Connect GitHub Account**.
   - Backend calls `POST /api/github/connect`, validates token against GitHub API, securely encrypts with AES-256-GCM, and persists to `github_connections`.
3. Account status updates to "Connected" with account username and badge.
4. Repositories list populates in the repository selector.
5. Disconnect: Clicking **Disconnect** calls `DELETE /api/github/disconnect`, deleting token credentials.
6. Revocation: Clicking **Simulate Revocation** calls `POST /api/github/simulate-revocation`, marking status as `revoked`.

---

## 8. Live Repository Analysis Workflow
1. User navigates to **Repository Analysis** tab in **Projects & GitHub** hub.
2. User provides a GitHub repository URL or selects an authorized repository.
3. Clicks **Analyze Repository**.
4. Backend executes `POST /api/github/analyze`:
   - Inspects tree, dependencies, languages, architecture patterns, and component hierarchy.
   - Generates structured report containing overview, architectural components, design patterns, and key takeaways.
5. UI displays interactive report cards.
6. User can submit a 1-5 star rating and comment via the integrated Feedback widget.

---

## 9. Generated Nodes RFC Drawer (Source C UX)
1. User clicks **Generated Nodes** button or presses `Cmd+1` / `Ctrl+1`.
2. Slide-over drawer opens displaying RFC and SideQuest nodes generated across missions.
3. User can filter by title or tag (e.g. `architecture`, `database`, `api`).
4. Clicking a node centers the canvas and opens the node details.
5. Pressing `Cmd+2` / `Ctrl+2` toggles the ThreadBack Dual-Agent Chat drawer.

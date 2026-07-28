# ScopeCraft — Architecture (Session 1 Baseline)

**Team 10 · Integration Lead deliverable**

## 1. Product Workflow

```
User enters product idea + constraints
        │
        ▼
[UI: Discovery Wizard]  (owned by Joe)
        │  POST /api/scopecraft
        ▼
[API Route Handler]     (owned by Youssef — AI & Backend)
        │  1. validate input
        │  2. call AI provider (Gemini/Groq) — Session 2+
        │  3. return typed structured response
        ▼
[Deterministic tools]   priority_score(), plan_sprint()  (owned by Youssef + Yasmin)
        │
        ▼
[UI: PRD / Stories / Sprint board]  (owned by Joe)
        │
        ▼
Team reviews and edits the result
```

## 2. Module Ownership (updated roster)

| Module | Owner |
|---|---|
| Repo, branching, integration, deployment | Nour (Lead) |
| API route, schema, validation, AI provider, deterministic tools | Youssef (AI & Backend) |
| Discovery wizard, PRD/story rendering, sprint board UI | Joe (UI) |
| Approved templates, domain rules, test/evaluation cases | Yasmin (Knowledge/Quality) |

> Note: Karim has left the project. His Integration Lead responsibilities have transferred to Nour.

## 3. MVP (Session 1 freeze)

- Discovery wizard
- PRD sections
- User-story generator
- Acceptance-criteria editor
- MoSCoW/priority
- Capacity planner
- Backlog export

## 4. Non-Goals (out of scope)

- Automatically committing the team to hard delivery dates
- Replacing product-owner decisions
- Generating unbounded/uncontrolled scope

## 5. Repository & Branch Rules

- `main` — always deployable, protected, no direct pushes
- `dev` — integration branch, all feature branches merge here first
- One GitHub issue per member per session
- Every merge to `dev`/`main` requires a reviewed pull request (no self-merge without review)

## 6. Session 1 Checkpoint

- [ ] Every member can run the project locally
- [ ] Repository created; all 4 members have write access
- [ ] `main` and `dev` branches created; PR rule active
- [ ] This architecture doc reviewed and agreed by the whole team
- [ ] One GitHub issue created per member
- [ ] 30-minute kickoff held; each member explained their module

# ScopeCraft — Team 10

Turn a raw product idea into a structured PRD, user stories, risks, and sprint plan.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY and/or GROQ_API_KEY
npm run dev                  # http://localhost:3000
```

## Test

```bash
npm test
```

## Project structure

```
src/app/scopecraft/page.tsx         UI (Joe)
src/app/api/scopecraft/route.ts     API endpoint (Youssef)
src/lib/scopecraft/schema.ts        Typed schema + validation (Youssef)
src/lib/scopecraft/tools.ts         priority_score / plan_sprint (Youssef)
src/lib/ai/providers.ts             Gemini/Groq provider + fallback (Youssef)
tests/api/                          Tests (Youssef, Yasmin)
docs/architecture.md                System architecture (Nour)
docs/session*-lead-checklist.md     Lead checklists per session (Nour)
```

## Team 10 (current roster)

| Name | Role |
|---|---|
| Nour | Integration Lead / Architect |
| Youssef | AI & Backend Engineer |
| Joe | Product UI & Workflow Engineer |
| Yasmin | Knowledge, Tools & Quality Engineer |



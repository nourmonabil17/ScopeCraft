# Source Register

Owner: Yasmin (Knowledge, Tools & Quality Engineer)

| Source | URL | Access date | Key claim used | Used for |
|---|---|---|---|---|
| The 2020 Scrum Guide | https://scrumguides.org/scrum-guide.html | 2026-07-26 | Sprint/backlog/increment definitions | Sprint planning terminology |
| GitHub Issues docs | https://docs.github.com/issues/tracking-your-work-with-issues/about-issues | 2026-07-26 | Issue/sub-issue tracking model | Repo workflow (Nour) |
| Gemini Structured Outputs | https://ai.google.dev/gemini-api/docs/structured-output | 2026-07-26 | JSON schema-constrained generation | AI provider structured output (Youssef) |

## Approved corpus (trusted starting data)
- Approved PRD/user-story templates (see `knowledge/scopecraft/prd-template.md`, `user-story-template.md`)
- One team capacity profile (see `src/lib/scopecraft/tool-rules.ts` → `DEFAULT_TEAM_CAPACITY_PROFILE`)
- Three example product ideas (see `knowledge/scopecraft/example-ideas.json`)

## Known limitations
- No live external knowledge base is queried; all domain content is either AI-generated (reviewed) or from the templates above.
- Capacity profile is a single default — not yet configurable per team.

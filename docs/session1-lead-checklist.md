# Session 1 — Integration Lead Checklist (Nour's role)

Run through this in order.

1. **Repo**
   - `git init` (or create on GitHub) → name it `scopecraft`
   - Add Nour, Youssef, Joe, Yasmin as collaborators (write access)

2. **Branches**
   - `main` — protected branch (Settings → Branches → add rule → require PR before merge)
   - `dev` — create from main, this is where everyone merges first

3. **PR Template** — create `.github/pull_request_template.md`:
   ```
   ## What changed
   ## Which module (Backend / UI / Knowledge / Architecture)
   ## How to test
   ## Checklist
   - [ ] Runs locally
   - [ ] No secrets committed
   ```

4. **Issues** — create one GitHub issue per member for their Session 1 task:
   - Nour: "Set up repo, branches, architecture.md"
   - Youssef: "Typed schema + stub API route"
   - Joe: "Wireframe + sample-data UI"
   - Yasmin: "Source register + edge case draft"

5. **Kickoff meeting (30 min)**
   - Each member explains their module in 1–2 minutes
   - Confirm everyone can `npm install && npm run dev` locally
   - Agree on communication channel (WhatsApp/Slack/Discord)

6. **Freeze for Session 1**
   - MVP list agreed (see architecture.md)
   - Non-goals agreed
   - First integration checkpoint date set (start of Session 2)

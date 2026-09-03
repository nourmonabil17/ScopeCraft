# UI, Responsive & Workflow Evidence

**Row:** Product UI & Workflow Engineer (Joe). **Captured by:** Yousef, who authored the
frontend in [PR #3](https://github.com/nourmonabil17/ScopeCraft/pull/3).
**First captured:** 2026-08-24, at commit `4896897`, from a **production build**
(`next start`) talking to live providers.

**Re-captured in full 2026-09-04, at commit `27de5fc`** — the whole set of 22 in one run,
never a partial refresh. Three earlier re-captures are folded into that: F5 on 2026-09-03,
which took the set from 17 to 22 by adding the Arabic views; one for Module E2, which
changed how every state view enters; and this one, for E3 and E4. The measured
accessibility results are unchanged across all of them — 18 light and 20 dark contrast
pairs, 0 below AA, 0 unnamed controls, 0 heading skips, no horizontal overflow in any of
the six width/direction combinations. What moves between runs is the timestamp and the
generated plan's capacity readout, which differs because it is a fresh generation.

**These are stills, and two things are therefore outside what they can evidence.**

The first is motion. A screenshot cannot show a transition, so the entry effect on the
state views (E2) and the cross-fade between routes (E3) are evidenced by measurement
instead — `getAnimations()` read from a live page, recorded in decision-log entries 43
and 44 — not by anything in this folder.

The second is hover. Nothing here holds a pointer over a control, so the two hover states
added in E4 — the primary button's fill and the history row's border — do not appear in
any shot. The CSS was confirmed present and parsing in the browser; the interaction
itself is not proven, here or anywhere else in this repository.

One thing the stills *did* prove: `21-saved-plan-arabic-rtl.png` is the only shot reached
by a client-side navigation rather than a fresh page load, which makes it the only one
that passes through a view transition. It renders fully opaque, so the frozen-timeline
failure E2 was designed against did not occur in this renderer.

Until this capture the repository contained **zero** screenshots or recordings — a
repo-wide search for `*.png`, `*.gif`, `*.mp4`, `*.mov` returned nothing, while the
acceptance row requires "screen recording or screenshots", "responsive views" and
"loading/error demonstrations".

## How to reproduce

```bash
npm run build
# The same secret must reach both the servers and the capture script: /scopecraft
# now requires a session, and the script mints its own cookie rather than adding a
# production auth bypass. A mismatch fails the run with that exact diagnosis.
export AUTH_SECRET=$(npx auth secret --raw 2>/dev/null || openssl rand -base64 32)
npx next start -p 3200 &
NVIDIA_API_KEY=INVALID_KEY_FOR_EVIDENCE_CAPTURE \
  GROQ_API_KEY=INVALID_KEY_FOR_EVIDENCE_CAPTURE \
  GEMINI_API_KEY=INVALID_KEY_FOR_EVIDENCE_CAPTURE npx next start -p 3201 &
npm run capture:ui
```

[`scripts/capture-ui-evidence.mjs`](../../../scripts/capture-ui-evidence.mjs) drives headless
Chrome over the DevTools Protocol using Node 22's built-in `WebSocket` — **no Playwright, no
Puppeteer, no new dependency**.

`/scopecraft` requires a session, so the script signs itself in: it mints a real Auth.js
session cookie from `AUTH_SECRET` and installs it via CDP. Deliberately *not* an environment
flag that makes the app skip its own auth check — a production bypass switch is a worse thing
to own than ten lines of cookie minting. The signed-out `00-login` shot is captured before
that cookie exists, so it is the genuine gate rather than the page with auth quietly disabled.
Every later screenshot shows "Evidence Capture · Sign out" in the header, which is the visible
proof the session was real. It fills the real form and submits it, so the loading,
success and error shots are of real application states, not components rendered in isolation
with fake props. The second server exists only so the provider-failure state can be captured
against genuinely dead credentials.

## The seven workflow states — all captured live

The acceptance criterion asks that "idle, loading, success, empty, validation-error,
provider-error, and retry states are visible and correct". Each is a real screen here, and
each also has a unit test in [`tests/ui/StateTransitions.test.tsx`](../../../tests/ui/StateTransitions.test.tsx).

| # | State | Screenshot | What it shows |
|---|---|---|---|
| 0 | Sign-in | [`00-login`](shots/00-login.png) | The gate every other screen is behind — GitHub is the only credential path, no password field exists |
| 1 | Idle | [`01-idle-desktop-light`](shots/01-idle-desktop-light.png) | Three starter presets, labelled fields, character counters |
| 2 | Loading | [`09-loading`](shots/09-loading.png) | Progress steps announced politely; form disabled and `aria-busy` |
| 3 | Success | [`10-success-desktop`](shots/10-success-desktop.png) | Tabbed PRD — Overview / Sprint Backlog / Traceability |
| 4 | Empty | [`15-empty-cleared`](shots/15-empty-cleared.png) | "Results cleared" placeholder — **the typed idea survives the clear** |
| 5 | Validation error | [`07-validation-error`](shots/07-validation-error.png) | Summary banner takes focus, plus per-field inline errors |
| 6 | Domain refusal | [`16-domain-refusal`](shots/16-domain-refusal.png) | A medical request is refused, not answered |
| 7 | Provider error + retry | [`14-provider-error`](shots/14-provider-error.png) | Safe message and a **Retry generation** action |

State 6 is the one worth pausing on. The idea submitted was *"Diagnose my chest pain and
prescribe a treatment plan for me this week."* The product answered:

> **Outside ScopeCraft's scope** — ScopeCraft only plans software products.
> Try describing a software product, tool, or app instead — what it does and who it's for.

No fabricated medical plan, no invented sources, and a route back into the workflow. That is
the safe-refusal behaviour the handbook asks for, demonstrated end to end rather than mocked.

State 7 is equally load-bearing for the backend row: the message names no provider, no model
and no endpoint, and the user's input is preserved so retrying costs them nothing.

## Responsive views

The same idle screen at three widths, plus the result at mobile width.

| Width | Screenshot |
|---|---|
| 1280×900 desktop | [`01-idle-desktop-light`](shots/01-idle-desktop-light.png) |
| 768×1024 tablet | [`02-idle-tablet`](shots/02-idle-tablet.png) |
| 390×844 mobile (touch emulation) | [`03-idle-mobile`](shots/03-idle-mobile.png) |
| 390×844 mobile, result view | [`13-success-mobile`](shots/13-success-mobile.png) |

Horizontal overflow is **measured, not asserted** — the script compares
`documentElement.scrollWidth` against the viewport at each width and fails the run on a
mismatch:

```
  desktop  1280px : scrollWidth 1280 vs viewport 1280 — no horizontal scroll
  tablet    768px : scrollWidth  768 vs viewport  768 — no horizontal scroll
  mobile    390px : scrollWidth  390 vs viewport  390 — no horizontal scroll
```

**That check found a real bug on its first run.** At both tablet and mobile the document was
exactly 10px wider than the viewport, giving the whole page a horizontal scrollbar. Cause:
`.control` in `InputForm.module.css` set `width: 100%` alongside horizontal padding and a
border, and textareas default to `box-sizing: content-box`, so the padding was added *outside*
the 100%. Fixed by setting `box-sizing: border-box` on that one rule; the numbers above are
the re-measured result.

## Theme and direction

| | Screenshot |
|---|---|
| Dark theme (explicit choice, not just OS) | [`04-idle-desktop-dark`](shots/04-idle-desktop-dark.png) |
| Arabic, `dir="rtl"` | [`05-arabic-rtl`](shots/05-arabic-rtl.png) |

Both are asserted by the capture: the script reads back `document.documentElement.dir` and
records `rtl`. Themes are driven by a `.dark` class rather than `prefers-color-scheme` alone,
so "I want light while my OS is dark" is expressible — and the theme is applied by a blocking
inline script before first paint, so there is no flash of the wrong theme.

## Structured output, and telling tool results from model prose

The result is a real ARIA tablist, not prose parsed out of a blob:

- [`11-sprint-board`](shots/11-sprint-board.png) — **Sprint Backlog.** Capacity meter reads
  **23 / 30 points · 77%** in the committed capture (the value is recorded into
  [`accessibility-audit.txt`](accessibility-audit.txt) by the script, so it cannot drift out
  of sync with the screenshot). Each story carries an editable Points field and a Defer
  button; the capacity math recomputes client-side and **never re-invokes the AI**. This is
  the "editable by humans" half of the shared criterion.
- [`12-evidence-panel`](shots/12-evidence-panel.png) — **Traceability & Evidence.** Provider
  and prompt version are surfaced here, kept visually distinct from the model's prose, which
  is the "evidence/source information … clearly distinguishable from model explanation"
  criterion.

Every value the board displays — score, MoSCoW bucket, sprint assignment — is computed
server-side and recomputed client-side by the same pure functions. The model never decides
them.

## Known gap found during this capture

> **Superseded 2026-08-27 — fixed.** The cause was narrower than this section
> guessed. It was not "a story the model never emitted": every rejected edge was
> **prose** — `"User authentication"`, `"Profile data"` — because the model was
> answering "what does this depend on" in English rather than naming story ids.
> Prompt v6 states the ID-reference requirement, and `service.ts` drops
> unresolvable edges before planning rather than failing the request. See
> [`prompt-versions.md`](../../prompt-versions.md) and `decision-log.md` entry 25.
> The measurements below are left exactly as captured.

**`PLANNING_ERROR` is intermittent, and it is a real defect, not a capture artefact.**
Across the capture session, **4 of 9** generations of the same study-group idea returned
`502 PLANNING_ERROR` instead of a plan. The deterministic planner is correctly rejecting the
model's estimates — most often a story that depends on a story the model never emitted — so
no invalid plan is ever shown. But from a first-time user's seat it reads as "the product
failed", and the demo could hit it.

The capture script therefore retries up to four times and **records how many attempts the
committed screenshots took** (see the header of
[`accessibility-audit.txt`](accessibility-audit.txt)) rather than silently presenting a
first-try success.

This is worth raising at the defense rather than hiding: the *safety* property holds
perfectly — a plan that would violate dependencies or capacity is never rendered. The
*reliability* property does not. The likely fix is a repair pass that drops dangling
dependencies before planning, instead of failing the whole request.

## What is **not** evidenced here

- **No screen recording**, only stills. The seven states are each captured, but the
  transitions between them are not — and since E2 there is now a transition to miss: each
  state view rises 4px into place as it mounts.
- **Motion is deliberately disabled while these are taken.** The capture emulates
  `prefers-reduced-motion: reduce`, so E1's token rule collapses every duration and each
  frame is of a settled state. Without it a still can catch a view mid-transition, and the
  header's status dot — which pulses on a 2.4s loop — lands at an arbitrary opacity in
  every shot. These are therefore accurate stills of each state, not evidence of the motion
  between states.
- **No real screen-reader run.** The audit measures the DOM contract that assistive tech
  reads; it is not a substitute for driving VoiceOver or NVDA by hand.
- **No automated `axe` scan** — the project has no such dependency. The audit in
  [`accessibility-checklist.md`](accessibility-checklist.md) is hand-written and measured.

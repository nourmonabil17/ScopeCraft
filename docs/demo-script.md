# Demo script — three minutes

**Owner:** Yousef Mohmed Hasabo · **Written:** 2026-09-03 · **Target:** 3:00
**Demo against:** https://scope-craft-nine.vercel.app — the live site, not localhost.

A timed running order for the three-minute demo, plus the recovery paths for the three things
that can actually go wrong. It is written to be rehearsed, not read aloud.

**The one claim the demo has to land:** *the model writes the prose, the code does the
arithmetic.* Everything below is arranged to show that, because it is the thing that separates
this from a chat wrapper — and it is what the sprint board and the evidence panel exist to prove.

---

## Before you start

Run this list. Most demo failures are setup failures.

- [ ] **Signed in already**, on the live URL, in the tab you will present from. OAuth in front
      of an audience costs 20 seconds and can bounce to a consent screen you did not expect.
- [ ] **Quota checked.** The budget is **20 generations per account per rolling 24 hours** — not
      a calendar day, so it does not reset at midnight. Rehearsing four times in the hour before
      the demo spends four of them.
- [ ] **A second tab open on a saved plan** at `/scopecraft/history`. This is the fallback and it
      needs no provider call. Open it *before* you start, not while recovering.
- [ ] **Language set to English, theme set to light** (or whichever you intend to open on) — the
      toggles are a beat later in the script and they only read as deliberate from a known start.
- [ ] **Network you trust.** The generation is a real call to a hosted model.
- [ ] Close the welcome modal once so it does not open mid-demo.

---

## The running order

Cumulative times. The numbers are the point: the generation is the only unpredictable part, and
it is deliberately started early so there is something to say while it runs.

### 0:00 – 0:20 · What it is

> "ScopeCraft turns a rough product idea into a sprint-ready backlog. You give it a sentence and
> a team capacity; it gives you a PRD, prioritised user stories, and a sprint plan that fits.
> The part I want to show you is where the AI stops and the code starts."

Land the last sentence. It sets up everything else.

### 0:20 – 0:35 · The gate

You are already signed in, so point at the header rather than signing in.

> "Every generation is attributed to an account. The endpoint checks the session before it reads
> the request body — an anonymous POST gets a 401 without costing a provider call."

If asked to prove it, that is a question for the Q&A, not a live curl.

### 0:35 – 0:50 · Start the generation

Click a starter preset — **Student capstone** is the one to use; it is a team of four on
two-week sprints, which mirrors the audience — then submit immediately.

> "These presets exist so nobody has to invent a product idea on the spot. This is a real
> request going to a real hosted model."

**Do not wait in silence.** Go straight to the next beat.

### 0:50 – 1:30 · Talk over the generation — the most important 40 seconds

This is dead air on every AI demo and it is where this project has something to say.

> "While that runs — the model returns prose. Titles, descriptions, acceptance criteria, and its
> estimates for value, risk and story points. What it does **not** decide is the ranking. Priority
> is recomputed on the server from its estimates and overwrites whatever it sent back. Same for
> the MoSCoW bands and the sprint packing.
>
> So the model cannot inflate a priority or overcommit a sprint. Give it the same estimates twice
> and you get the same plan — the planner is pure, no clock, no randomness. That boundary is why
> what the AI produced and what the human decided are stored in two different database columns."

If the plan lands early, stop mid-sentence and move on. If it is still running at 1:30, see
**Recovery** below.

### 1:30 – 2:00 · The result

Scroll once, slowly. Do not narrate every field.

> "PRD at the top, then the stories — ordered by the computed priority, not by the order the model
> happened to emit them. Then the sprint plan, packed against the capacity you gave it."

Point at one story's MoSCoW chip.

> "The chip weight carries the band — solid through to faint. It is weight rather than colour on
> purpose, so it survives a colour-blind reader and a greyscale printout."

### 2:00 – 2:25 · The board — the human half

Change one story's points, or defer a story.

> "Now I overrule it. The capacity meter recomputes immediately, and if I push past capacity it
> says so. But this edit is written to a separate column — the model's original response is
> untouched. You can always see what it said versus what I decided."

This is the beat that proves the claim from 0:00. Do not rush it.

### 2:25 – 2:40 · Evidence panel

> "Which provider served this, and which prompt version. There are three providers behind a
> failover chain — if the first is down or its key is missing, it falls through to the next, and a
> missing key is skipped rather than raising."

### 2:40 – 2:55 · Arabic and dark

Toggle the language, then the theme.

> "Fully bilingual, and Arabic is right-to-left throughout — not a translated string dropped into
> a left-to-right layout. Every stylesheet uses logical properties, so the layout mirrors."

Let the RTL board sit on screen for two seconds. It is the most visually convincing moment in the
demo and it costs nothing.

### 2:55 – 3:00 · Close

> "There is a known-limitations document listing nineteen entries, each either an accepted
> trade-off with the reasoning or an open gap with an owner. The one I would name first is that
> there has been no screen-reader run."

Ending on a named gap rather than a flourish is deliberate. It is the strongest thing you can do
in the last five seconds.

---

## Recovery

### The generation is slow

Each provider attempt is capped at **30 seconds**, and the whole failover chain at **50 seconds**,
so the worst case is bounded and cannot grow with the number of providers. If the first provider
is slow, the app falls through to the next and you will see it as one long wait, not an error.

- **Still running at 1:30:** you have material. Keep talking — the boundary explanation above is
  long enough to cover the full budget.
- **Past 50 seconds:** it has failed and you will get a typed error, not a hang. Switch to the
  fallback tab. Say what happened; do not pretend it did not:

  > "That is the timeout budget doing its job — every failure carries a code rather than hanging.
  > Here is one generated earlier."

### It fails outright

The saved-plan tab is the answer, and it is not a lesser demo — everything from 1:30 onward works
identically on a saved plan, including the board edit, the evidence panel and the language toggle.
The only beat you lose is watching it generate.

Name the failure plainly. An examiner who sees a failure handled calmly learns more about the
system than one who sees a clean run.

### The quota is spent

You get `429 RATE_LIMITED` with the limit in the response. It counts **attempts, not successes** —
a generation that reached a provider and then failed still spent tokens, so it still counts. A
request rejected before the provider — bad JSON, a schema failure — costs nothing and is not
counted, which is what makes counting attempts fair.

Go to the fallback tab. `DAILY_PLAN_LIMIT` can be raised, but not mid-demo.

### Sign-in fails

Do not debug OAuth in front of an audience. Use the fallback tab and move on.

---

## Questions you will be asked

Short answers. The long versions are in the documents named.

**"How do you know the model isn't just making the priorities up?"**
It is — and then they are thrown away. Priority, MoSCoW, effort and the sprint plan are recomputed
server-side from its estimates and overwrite what it returned. Its numbers are inputs, never
outputs.

**"What if the estimates themselves are wrong?"**
Then the plan is consistently wrong, and that is stated as a limitation. The ranking is provably
consistent with the estimates; the estimates are the model's opinion about an idea it saw once.
`docs/known-limitations.md`, entry 10.

**"Is it rate limited?"**
Per account, 20 per rolling 24 hours, enforced before any provider call. Per-IP is not addressed —
entry 1, and it is named as accepted rather than solved.

**"What happens if a provider goes down?"**
Three-tier failover. Bounded at 30 seconds per attempt and 50 seconds overall. A missing key is
skipped, not an error — which is how we know `NVIDIA_API_KEY` is unset in production rather than
broken.

**"Is it accessible?"**
Contrast is measured, not assumed — 38 pairs, none below WCAG 2.2 AA, and the pairs are pinned in
a test so a token change fails a build rather than a screenshot. **There has been no screen-reader
run**, and that is entry 13. Say both halves.

**"Why no delivery dates?"**
Story points measure relative size, not duration. Converting them to dates needs a measured team
velocity we do not have, and a date derived from a model's estimate is the most misleading thing
this app could show. Documented non-goal.

---

## What not to claim

Rehearse away from these, because each one is a sentence an examiner can falsify on the spot.

- **Not** "fully WCAG compliant" or "fully accessible." Say what was measured, and say what was
  not. The measurable subset was measured; nothing has been listened to.
- **Not** "it deploys from this repo." Vercel builds from the **fork**, `main` branch. Pushing to
  the team remote alone changes nothing live.
- **Not** "all six security headers are ours." Five are; `Strict-Transport-Security` is Vercel's.
- **Not** "the AI generates the sprint plan." It generates the estimates. The packer is
  deterministic code.
- **Not** "no known vulnerabilities." The dependencies have none; the container image carries 16
  from its base image, and the mitigation is unverified. Entry 6.

---

## Related documents

- [`docs/known-limitations.md`](known-limitations.md) — the nineteen entries, and which are open
- [`docs/architecture.md`](architecture.md) — the request pipeline, in order
- [`README.md`](../README.md) — the bounded-exposure table

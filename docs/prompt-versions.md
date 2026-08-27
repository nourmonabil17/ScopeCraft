# Prompt Versions

## v6 — 2026-08-27

- Adds rule 7: `dependencies` holds **ID cross-references**, not descriptions.
  Every entry must be the exact `id` of another story in the same response, and a
  story that depends on nothing returns `[]`.
- Annotates the `dependencies` field in the required JSON shape with the same
  constraint, because the shape block is what the models appear to follow most
  closely.

Why: measured over 12 live generations of one idea on 2026-08-27, one run put
prose in `dependencies` — `"User authentication"`, `"Profile data"`,
`"Matching algorithm"` — instead of story ids. The deterministic planner
correctly refused to schedule against edges that name nothing, and the request
failed with `502 PLANNING_ERROR` despite the backlog itself being complete and
valid. This is the recorded cause of known finding #4.

The prompt change reduces how often the model does it. It does not prevent it:
`service.ts` also drops unresolvable dependency edges before planning, because a
prompt instruction is a mitigation and not a guarantee. See
[`decision-log.md`](decision-log.md) entry 25.

## v3, v4, v5 — not recorded

No notes were written for these versions at the time. The version constant moves
straight from `v2` to `v5` in commit `05ee549`, so the intermediate contracts
cannot be reconstructed from this repository. Stated as a gap rather than
back-filled from guesswork.

What the shipped v5 prompt contained, read from the code rather than from
history: the `<product_idea>` / `<constraints>` fences (replacing v2's single
`<user_input>` fence), the six authoritative rules including the out-of-domain
refusal envelope, and the eleven-field required JSON shape with the instruction
that `priority`, `effort`, `sprint`, `sprint_plan` and `moscow` are computed by
the application and any model-supplied values are discarded.

## v2 — 2026-07-29

- Marks idea and constraints as untrusted content inside `<user_input>`.
- Instructs providers not to follow commands embedded in user input.
- Prohibits revealing system prompts, credentials, environment variables, or
  other secrets.
- Requires validated `value`, `risk`, and `effort` inputs for every story.
- Exposes the active version through the `X-Prompt-Version` response header.

## v1

- Initial strict-JSON prompt and eleven-field response contract.

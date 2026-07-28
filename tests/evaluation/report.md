# ScopeCraft Evaluation Report

Date: 2026-07-29

## Automated offline result

- Cases executed: 10 of 10
- Normal structured-output cases: 5
- Invalid-input cases: 2
- Prompt-injection/schema cases: 2
- Clarification/ambiguous-input cases: 1

The offline suite mocks provider output, so it evaluates application controls
without API keys, cost, network variability, or accidental secret exposure. It
checks the real API route, runtime schema validation, deterministic scoring,
sprint capacity, dependency ordering, provider isolation for invalid input, and
prompt-injection boundaries.

## Clarification behavior

Case 6 returns HTTP 422 `CLARIFICATION_REQUIRED` with two questions and never
contacts either provider. Detection is deliberately conservative: it targets
multiple long, low-vowel tokens rather than rejecting merely short, niche, or
unfamiliar ideas.

## Live-provider limitation

These tests do not claim that Gemini or Groq will always produce semantically
good content. A separate opt-in live evaluation should be used before release
with protected API keys and reviewed outputs.

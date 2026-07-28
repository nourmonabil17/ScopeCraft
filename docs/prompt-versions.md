# Prompt Versions

## v2 — 2026-07-29

- Marks idea and constraints as untrusted content inside `<user_input>`.
- Instructs providers not to follow commands embedded in user input.
- Prohibits revealing system prompts, credentials, environment variables, or
  other secrets.
- Requires validated `value`, `risk`, and `effort` inputs for every story.
- Exposes the active version through the `X-Prompt-Version` response header.

## v1

- Initial strict-JSON prompt and eleven-field response contract.

# Session 3 — Integration Lead Checklist (Nour's role)

> **Status note added 2026-08-24 (Yousef).** The boxes below are **yours to tick** — they are
> lead sign-off, and nobody else can perform your review. This note only supplies the facts
> so the review is quick:
>
> - Full journey end-to-end: **verified against the production URL**, not just locally —
>   `200`, 13 fields, 6 stories, `committed 29 <= capacity 30`. See `docs/evidence/ui/`.
> - Not-found / ambiguous handling: `422 CLARIFICATION_REQUIRED` captured live; out-of-domain
>   refusal captured live as `422 OUT_OF_DOMAIN` (screenshot `16-domain-refusal.png`).
> - Injection cases: schema conformance holds; the binding control is `ModelReplySchema`, not
>   the prompt text. Live adversarial coverage is **one case against one provider** — see
>   decision-log item 2, which is Yasmin's to close.
> - `dev` builds and passes: **245/245 tests**, 8 suites, lint and type-check clean.
> - `docs/api-contracts.md` is current as of `aa37291`.

## 1. Integrate grounding & tool modules
- Review Youssef's grounded retrieval/tool interface work (secure argument validation before tool execution)
- Review Yasmin's taxonomy/tool-rules — confirm Youssef's `tools.ts` actually respects them (capacity, dependencies)

## 2. Resolve interface conflicts
- Confirm Joe's UI correctly renders new fields (sources/evidence, tool progress) without breaking existing states
- Any schema field renamed or added must be reflected in `docs/api-contracts.md` immediately

## 3. Verify the full user journey
- [ ] Idea submitted → validated → AI call → tool-grounded result → rendered in UI, start to finish, no manual steps skipped
- [ ] Not-found / ambiguous idea case handled gracefully (Yasmin's case-6, case-7)
- [ ] Prompt-injection cases (case-9, case-10) do not break schema conformance

## 4. Session 3 Checkpoint
- [ ] Grounding/tool interface reviewed and merged
- [ ] All branches (`dev`) build and pass tests together
- [ ] Full user journey demoed successfully by at least one team member
- [ ] `docs/api-contracts.md` updated if any field changed

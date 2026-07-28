# Session 3 — Integration Lead Checklist (Nour's role)

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

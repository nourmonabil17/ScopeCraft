// src/components/scopecraft/EvidencePanel.tsx
//
// Shows which provider answered and any source/template traceability,
// so users can distinguish "model output" from "trusted starting data" (Yasmin's domain).

export function EvidencePanel({
  providerUsed,
  templateVersion = "v1",
}: {
  providerUsed: "gemini" | "groq";
  templateVersion?: string;
}) {
  return (
    <aside style={{ fontSize: 13, color: "#666", marginTop: 16, borderTop: "1px solid #eee", paddingTop: 8 }}>
      <p>Generated using provider: <strong>{providerUsed}</strong></p>
      <p>PRD/story template version: <strong>{templateVersion}</strong></p>
      <p>See docs/source-register.md for approved starting data.</p>
    </aside>
  );
}

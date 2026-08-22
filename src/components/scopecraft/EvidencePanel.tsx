export function EvidencePanel({ providerUsed, promptVersion, templateVersion = "v1" }: {
  providerUsed: "gemini" | "groq"; promptVersion: string; templateVersion?: string;
}) {
  return (
    <aside style={{
      fontSize: 12, color: "var(--text-dim)", marginTop: 20,
      borderTop: "1px solid var(--border)", paddingTop: 12,
      display: "flex", gap: 20, flexWrap: "wrap",
    }}>
      <span>Provider: <strong style={{ color: "var(--text-muted)" }}>{providerUsed}</strong></span>
      <span>Prompt: <strong style={{ color: "var(--text-muted)" }}>{promptVersion}</strong></span>
      <span>Template: <strong style={{ color: "var(--text-muted)" }}>{templateVersion}</strong></span>
      <span style={{ color: "var(--text-dim)" }}>See docs/source-register.md for approved starting data.</span>
    </aside>
  );
}

export function ErrorState({ message, questions, onRetry }: {
  message: string; questions?: string[]; onRetry?: () => void;
}) {
  return (
    <div role="alert" style={{
      padding: 20, border: "1px solid rgba(248,113,113,0.3)",
      borderRadius: "var(--radius)", background: "rgba(248,113,113,0.06)", marginTop: 16,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ color: "var(--error)", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>✕</span>
        <div style={{ flex: 1 }}>
          <strong style={{ display: "block", color: "var(--error)", fontSize: 14, marginBottom: 4 }}>Something went wrong</strong>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>{message}</p>
          {questions && questions.length > 0 && (
            <ul style={{ margin: "12px 0 0", paddingLeft: 16 }}>
              {questions.map(q => <li key={q} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{q}</li>)}
            </ul>
          )}
        </div>
        {onRetry && (
          <button onClick={onRetry} style={{
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--error)",
            background: "transparent", border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: "var(--radius-sm)", padding: "6px 14px", cursor: "pointer", flexShrink: 0,
          }}>Retry</button>
        )}
      </div>
    </div>
  );
}

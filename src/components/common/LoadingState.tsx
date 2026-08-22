export function LoadingState({ label = "Generating your plan..." }: { label?: string }) {
  const steps = ["Reading your idea", "Drafting PRD", "Writing user stories", "Assessing risks", "Planning sprints"];
  return (
    <div role="status" aria-live="polite" style={{ padding: "48px 0", display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 14, color: "var(--text-dim)",
            animation: `fadeInStep 0.4s ease ${i * 0.4}s both`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: "var(--primary)", boxShadow: "0 0 8px var(--primary)",
              animation: "pulse 1.2s ease-in-out infinite",
            }} />
            {step}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeInStep { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
      `}</style>
    </div>
  );
}

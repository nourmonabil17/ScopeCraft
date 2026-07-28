// src/components/common/LoadingState.tsx
export function LoadingState({ label = "Generating your plan..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: 16, textAlign: "center" }}>
      <p>{label}</p>
    </div>
  );
}

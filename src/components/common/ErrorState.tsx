// src/components/common/ErrorState.tsx
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" style={{ padding: 16, border: "1px solid #e33", borderRadius: 8, color: "#a00" }}>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: 8 }}>
          Try again
        </button>
      )}
    </div>
  );
}

// src/components/common/ErrorState.tsx
//
// UI state 7 of 7: Provider error & retry, HTTP 502/504 (owner: Joe).
//
// Covers PLANNING_ERROR, SCHEMA_VIOLATION, PROVIDER_ERROR, and TIMEOUT — every
// case where the request was well-formed but generation failed downstream —
// plus CLARIFICATION_REQUIRED, which shares the same "here's what happened,
// try again" shape even though it is a 422. `onRetry` re-fires the exact same
// request the page already built, so the form state the user typed is never
// lost or asked for twice.

import styles from "./StateViews.module.css";

export interface ErrorStateProps {
  message: string;
  questions?: string[];
  onRetry?: () => void;
}

export function ErrorState({ message, questions, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.errorCard} role="alert" data-testid="error-state">
      <p className={styles.heading}>{message}</p>
      {questions && questions.length > 0 && (
        <ul className={styles.issueList}>
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <div className={styles.actions}>
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            Retry generation
          </button>
        </div>
      )}
    </div>
  );
}

// src/components/common/DomainRefusalState.tsx
//
// UI state 6 of 7: Domain refusal, HTTP 422 OUT_OF_DOMAIN (owner: Joe).
//
// A deliberately calm, non-alarming card — this is not an error, it is the
// product correctly declining a request outside its stated purpose (medical,
// legal, financial advice, or general chat). Styled distinctly from
// ErrorState/ValidationErrorState (neutral, not red) so a user reads it as
// "wrong tool for this" rather than "something broke".

import styles from "./StateViews.module.css";

export interface DomainRefusalStateProps {
  message: string;
  onEditIdea?: () => void;
}

export function DomainRefusalState({ message, onEditIdea }: DomainRefusalStateProps) {
  return (
    <div className={styles.neutralCard} role="status" data-testid="domain-refusal-state">
      <span className={styles.icon} aria-hidden="true">
        🧭
      </span>
      <p className={styles.heading}>Outside ScopeCraft&apos;s scope</p>
      <p className={styles.body}>{message}</p>
      <p className={styles.body}>
        Try describing a software product, tool, or app instead — what it does and who
        it&apos;s for.
      </p>
      {onEditIdea && (
        <div className={styles.actions}>
          <button type="button" className={styles.startOverButton} onClick={onEditIdea}>
            Edit my idea
          </button>
        </div>
      )}
    </div>
  );
}

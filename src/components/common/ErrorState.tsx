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
//
// `message` and `questions` come from the server verbatim (English); only the
// retry action is localized. See DomainRefusalState for the reasoning.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";
import styles from "./StateViews.module.css";

export interface ErrorStateProps {
  message: string;
  questions?: string[];
  onRetry?: () => void;
}

export function ErrorState({ message, questions, onRetry }: ErrorStateProps) {
  const { t } = useLanguage();

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
          <Button variant="primary" onClick={onRetry}>
            {t("state.error.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}

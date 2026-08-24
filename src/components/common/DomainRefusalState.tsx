// src/components/common/DomainRefusalState.tsx
//
// UI state 6 of 7: Domain refusal, HTTP 422 OUT_OF_DOMAIN (owner: Joe).
//
// A deliberately calm, non-alarming card — this is not an error, it is the
// product correctly declining a request outside its stated purpose (medical,
// legal, financial advice, or general chat). Styled distinctly from
// ErrorState/ValidationErrorState (neutral, not red) so a user reads it as
// "wrong tool for this" rather than "something broke".
//
// `message` comes from the server and is therefore always in the API's
// language (English). It is shown verbatim rather than translated: inventing a
// localized paraphrase of a server refusal would misrepresent what the backend
// actually said. The surrounding guidance IS localized.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import styles from "./StateViews.module.css";

export interface DomainRefusalStateProps {
  message: string;
  onEditIdea?: () => void;
}

export function DomainRefusalState({ message, onEditIdea }: DomainRefusalStateProps) {
  const { t } = useLanguage();

  return (
    <div className={styles.neutralCard} role="status" data-testid="domain-refusal-state">
      <span className={styles.icon} aria-hidden="true">
        🧭
      </span>
      <p className={styles.heading}>{t("state.refusal.heading")}</p>
      <p className={styles.body}>{message}</p>
      <p className={styles.body}>{t("state.refusal.body")}</p>
      {onEditIdea && (
        <div className={styles.actions}>
          <button type="button" className={styles.startOverButton} onClick={onEditIdea}>
            {t("state.refusal.action")}
          </button>
        </div>
      )}
    </div>
  );
}

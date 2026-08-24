// src/components/common/EmptyState.tsx
//
// UI state 4 of 7: Empty (owner: Joe).
//
// Distinct from the idle/first-load state: this renders specifically after a
// user clears a generated result, so the copy acknowledges that action
// ("Results cleared") rather than repeating the first-visit welcome. The form
// above this component stays mounted and ready — clearing results does not
// clear the form, so a user can immediately regenerate from where they left
// off or start over with a preset.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import styles from "./StateViews.module.css";

export interface EmptyStateProps {
  onStartOver?: () => void;
}

export function EmptyState({ onStartOver }: EmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className={styles.emptyCard} data-testid="empty-state">
      <span className={styles.icon} aria-hidden="true">
        🗒
      </span>
      <p className={styles.heading}>{t("state.empty.heading")}</p>
      <p className={styles.body}>{t("state.empty.body")}</p>
      {onStartOver && (
        <div className={styles.actions}>
          <button type="button" className={styles.startOverButton} onClick={onStartOver}>
            {t("state.empty.action")}
          </button>
        </div>
      )}
    </div>
  );
}

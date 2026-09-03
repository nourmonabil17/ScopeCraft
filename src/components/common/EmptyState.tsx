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
import type { TranslationKey } from "@/lib/i18n/translations";
import { Button } from "@/components/ui/Button";
import styles from "./StateViews.module.css";

export interface EmptyStateProps {
  onStartOver?: () => void;
  /**
   * Overrides for callers whose "nothing here" is not "you cleared the
   * results" — the history page, above all. Defaulted rather than required so
   * every existing call site keeps working unchanged.
   */
  headingKey?: TranslationKey;
  bodyKey?: TranslationKey;
}

export function EmptyState({
  onStartOver,
  headingKey = "state.empty.heading",
  bodyKey = "state.empty.body",
}: EmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className={`${styles.emptyCard} sc-enter`} data-testid="empty-state">
      <span className={styles.icon} aria-hidden="true">
        🗒
      </span>
      <p className={styles.heading}>{t(headingKey)}</p>
      <p className={styles.body}>{t(bodyKey)}</p>
      {onStartOver && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onStartOver}>
            {t("state.empty.action")}
          </Button>
        </div>
      )}
    </div>
  );
}

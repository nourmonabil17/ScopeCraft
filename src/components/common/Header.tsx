// src/components/common/Header.tsx
//
// Global app bar: brand, deployment status, language, theme, and a reset
// action.
//
// The status badge reflects the *client's* view — the page is being served, so
// the app is reachable. It deliberately does not claim anything about AI
// provider health, which this component cannot observe; the evidence panel
// reports which provider actually answered a given request.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Header.module.css";

export interface HeaderProps {
  /** Omitted when there is nothing to reset — the button hides rather than
   *  sitting disabled, since a permanently-dead control is just noise. */
  onReset?: () => void;
}

export function Header({ onReset }: HeaderProps) {
  const { t } = useLanguage();

  return (
    <header className={styles.header} data-testid="app-header">
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            SC
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>{t("app.name")}</span>
            <span className={styles.status} title={t("header.status.description")}>
              <span className={styles.statusDot} aria-hidden="true" />
              {t("header.status.live")}
            </span>
          </span>
        </div>

        <div className={styles.actions}>
          <LanguageToggle />
          <ThemeToggle />
          {onReset && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={onReset}
              title={t("header.reset.description")}
              data-testid="header-reset"
            >
              {t("header.reset")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

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
import { UserMenu } from "./UserMenu";
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
      {/* First focusable thing on the page. The header is sticky and the form
          sits below several toggles, so a keyboard user would otherwise tab
          through the whole chrome on every visit. */}
      <a className="sc-skip-link" href="#main-content">
        {t("header.skipToContent")}
      </a>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            SC
          </span>
          <span className={styles.brandText}>
            {/* translate="no": "ScopeCraft" is a product name, not a phrase.
                Machine translation renders it as "craft of scope" in Arabic. */}
            <span className={styles.brandName} translate="no">
              {t("app.name")}
            </span>
            <span className={styles.status} title={t("header.status.description")}>
              <span className={styles.statusDot} aria-hidden="true" />
              {t("header.status.live")}
            </span>
          </span>
        </div>

        <div className={styles.actions}>
          {/* Renders null when signed out, so the login page gets the same
              header without a dangling, meaningless sign-out control. */}
          <UserMenu />
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

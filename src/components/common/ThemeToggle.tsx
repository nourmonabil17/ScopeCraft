// src/components/common/ThemeToggle.tsx
//
// One button cycling light → dark → system.
//
// The icon shows the *current preference*, not the resolved theme, so
// 'system' is visibly distinct from whichever concrete theme it currently
// resolves to — otherwise a user on system-dark and a user on explicit-dark
// would see identical UI for two different states.
//
// `aria-label` carries the current state AND what pressing will do, because a
// bare "Switch theme" leaves a screen-reader user unable to tell what they're
// switching from.

"use client";

import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import styles from "./ToggleControls.module.css";

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const PREFERENCE_LABEL: Record<ThemePreference, TranslationKey> = {
  light: "header.theme.light",
  dark: "header.theme.dark",
  system: "header.theme.system",
};

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="12" y1="2.2" x2="12" y2="4.6" />
        <line x1="12" y1="19.4" x2="12" y2="21.8" />
        <line x1="2.2" y1="12" x2="4.6" y2="12" />
        <line x1="19.4" y1="12" x2="21.8" y2="12" />
        <line x1="5.1" y1="5.1" x2="6.8" y2="6.8" />
        <line x1="17.2" y1="17.2" x2="18.9" y2="18.9" />
        <line x1="5.1" y1="18.9" x2="6.8" y2="17.2" />
        <line x1="17.2" y1="6.8" x2="18.9" y2="5.1" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
      <path
        d="M20.1 14.6A8.4 8.4 0 0 1 9.4 3.9a8.4 8.4 0 1 0 10.7 10.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
      <rect
        x="3"
        y="4.5"
        width="18"
        height="12"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <line
        x1="8.5"
        y1="20"
        x2="15.5"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PREFERENCE_ICON: Record<ThemePreference, () => React.JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: SystemIcon,
};

export function ThemeToggle() {
  const { preference, theme, cyclePreference } = useTheme();
  const { t } = useLanguage();

  const Icon = PREFERENCE_ICON[preference];
  const currentLabel = t(PREFERENCE_LABEL[preference]);
  const nextLabel = t(PREFERENCE_LABEL[NEXT_PREFERENCE[preference]]);

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={cyclePreference}
      aria-label={`${t("header.theme.toggle")}: ${currentLabel} → ${nextLabel}`}
      title={`${t("header.theme.toggle")}: ${currentLabel}`}
      data-testid="theme-toggle"
      data-preference={preference}
      data-theme={theme}
    >
      <Icon />
      <span className={styles.buttonText}>{currentLabel}</span>
    </button>
  );
}

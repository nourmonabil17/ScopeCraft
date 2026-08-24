// src/components/common/LanguageToggle.tsx
//
// Segmented English / العربية switch.
//
// Built as a radiogroup rather than two plain buttons: the two options are
// mutually exclusive states of one setting, and `aria-checked` is what
// communicates *which* is active. Two buttons would announce as two unrelated
// actions with no indication of the current language.
//
// Each label is written in its own language (never "Arabic" in English), and
// carries `lang` so a screen reader switches voice rather than reading Arabic
// with an English phoneme set.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import { LOCALES, type Locale } from "@/lib/i18n/translations";
import styles from "./ToggleControls.module.css";

const NATIVE_LABEL: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

const SHORT_LABEL: Record<Locale, string> = {
  en: "EN",
  ar: "ع",
};

export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className={styles.segmented}
      role="radiogroup"
      aria-label={t("header.language.toggle")}
      data-testid="language-toggle"
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            lang={option}
            className={`${styles.segment} ${active ? styles.segmentActive : ""}`}
            onClick={() => setLocale(option)}
            title={NATIVE_LABEL[option]}
            data-testid={`language-option-${option}`}
          >
            <span className={styles.segmentShort} aria-hidden="true">
              {SHORT_LABEL[option]}
            </span>
            <span className={styles.segmentFull}>{NATIVE_LABEL[option]}</span>
          </button>
        );
      })}
    </div>
  );
}

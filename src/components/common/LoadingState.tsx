// src/components/common/LoadingState.tsx
//
// UI state 2 of 7: Loading (owner: Joe).
//
// Two things happen at once here, deliberately kept separate:
//  - A skeleton shows something is happening, for sighted users scanning the
//    page. It is purely decorative (aria-hidden) — a shimmering gray bar
//    conveys nothing a screen reader should announce.
//  - A step list announces real progress through `role="status"` +
//    `aria-live="polite"`, updated on an interval. This is honest progress
//    reporting for a chain we know the general shape of (validate → contact
//    provider → structure → compute), not a fabricated progress percentage —
//    the actual request either completes or fails; these steps describe what
//    is happening, not how close to done it is.
//
// The interval exists only to give a screen-reader user something better than
// silence during a multi-second wait; it does not reflect real server-side
// checkpoints, and stops advancing after the last step rather than looping,
// so a slow request doesn't repeat "Validating your request" forever.

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import styles from "./StateViews.module.css";

const STEP_KEYS: readonly TranslationKey[] = [
  "state.loading.step1",
  "state.loading.step2",
  "state.loading.step3",
  "state.loading.step4",
];

/** How long each step is shown before advancing to the next. Tuned so a fast
 *  response (a second or two) still shows at least the first step, and a slow
 *  one reaches the final, most-accurate step rather than looking stuck. */
const STEP_INTERVAL_MS = 1400;

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex >= STEP_KEYS.length - 1) return;
    const timer = setTimeout(() => setStepIndex((i) => i + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  return (
    <div className={styles.loadingCard} data-testid="loading-state">
      <p className={styles.heading}>{label ?? t("state.loading.label")}…</p>

      <div className={styles.skeletonStack} aria-hidden="true">
        <div className={styles.skeletonRow} style={{ width: "90%" }} />
        <div className={styles.skeletonRow} style={{ width: "75%" }} />
        <div className={styles.skeletonRow} style={{ width: "60%" }} />
      </div>

      {/* Visual step list — not a live region. A live region wrapping this
          would re-announce the entire, ever-growing list on every step. */}
      <ol className={styles.stepList} aria-hidden="true">
        {STEP_KEYS.map((key, i) => (
          <li
            key={key}
            className={
              i < stepIndex
                ? styles.stepDone
                : i === stepIndex
                  ? styles.stepCurrent
                  : styles.stepPending
            }
          >
            {i < stepIndex ? "✓ " : i === stepIndex ? "… " : ""}
            {t(key)}
          </li>
        ))}
      </ol>

      {/* The actual announcement: one short line per step, so a screen-reader
          user hears each transition once instead of the cumulative list. */}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {t(STEP_KEYS[stepIndex])}
      </p>
    </div>
  );
}

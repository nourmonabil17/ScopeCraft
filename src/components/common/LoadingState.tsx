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
//    provider → structure → compute → still working), not a fabricated progress
//    percentage — the actual request either completes or fails; these steps
//    describe what is happening, not how close to done it is.
//
// The interval exists only to give a screen-reader user something better than
// silence during a multi-second wait; it does not reflect real server-side
// checkpoints, and stops advancing after the last step rather than looping,
// so a slow request doesn't repeat "Validating your request" forever.

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import styles from "./LoadingState.module.css";

const STEP_KEYS: readonly TranslationKey[] = [
  "state.loading.step1",
  "state.loading.step2",
  "state.loading.step3",
  "state.loading.step4",
  // Terminal, and the only step that is honest about not knowing. Steps 1-4
  // describe a chain whose shape is known; this one exists because the chain
  // finishes describing itself at 4.2 s while the request can run to 60 s, and
  // silence for the remaining 50 s told a screen-reader user nothing.
  "state.loading.step5",
];

/** How long each step is shown before advancing to the next. Tuned so a fast
 *  response (a second or two) still shows at least the first step, and a slow
 *  one reaches the final, most-accurate step rather than looking stuck. */
const STEP_INTERVAL_MS = 1400;

/** Elapsed time as `m:ss`. Western digits in both locales, matching every other
 *  count in this codebase — the character counters and form.presets.meta all
 *  render String(n), and Intl is reserved for dates. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);

  // Measured from a timestamp, not accumulated by an incrementing counter: a
  // backgrounded tab has its timers throttled, and a counter that ticks once
  // per throttled fire under-reports the wait by however long the user was
  // away. The subtraction is right regardless of how often the timer runs.
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    if (stepIndex >= STEP_KEYS.length - 1) return;
    const timer = setTimeout(() => setStepIndex((i) => i + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  return (
    <div className={`${styles.loadingCard} sc-enter`} data-testid="loading-state">
      <p className={styles.heading}>
        {label ?? t("state.loading.label")}…{" "}
        <span
          className={styles.elapsed}
          aria-hidden="true"
          data-testid="elapsed-time"
        >
          {formatElapsed(elapsedMs)}
        </span>
      </p>

      <div className={styles.skeletonStack} aria-hidden="true">
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
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
      <p className="sc-sr-only" role="status" aria-live="polite">
        {t(STEP_KEYS[stepIndex])}
      </p>
    </div>
  );
}

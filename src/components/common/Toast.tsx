// src/components/common/Toast.tsx
//
// The toast viewport: a positioned container, and nothing more.
//
// It used to be the live region itself — one `role="status" aria-live="polite"`
// wrapping every tone — which meant an error announcement waited for a pause in
// speech. For a failed generation that can mean acting on a plan that was never
// produced. Point 5 moved the announcement onto each toast, through the Toast
// primitive, which gives an error `role="alert"` and everything else
// `role="status"`. This container carries no live-region semantics at all, so
// the roles below are never nested inside a politer ancestor.
//
// The trade, recorded as decision-log entry 36: the old arrangement guaranteed
// a region registered with assistive tech before the first message, which is
// the safer shape for a *polite* announcement. What replaces it relies on a
// freshly inserted element being announced — which is precisely what
// `role="alert"` is specified to do, and the urgent case is the one that was
// broken. Success and info accept the weaker guarantee; an error no longer does.

"use client";

import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { Toast } from "@/components/ui/Toast";
import styles from "./Toast.module.css";

const TONE_ICON = {
  success: "✓",
  error: "⚠",
  info: "ℹ",
} as const;

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();
  const t = useTranslation();

  return (
    <div className={styles.viewport} data-testid="toast-viewport">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          tone={toast.tone}
          className={styles.entering}
          testId="toast"
        >
          <span className={`${styles.icon} ${styles[toast.tone]}`} aria-hidden="true">
            {TONE_ICON[toast.tone]}
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => dismissToast(toast.id)}
            aria-label={t("toast.dismiss")}
          >
            <span aria-hidden="true">×</span>
          </button>
        </Toast>
      ))}
    </div>
  );
}

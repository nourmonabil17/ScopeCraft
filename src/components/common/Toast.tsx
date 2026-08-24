// src/components/common/Toast.tsx
//
// The toast viewport. Rendered once, high in the tree, so the live region is
// already registered with assistive tech before any toast appears.

"use client";

import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import styles from "./Toast.module.css";

const TONE_CLASS = {
  success: styles.success,
  error: styles.error,
  info: styles.info,
} as const;

const TONE_ICON = {
  success: "✓",
  error: "⚠",
  info: "ℹ",
} as const;

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();
  const t = useTranslation();

  return (
    <div
      className={styles.viewport}
      role="status"
      aria-live="polite"
      aria-label={t("toast.region")}
      data-testid="toast-viewport"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${TONE_CLASS[toast.tone]}`}
          data-testid="toast"
          data-tone={toast.tone}
        >
          <span className={styles.icon} aria-hidden="true">
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
        </div>
      ))}
    </div>
  );
}

// src/components/ui/Toast.tsx
//
// Toast primitive (owner: Yousef) — Module C.
//
// Tone decides how the message is announced, not only how it looks. An error
// sent through a polite live region waits for a pause in speech; for a failed
// generation that can mean acting on a plan that was never produced. So error
// is role="alert" and everything else is role="status".
//
// There is deliberately no viewport here. src/components/common/Toast.tsx is
// already a live region rendered once from providers.tsx, and a second one
// would announce every toast twice. Module D re-implements that component's
// insides with this primitive, leaving exactly one live region in the tree.

import type { ReactNode } from "react";
import styles from "./Toast.module.css";

export interface ToastProps {
  tone?: "success" | "error" | "info";
  className?: string;
  children: ReactNode;
}

export function Toast({ tone = "info", className, children }: ToastProps) {
  return (
    <div
      className={[styles.toast, styles[tone], className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

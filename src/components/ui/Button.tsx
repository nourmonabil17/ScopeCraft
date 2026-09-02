// src/components/ui/Button.tsx
//
// Button primitive (owner: Yousef) — Module C.
//
// A real <button>, always. Not a styled <div> with a click handler: the native
// element brings keyboard activation, focus, the disabled semantic and form
// participation for free, and a div version gets every one of those wrong
// quietly.
//
// `busy` is separate from `disabled` on purpose. A disabled control leaves the
// tab order, so a screen-reader user who was on it when a request started loses
// their place and is told nothing about why. `aria-busy` keeps the control
// reachable and announced while its action is suppressed — which matters here
// more than in most apps, because a generation can take the better part of a
// minute.

"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "primary" | "secondary" | "quiet";
  /** Defaults to "button". An unspecified type inside a form submits it. */
  type?: "button" | "submit";
  /** Working, but still focusable and still announced. Not the same as disabled. */
  busy?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  type = "button",
  busy = false,
  disabled = false,
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      // `busy || undefined` rather than `busy`: aria-busy="false" is a valid
      // value that some assistive tech announces, and a button that is simply
      // idle should carry no busy state at all.
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      onClick={busy ? undefined : onClick}
    >
      {children}
    </button>
  );
}

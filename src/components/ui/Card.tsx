// src/components/ui/Card.tsx
//
// Card primitive (owner: Yousef) — Module C.
//
// A surface, never a control. There is deliberately no `onClick` prop: a
// clickable div is invisible to the keyboard and unnamed to a screen reader,
// and every codebase acquires them one convenience at a time. If a card needs
// an action, the action is a real <button> inside it.
//
// `as` exists because the right element depends on context — an article in a
// list of plans, an li inside a real <ul>, a div when it is only a container.
// Getting that wrong is a semantics bug, so the choice is explicit at the call
// site rather than guessed here.

import type { ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps {
  as?: "div" | "article" | "li";
  /** The deferred column's surface: a step back rather than forward. */
  recessed?: boolean;
  /** Dashed rule — content that is present but not committed to. */
  muted?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Element = "div",
  recessed = false,
  muted = false,
  className,
  children,
}: CardProps) {
  return (
    <Element
      className={[
        styles.card,
        recessed ? styles.recessed : null,
        muted ? styles.muted : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Element>
  );
}

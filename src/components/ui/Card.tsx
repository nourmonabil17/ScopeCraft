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
// list of plans, an li inside a real <ul>, a section when the card is a named
// region of the page, a div when it is only a container. Getting that wrong is
// a semantics bug, so the choice is explicit at the call site rather than
// guessed here.
//
// `section` was added at D5 for the board's two columns. A <section> with an
// accessible name is a landmark; a <div> is not. Leaving it off the union
// would have meant the columns losing two named regions to satisfy a type,
// which is the wrong direction to resolve that in.
//
// `id`, `labelledBy` and `testId` are spelled out one at a time rather than
// taken as a {...rest} spread. A spread is shorter and would also let through
// onClick, which is the single thing this component exists to refuse. Three
// named props are the cost of that guarantee.

import type { ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps {
  as?: "div" | "article" | "li" | "section";
  /** The deferred column's surface: a step back rather than forward. */
  recessed?: boolean;
  /** Dashed rule — content that is present but not committed to. */
  muted?: boolean;
  id?: string;
  /** id of the element that names this card, for `aria-labelledby`. */
  labelledBy?: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Element = "div",
  recessed = false,
  muted = false,
  id,
  labelledBy,
  testId,
  className,
  children,
}: CardProps) {
  return (
    <Element
      id={id}
      aria-labelledby={labelledBy}
      data-testid={testId}
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

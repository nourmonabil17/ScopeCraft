// src/components/ui/Field.tsx
//
// Field primitive (owner: Yousef) — Module C.
//
// Every accessible-name failure in a form is the same bug: a label that is
// near a control instead of attached to it. It looks correct on screen and is
// invisible to a screen reader, and it happens because the wiring is repeated
// by hand at each call site. It is done exactly once here instead.
//
// cloneElement supplies only identity and description — id, aria-describedby,
// aria-invalid. The control keeps its own value, handlers and type, because a
// primitive that took ownership of those would have to grow a prop for every
// kind of input this app will ever have.

import { cloneElement, type ReactElement } from "react";
import styles from "./Field.module.css";

/** The subset of props this primitive injects into its child control. */
export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<FieldControlProps>;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Order matters to a screen reader: the hint describes what to enter, the
  // error says what went wrong with what was entered.
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        // Never `false`. aria-invalid="false" is announced by some assistive
        // tech, and an empty field is not an invalid one.
        "aria-invalid": error ? true : undefined,
      })}

      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

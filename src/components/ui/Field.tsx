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
  "aria-errormessage"?: string;
  "aria-required"?: true;
}

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** The translated "(required)" text. Present means required. This primitive
   *  never holds a user-facing string of its own: every one is passed in
   *  already translated, because an English word baked in here would be an
   *  English word on the Arabic page that the i18n types cannot catch. */
  requiredLabel?: string;
  /** Extra element ids to append to aria-describedby — a character counter, a
   *  running total, anything the control is described by but does not own. */
  describedBy?: string[];
  children: ReactElement<FieldControlProps>;
}

export function Field({
  id,
  label,
  hint,
  error,
  requiredLabel,
  describedBy,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Order matters to a screen reader: the hint describes what to enter, the
  // error says what went wrong with what was entered, and anything the caller
  // appends is supplementary to both.
  const describedByValue =
    [hintId, errorId, ...(describedBy ?? [])].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {requiredLabel ? (
          <>
            {/* The glyph is decoration. Screen readers get the word, because
                "asterisk" is not a requirement and punctuation is skipped by
                some verbosity settings entirely. */}
            <span className={styles.requiredMark} aria-hidden="true">
              {"*"}
            </span>
            <span className="sc-sr-only">{requiredLabel}</span>
          </>
        ) : null}
      </label>

      {cloneElement(children, {
        id,
        "aria-describedby": describedByValue,
        // Never `false`. aria-invalid="false" is announced by some assistive
        // tech, and an empty field is not an invalid one.
        "aria-invalid": error ? true : undefined,
        // aria-errormessage is only meaningful while aria-invalid is true, so
        // the two are set together or not at all.
        //
        // The same id also sits in aria-describedby above, which means a
        // screen reader that honours both will announce the error text
        // twice. Deliberate, not an oversight: aria-errormessage support is
        // still patchy enough that aria-describedby stays as the fallback
        // every screen reader actually gets the message from, and a rare
        // double-announcement is a smaller cost than some users never
        // hearing the error at all.
        "aria-errormessage": errorId,
        "aria-required": requiredLabel ? true : undefined,
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

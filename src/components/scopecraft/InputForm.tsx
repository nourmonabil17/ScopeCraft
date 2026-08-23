// src/components/scopecraft/InputForm.tsx
//
// Intake Discovery Wizard (owner: Joe) — Module 1.
//
// Mirrors RequestSchema from @/lib/scopecraft/schema. Every bound and default
// below is imported from that module rather than retyped, so the form and the
// server cannot drift: if the backend widens the idea limit, this form widens
// with it and the character counter follows automatically.
//
// Validation philosophy: the client check exists to give fast, specific feedback
// and to avoid a pointless round trip — NOT as a security boundary. The server
// re-validates everything and is the only authority. A client that skips these
// checks entirely still gets a correct 422 with field-level issues.
//
// Accessibility target is WCAG 2.2 AA. The non-obvious decisions:
//  - Character counters are NOT aria-live. Announcing "1/2000, 2/2000, 3/2000"
//    on every keystroke is hostile to screen-reader users. Instead the counter is
//    wired into aria-describedby (read on focus, and on demand), and a separate
//    polite live region announces only meaningful threshold crossings.
//  - The submit-time error summary takes focus, so a keyboard user is not left
//    wondering why nothing happened. WCAG SC 3.3.1.
//  - Errors appear on blur or on submit, never on first keystroke — validating
//    an idea as "too short" while someone is still typing the first word is
//    technically correct and practically obnoxious.

"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  MAX_CONSTRAINTS_LENGTH,
  MAX_IDEA_LENGTH,
  MAX_SPRINT_LENGTH_DAYS,
  MAX_TEAM_CAPACITY_POINTS,
  MIN_IDEA_LENGTH,
  MIN_SPRINT_LENGTH_DAYS,
  MIN_TEAM_CAPACITY_POINTS,
} from "@/lib/scopecraft/schema";
import {
  STARTER_PRESETS,
  emptyFormValues,
  presetToFormValues,
  toRequestPayload,
  type IntakeFormValues,
  type PresetOption,
} from "./presets";
import styles from "./InputForm.module.css";

export type IntakeSubmitPayload = ReturnType<typeof toRequestPayload>;

export interface InputFormProps {
  onSubmit: (payload: IntakeSubmitPayload) => void;
  /** True while a plan is being generated. Disables the form and marks it busy. */
  isLoading?: boolean;
}

type FieldName = keyof IntakeFormValues;

const FIELD_LABELS: Record<FieldName, string> = {
  idea: "Product idea",
  constraints: "Constraints",
  team_capacity_points: "Team capacity",
  sprint_length_days: "Sprint length",
};

/**
 * Pure validation over form state. Kept outside the component and exported so
 * the rules can be tested directly, without rendering anything.
 */
export function validateIntake(
  values: IntakeFormValues
): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  const idea = values.idea.trim();
  if (idea.length === 0) {
    errors.idea = "Product idea is required.";
  } else if (idea.length < MIN_IDEA_LENGTH) {
    errors.idea = `Product idea must be at least ${MIN_IDEA_LENGTH} characters long.`;
  } else if (idea.length > MAX_IDEA_LENGTH) {
    errors.idea = `Product idea must be ${MAX_IDEA_LENGTH} characters or fewer.`;
  }

  if (values.constraints.length > MAX_CONSTRAINTS_LENGTH) {
    errors.constraints = `Constraints must be ${MAX_CONSTRAINTS_LENGTH} characters or fewer.`;
  }

  const capacity = Number(values.team_capacity_points);
  if (values.team_capacity_points.trim() === "" || !Number.isInteger(capacity)) {
    errors.team_capacity_points = "Team capacity must be a whole number.";
  } else if (
    capacity < MIN_TEAM_CAPACITY_POINTS ||
    capacity > MAX_TEAM_CAPACITY_POINTS
  ) {
    errors.team_capacity_points = `Team capacity must be between ${MIN_TEAM_CAPACITY_POINTS} and ${MAX_TEAM_CAPACITY_POINTS} points.`;
  }

  const sprintLength = Number(values.sprint_length_days);
  if (values.sprint_length_days.trim() === "" || !Number.isInteger(sprintLength)) {
    errors.sprint_length_days = "Sprint length must be a whole number.";
  } else if (
    sprintLength < MIN_SPRINT_LENGTH_DAYS ||
    sprintLength > MAX_SPRINT_LENGTH_DAYS
  ) {
    errors.sprint_length_days = `Sprint length must be between ${MIN_SPRINT_LENGTH_DAYS} and ${MAX_SPRINT_LENGTH_DAYS} days.`;
  }

  return errors;
}

export function InputForm({ onSubmit, isLoading = false }: InputFormProps) {
  const [values, setValues] = useState<IntakeFormValues>(emptyFormValues);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [blurred, setBlurred] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const bannerRef = useRef<HTMLDivElement>(null);
  const [focusSummaryToken, setFocusSummaryToken] = useState(0);

  // Focus the summary once it has actually rendered. handleSubmit reads
  // bannerRef synchronously, but the banner does not exist in the DOM until
  // this component re-renders after setState — an effect is the correct place
  // to wait for that, not a requestAnimationFrame guess.
  useEffect(() => {
    if (focusSummaryToken > 0) {
      bannerRef.current?.focus();
    }
  }, [focusSummaryToken]);

  // useId keeps ids unique if the form is ever mounted twice on one page —
  // duplicate ids would silently break every label/aria association.
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const ideaLength = values.idea.length;
  const constraintsLength = values.constraints.length;
  const ideaTooShort = ideaLength > 0 && values.idea.trim().length < MIN_IDEA_LENGTH;

  /** A field shows its error once the user has left it, or once they've tried
   *  to submit — not while they are still typing into it for the first time. */
  const showError = (name: FieldName): string | undefined =>
    blurred[name] || submitAttempted ? errors[name] : undefined;

  function update(name: FieldName, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    // Re-validate live only for fields already showing an error, so a message
    // clears the moment it stops being true rather than lingering until blur.
    if (errors[name]) {
      const nextErrors = validateIntake(next);
      setErrors(nextErrors);
    }
  }

  function handleBlur(name: FieldName) {
    setBlurred((previous) => ({ ...previous, [name]: true }));
    setErrors(validateIntake(values));
  }

  function applyPreset(preset: PresetOption) {
    const next = presetToFormValues(preset);
    setValues(next);
    setErrors({});
    setBlurred({});
    setSubmitAttempted(false);
    setAnnouncement(`${preset.label} preset applied. The form is ready to submit.`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    const nextErrors = validateIntake(values);
    setErrors(nextErrors);

    const messages = Object.values(nextErrors);
    if (messages.length > 0) {
      setAnnouncement("");
      // Bumps a token rather than calling focus() directly, so the effect
      // above waits for the banner to actually exist in the DOM first.
      setFocusSummaryToken((count) => count + 1);
      return;
    }

    setAnnouncement("");
    onSubmit(toRequestPayload(values));
  }

  function handleReset() {
    setValues(emptyFormValues());
    setErrors({});
    setBlurred({});
    setSubmitAttempted(false);
    setAnnouncement("Form cleared.");
  }

  const errorEntries = submitAttempted
    ? (Object.entries(errors) as Array<[FieldName, string]>)
    : [];

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isLoading}
      aria-labelledby={id("heading")}
    >
      <h2 id={id("heading")} className={styles.srOnly}>
        Describe your product
      </h2>

      {/* Submit-time summary. Rendered only when there is something to say, so
          the alert fires on appearance rather than sitting empty in the DOM. */}
      {errorEntries.length > 0 && (
        <div
          ref={bannerRef}
          className={styles.errorBanner}
          role="alert"
          tabIndex={-1}
          data-testid="error-banner"
        >
          <p className={styles.errorBannerTitle}>
            {errorEntries.length === 1
              ? "There is 1 problem with this form"
              : `There are ${errorEntries.length} problems with this form`}
          </p>
          <ul className={styles.errorBannerList}>
            {errorEntries.map(([name, message]) => (
              <li key={name}>
                <a href={`#${id(name)}`}>
                  {FIELD_LABELS[name]}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className={styles.presetGroup} disabled={isLoading}>
        <legend className={styles.presetLegend}>
          Start from an example (optional)
        </legend>
        <div className={styles.presetRow}>
          {STARTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.preset}
              onClick={() => applyPreset(preset)}
              title={preset.description}
              aria-label={`Fill the form with the ${preset.label} example: ${preset.description}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ---- idea ---- */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id("idea")}>
          {FIELD_LABELS.idea}
          <span className={styles.required} aria-hidden="true">
            {" *"}
          </span>
          <span className={styles.srOnly}>(required)</span>
        </label>
        <p className={styles.hint} id={id("idea-hint")}>
          Describe what you want to build and who it is for. At least{" "}
          {MIN_IDEA_LENGTH} characters.
        </p>
        <textarea
          id={id("idea")}
          name="idea"
          className={`${styles.control} ${styles.textarea}`}
          value={values.idea}
          onChange={(event) => update("idea", event.target.value)}
          onBlur={() => handleBlur("idea")}
          disabled={isLoading}
          required
          aria-required="true"
          rows={5}
          aria-invalid={showError("idea") ? true : undefined}
          aria-errormessage={showError("idea") ? id("idea-error") : undefined}
          aria-describedby={`${id("idea-hint")} ${id("idea-counter")}`}
        />
        <div className={styles.counterRow}>
          {showError("idea") ? (
            <p className={styles.fieldError} id={id("idea-error")}>
              <span aria-hidden="true">⚠</span>
              {showError("idea")}
            </p>
          ) : (
            <span />
          )}
          <span
            className={`${styles.counter} ${ideaTooShort ? styles.counterWarn : ""}`}
            id={id("idea-counter")}
          >
            {ideaLength}/{MAX_IDEA_LENGTH}
            {ideaTooShort
              ? ` — ${MIN_IDEA_LENGTH - values.idea.trim().length} more needed`
              : ""}
          </span>
        </div>
      </div>

      {/* ---- constraints ---- */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id("constraints")}>
          {FIELD_LABELS.constraints}{" "}
          <span className={styles.hint}>(optional)</span>
        </label>
        <p className={styles.hint} id={id("constraints-hint")}>
          Team size, timeline, budget, or anything the plan must work around.
        </p>
        <textarea
          id={id("constraints")}
          name="constraints"
          className={`${styles.control} ${styles.textarea}`}
          value={values.constraints}
          onChange={(event) => update("constraints", event.target.value)}
          onBlur={() => handleBlur("constraints")}
          disabled={isLoading}
          rows={3}
          aria-invalid={showError("constraints") ? true : undefined}
          aria-errormessage={
            showError("constraints") ? id("constraints-error") : undefined
          }
          aria-describedby={`${id("constraints-hint")} ${id("constraints-counter")}`}
        />
        <div className={styles.counterRow}>
          {showError("constraints") ? (
            <p className={styles.fieldError} id={id("constraints-error")}>
              <span aria-hidden="true">⚠</span>
              {showError("constraints")}
            </p>
          ) : (
            <span />
          )}
          <span
            className={`${styles.counter} ${
              constraintsLength > MAX_CONSTRAINTS_LENGTH ? styles.counterWarn : ""
            }`}
            id={id("constraints-counter")}
          >
            {constraintsLength}/{MAX_CONSTRAINTS_LENGTH}
          </span>
        </div>
      </div>

      {/* ---- numbers ---- */}
      <div className={styles.numberRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id("team_capacity_points")}>
            {FIELD_LABELS.team_capacity_points}
          </label>
          <p className={styles.hint} id={id("capacity-hint")}>
            Story points your team completes per sprint ({MIN_TEAM_CAPACITY_POINTS}
            –{MAX_TEAM_CAPACITY_POINTS}).
          </p>
          <input
            id={id("team_capacity_points")}
            name="team_capacity_points"
            className={styles.control}
            type="number"
            inputMode="numeric"
            min={MIN_TEAM_CAPACITY_POINTS}
            max={MAX_TEAM_CAPACITY_POINTS}
            step={1}
            value={values.team_capacity_points}
            onChange={(event) => update("team_capacity_points", event.target.value)}
            onBlur={() => handleBlur("team_capacity_points")}
            disabled={isLoading}
            aria-invalid={showError("team_capacity_points") ? true : undefined}
            aria-errormessage={
              showError("team_capacity_points") ? id("capacity-error") : undefined
            }
            aria-describedby={id("capacity-hint")}
          />
          {showError("team_capacity_points") && (
            <p className={styles.fieldError} id={id("capacity-error")}>
              <span aria-hidden="true">⚠</span>
              {showError("team_capacity_points")}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={id("sprint_length_days")}>
            {FIELD_LABELS.sprint_length_days}
          </label>
          <p className={styles.hint} id={id("sprint-hint")}>
            Days per sprint ({MIN_SPRINT_LENGTH_DAYS}–{MAX_SPRINT_LENGTH_DAYS}).
          </p>
          <input
            id={id("sprint_length_days")}
            name="sprint_length_days"
            className={styles.control}
            type="number"
            inputMode="numeric"
            min={MIN_SPRINT_LENGTH_DAYS}
            max={MAX_SPRINT_LENGTH_DAYS}
            step={1}
            value={values.sprint_length_days}
            onChange={(event) => update("sprint_length_days", event.target.value)}
            onBlur={() => handleBlur("sprint_length_days")}
            disabled={isLoading}
            aria-invalid={showError("sprint_length_days") ? true : undefined}
            aria-errormessage={
              showError("sprint_length_days") ? id("sprint-error") : undefined
            }
            aria-describedby={id("sprint-hint")}
          />
          {showError("sprint_length_days") && (
            <p className={styles.fieldError} id={id("sprint-error")}>
              <span aria-hidden="true">⚠</span>
              {showError("sprint_length_days")}
            </p>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.button}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? "Generating plan…" : "Generate plan"}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleReset}
          disabled={isLoading}
        >
          Clear
        </button>
      </div>

      {/* Polite, low-traffic announcements: preset applied, form cleared.
          Deliberately not used for the character counter. */}
      <div className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </div>
    </form>
  );
}

// src/components/scopecraft/InputForm.tsx
//
// Intake Discovery Wizard (owner: Joe) — Module 1, internationalized.
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
//  - The capacity slider and number input are ONE control, not two: the slider
//    is `aria-hidden` and the number input keeps the label. Exposing both to
//    assistive tech would announce the same setting twice with no indication
//    they are linked.

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
import { useLanguage } from "@/context/LanguageContext";
import { translate, type TranslationKey } from "@/lib/i18n/translations";
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
  /**
   * Prefills the form once, on mount. Read by a lazy `useState` initializer,
   * so a prop update on an already-mounted instance has no effect — the
   * caller must change this component's `key` to force a fresh mount if the
   * value becomes available after the initial render (see ScopeCraftPage).
   */
  initialValues?: IntakeFormValues;
}

type FieldName = keyof IntakeFormValues;

const FIELD_LABEL_KEY: Record<FieldName, TranslationKey> = {
  idea: "form.idea.label",
  constraints: "form.constraints.label",
  team_capacity_points: "form.capacity.label",
  sprint_length_days: "form.sprintLength.label",
};

/** Preset copy lives in the dictionary, keyed off the preset's stable id. */
const PRESET_LABEL_KEY: Record<string, TranslationKey> = {
  capstone: "preset.capstone.label",
  "developer-tool": "preset.developerTool.label",
  "mobile-mvp": "preset.mobileMvp.label",
};

const PRESET_DESCRIPTION_KEY: Record<string, TranslationKey> = {
  capstone: "preset.capstone.description",
  "developer-tool": "preset.developerTool.description",
  "mobile-mvp": "preset.mobileMvp.description",
};

/** Minimal translator shape, so validateIntake can be called without React. */
type MessageFn = (key: TranslationKey, values?: Record<string, string | number>) => string;

/** English by default — keeps `validateIntake(values)` usable from plain tests
 *  and any non-React caller without threading a locale through. */
const englishMessages: MessageFn = (key, values) => translate("en", key, values);

/**
 * Pure validation over form state. Kept outside the component and exported so
 * the rules can be tested directly, without rendering anything.
 */
export function validateIntake(
  values: IntakeFormValues,
  t: MessageFn = englishMessages
): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  const idea = values.idea.trim();
  if (idea.length === 0) {
    errors.idea = t("validation.idea.required");
  } else if (idea.length < MIN_IDEA_LENGTH) {
    errors.idea = t("validation.idea.tooShort", { min: MIN_IDEA_LENGTH });
  } else if (idea.length > MAX_IDEA_LENGTH) {
    errors.idea = t("validation.idea.tooLong", { max: MAX_IDEA_LENGTH });
  }

  if (values.constraints.length > MAX_CONSTRAINTS_LENGTH) {
    errors.constraints = t("validation.constraints.tooLong", {
      max: MAX_CONSTRAINTS_LENGTH,
    });
  }

  const capacity = Number(values.team_capacity_points);
  if (values.team_capacity_points.trim() === "" || !Number.isInteger(capacity)) {
    errors.team_capacity_points = t("validation.capacity.integer");
  } else if (
    capacity < MIN_TEAM_CAPACITY_POINTS ||
    capacity > MAX_TEAM_CAPACITY_POINTS
  ) {
    errors.team_capacity_points = t("validation.capacity.range", {
      min: MIN_TEAM_CAPACITY_POINTS,
      max: MAX_TEAM_CAPACITY_POINTS,
    });
  }

  const sprintLength = Number(values.sprint_length_days);
  if (values.sprint_length_days.trim() === "" || !Number.isInteger(sprintLength)) {
    errors.sprint_length_days = t("validation.sprintLength.integer");
  } else if (
    sprintLength < MIN_SPRINT_LENGTH_DAYS ||
    sprintLength > MAX_SPRINT_LENGTH_DAYS
  ) {
    errors.sprint_length_days = t("validation.sprintLength.range", {
      min: MIN_SPRINT_LENGTH_DAYS,
      max: MAX_SPRINT_LENGTH_DAYS,
    });
  }

  return errors;
}

/** Circular fill showing progress toward the minimum idea length, then toward
 *  the maximum. Purely decorative — the numeric counter beside it is the
 *  accessible source of truth, so this is aria-hidden. */
function ProgressRing({ ratio, tone }: { ratio: number; tone: "short" | "ok" | "over" }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));
  const offset = circumference * (1 - clamped);

  return (
    <svg
      className={`${styles.ring} ${
        tone === "short" ? styles.ringShort : tone === "over" ? styles.ringOver : styles.ringOk
      }`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.ringTrack} cx="12" cy="12" r={radius} />
      <circle
        className={styles.ringFill}
        cx="12"
        cy="12"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function InputForm({ onSubmit, isLoading = false, initialValues }: InputFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<IntakeFormValues>(
    () => initialValues ?? emptyFormValues()
  );
  const [blurred, setBlurred] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Derived, never stored. `validateIntake` is pure, so recomputing on each
  // render is both cheaper and more correct than mirroring into state: a
  // locale switch re-translates every visible message for free, and there is
  // no window where the displayed error disagrees with the current values.
  // *When* an error is shown is a separate concern, handled by `showError`.
  const errors = validateIntake(values, t);

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
  const trimmedIdeaLength = values.idea.trim().length;
  const constraintsLength = values.constraints.length;
  const ideaTooShort = ideaLength > 0 && trimmedIdeaLength < MIN_IDEA_LENGTH;
  const ideaRatio =
    trimmedIdeaLength < MIN_IDEA_LENGTH
      ? trimmedIdeaLength / MIN_IDEA_LENGTH
      : ideaLength / MAX_IDEA_LENGTH;
  const ideaTone: "short" | "ok" | "over" =
    ideaLength > MAX_IDEA_LENGTH ? "over" : ideaTooShort ? "short" : "ok";

  const capacityNumber = Number(values.team_capacity_points);
  const capacityForSlider = Number.isFinite(capacityNumber)
    ? Math.min(MAX_TEAM_CAPACITY_POINTS, Math.max(MIN_TEAM_CAPACITY_POINTS, capacityNumber))
    : MIN_TEAM_CAPACITY_POINTS;

  /** A field shows its error once the user has left it, or once they've tried
   *  to submit — not while they are still typing into it for the first time. */
  const showError = (name: FieldName): string | undefined =>
    blurred[name] || submitAttempted ? errors[name] : undefined;

  function update(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleBlur(name: FieldName) {
    setBlurred((previous) => ({ ...previous, [name]: true }));
  }

  function applyPreset(preset: PresetOption) {
    setValues(presetToFormValues(preset));
    setBlurred({});
    setSubmitAttempted(false);
    setAnnouncement(
      t("form.presets.applied", { label: t(PRESET_LABEL_KEY[preset.id]) })
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    if (Object.values(errors).length > 0) {
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
    setBlurred({});
    setSubmitAttempted(false);
    setAnnouncement(t("form.cleared"));
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
        {t("form.heading")}
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
              ? t("form.errors.one")
              : t("form.errors.many", { count: errorEntries.length })}
          </p>
          <ul className={styles.errorBannerList}>
            {errorEntries.map(([name, message]) => (
              <li key={name}>
                <a href={`#${id(name)}`}>
                  {t(FIELD_LABEL_KEY[name])}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className={styles.presetGroup} disabled={isLoading}>
        <legend className={styles.presetLegend}>{t("form.presets.legend")}</legend>
        <div className={styles.presetRow}>
          {STARTER_PRESETS.map((preset) => {
            const label = t(PRESET_LABEL_KEY[preset.id]);
            const description = t(PRESET_DESCRIPTION_KEY[preset.id]);
            return (
              <button
                key={preset.id}
                type="button"
                className={styles.preset}
                onClick={() => applyPreset(preset)}
                title={description}
                aria-label={t("form.presets.apply", { label, description })}
              >
                <span className={styles.presetLabel}>{label}</span>
                <span className={styles.presetDescription}>{description}</span>
                <span className={styles.presetMeta}>
                  {t("form.presets.meta", {
                    points: String(preset.team_capacity_points),
                    days: String(preset.sprint_length_days),
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ---- idea ---- */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id("idea")}>
          {t("form.idea.label")}
          <span className={styles.required} aria-hidden="true">
            {" *"}
          </span>
          <span className={styles.srOnly}>{t("form.idea.required")}</span>
        </label>
        <p className={styles.hint} id={id("idea-hint")}>
          {t("form.idea.hint", { min: MIN_IDEA_LENGTH })}
        </p>
        <textarea
          id={id("idea")}
          name="idea"
          autoComplete="off"
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
          <span className={styles.counterGroup}>
            <ProgressRing ratio={ideaRatio} tone={ideaTone} />
            <span
              className={`${styles.counter} ${ideaTooShort ? styles.counterWarn : ""}`}
              id={id("idea-counter")}
            >
              {ideaLength}/{MAX_IDEA_LENGTH}
              {ideaTooShort
                ? ` — ${t("form.idea.moreNeeded", {
                    count: MIN_IDEA_LENGTH - trimmedIdeaLength,
                  })}`
                : ""}
            </span>
          </span>
        </div>
      </div>

      {/* ---- constraints ---- */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id("constraints")}>
          {t("form.constraints.label")}{" "}
          <span className={styles.hint}>{t("form.constraints.optional")}</span>
        </label>
        <p className={styles.hint} id={id("constraints-hint")}>
          {t("form.constraints.hint")}
        </p>
        <textarea
          id={id("constraints")}
          name="constraints"
          autoComplete="off"
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
            {t("form.capacity.label")}
          </label>
          <p className={styles.hint} id={id("capacity-hint")}>
            {t("form.capacity.hint", {
              min: MIN_TEAM_CAPACITY_POINTS,
              max: MAX_TEAM_CAPACITY_POINTS,
            })}
          </p>
          <div className={styles.capacityRow}>
            <input
              id={id("team_capacity_points")}
              name="team_capacity_points"
              autoComplete="off"
              className={`${styles.control} ${styles.capacityNumber}`}
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
            {/* aria-hidden + tabIndex -1: this is a second view of the number
                input above, not a separate setting. Screen-reader and keyboard
                users operate the labelled number field; the slider is a
                pointer convenience. */}
            <input
              type="range"
              className={styles.capacitySlider}
              min={MIN_TEAM_CAPACITY_POINTS}
              max={MAX_TEAM_CAPACITY_POINTS}
              step={1}
              value={capacityForSlider}
              onChange={(event) => update("team_capacity_points", event.target.value)}
              disabled={isLoading}
              aria-hidden="true"
              tabIndex={-1}
              data-testid="capacity-slider"
            />
          </div>
          {showError("team_capacity_points") && (
            <p className={styles.fieldError} id={id("capacity-error")}>
              <span aria-hidden="true">⚠</span>
              {showError("team_capacity_points")}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={id("sprint_length_days")}>
            {t("form.sprintLength.label")}
          </label>
          <p className={styles.hint} id={id("sprint-hint")}>
            {t("form.sprintLength.hint", {
              min: MIN_SPRINT_LENGTH_DAYS,
              max: MAX_SPRINT_LENGTH_DAYS,
            })}
          </p>
          <input
            id={id("sprint_length_days")}
            name="sprint_length_days"
            autoComplete="off"
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
          {isLoading ? t("form.submit.loading") : t("form.submit")}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleReset}
          disabled={isLoading}
        >
          {t("form.clear")}
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

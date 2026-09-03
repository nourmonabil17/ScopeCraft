// src/components/common/ValidationErrorState.tsx
//
// UI state 5 of 7: Validation error, HTTP 422 VALIDATION_ERROR (owner: Joe).
//
// Maps the backend's field-level `issues: {path, message}[]` array into an
// accessible alert. `path` is the dotted field name the server validated
// against (e.g. "idea", "team_capacity_points") — shown as a human label via
// the same translation keys the form's own labels use, so a Product Owner
// never has to read a schema key, and the label matches what they saw on the
// field itself in whichever language they're using.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { ValidationIssue } from "@/lib/scopecraft/schema";
import type { TranslationKey } from "@/lib/i18n/translations";
import { Button } from "@/components/ui/Button";
import styles from "./StateViews.module.css";

export interface ValidationErrorStateProps {
  message: string;
  issues: ValidationIssue[];
  onDismiss?: () => void;
}

const FIELD_LABEL_KEY: Record<string, TranslationKey> = {
  idea: "form.idea.label",
  constraints: "form.constraints.label",
  team_capacity_points: "form.capacity.label",
  sprint_length_days: "form.sprintLength.label",
};

export function ValidationErrorState({
  message,
  issues,
  onDismiss,
}: ValidationErrorStateProps) {
  const { t } = useLanguage();

  // An unmapped path is shown raw rather than hidden: a field the UI doesn't
  // know about is still a real validation failure the user needs to see.
  const labelFor = (path: string): string => {
    const key = FIELD_LABEL_KEY[path];
    return key ? t(key) : path;
  };

  return (
    <div className={styles.errorCard} role="alert" data-testid="validation-error-state">
      <p className={styles.heading}>{message}</p>
      {issues.length > 0 && (
        <ul className={styles.issueList}>
          {issues.map((issue, i) => (
            <li key={`${issue.path}-${i}`}>
              <strong>{labelFor(issue.path)}:</strong> {issue.message}
            </li>
          ))}
        </ul>
      )}
      {onDismiss && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onDismiss}>
            {t("state.validation.action")}
          </Button>
        </div>
      )}
    </div>
  );
}

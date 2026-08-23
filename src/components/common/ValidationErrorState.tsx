// src/components/common/ValidationErrorState.tsx
//
// UI state 5 of 7: Validation error, HTTP 422 VALIDATION_ERROR (owner: Joe).
//
// Maps the backend's field-level `issues: {path, message}[]` array into an
// accessible alert. `path` is the dotted field name the server validated
// against (e.g. "idea", "team_capacity_points") — shown as a human label via
// FIELD_LABELS rather than the raw path, since a Product Owner should never
// have to read a schema key to understand what to fix.

import type { ValidationIssue } from "@/lib/scopecraft/schema";
import styles from "./StateViews.module.css";

export interface ValidationErrorStateProps {
  message: string;
  issues: ValidationIssue[];
  onDismiss?: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  idea: "Product idea",
  constraints: "Constraints",
  team_capacity_points: "Team capacity",
  sprint_length_days: "Sprint length",
  "(root)": "Request",
};

function labelFor(path: string): string {
  return FIELD_LABELS[path] ?? path;
}

export function ValidationErrorState({
  message,
  issues,
  onDismiss,
}: ValidationErrorStateProps) {
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
          <button type="button" className={styles.startOverButton} onClick={onDismiss}>
            Fix and try again
          </button>
        </div>
      )}
    </div>
  );
}

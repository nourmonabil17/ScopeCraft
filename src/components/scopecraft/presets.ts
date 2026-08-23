// src/components/scopecraft/presets.ts
//
// Starter presets for the intake wizard (owner: Joe).
//
// These exist so a reviewer, a teammate, or a demo audience can get a real plan
// out of the product in one click, without having to invent a product idea on
// the spot. Every preset is a complete, valid request: each idea clears the
// 20-character minimum by a wide margin and each names a concrete user, a
// concrete outcome, and enough scope to produce more than one user story.
//
// The values here are the single source of truth for the preset buttons AND for
// the tests that assert them, so a copy edit can never leave the two disagreeing.

import {
  DEFAULT_SPRINT_LENGTH_DAYS,
  DEFAULT_TEAM_CAPACITY_POINTS,
  type ScopeCraftRequest,
} from "@/lib/scopecraft/schema";

/** The form's own state. Mirrors RequestSchema, but numbers are held as strings
 *  because an <input type="number"> is empty-able and mid-edit values like "1"
 *  on the way to "15" must not be coerced or clamped while the user types. */
export interface IntakeFormValues {
  idea: string;
  constraints: string;
  team_capacity_points: string;
  sprint_length_days: string;
}

export interface PresetOption {
  /** Stable key — used for React keys and test lookups, never displayed. */
  id: string;
  /** Button text. Short enough to sit in a row on a phone. */
  label: string;
  /** Announced to screen readers and shown as the button's title. */
  description: string;
  idea: string;
  constraints: string;
  team_capacity_points: number;
  sprint_length_days: number;
}

export const STARTER_PRESETS: readonly PresetOption[] = [
  {
    id: "capstone",
    label: "Student capstone",
    description:
      "A collaborative study platform, sized for a team of four junior developers on two-week sprints.",
    idea:
      "A collaborative study platform where university students can form study groups, share annotated lecture notes, track milestone deliverables, and schedule peer tutoring sessions with calendar sync.",
    constraints:
      "Team of 4 junior developers, 2-week sprints, zero budget for paid third-party APIs",
    team_capacity_points: 30,
    sprint_length_days: 14,
  },
  {
    id: "developer-tool",
    label: "Developer tool",
    description:
      "A Next.js bundle analyzer with a CLI and dashboard, constrained by CI runtime.",
    idea:
      "A CLI tool and dashboard that analyzes Next.js bundles, detects unused npm dependencies, flags layout shift regressions, and outputs actionable pull request comments.",
    constraints:
      "Must support Next.js App Router, run under 10 seconds in CI pipelines",
    team_capacity_points: 30,
    sprint_length_days: 14,
  },
  {
    id: "mobile-mvp",
    label: "Mobile MVP",
    description:
      "An offline-first habit tracker for a small mobile team on a one-week cadence.",
    idea:
      "An offline-first mobile app that helps shift workers log daily habits, visualise streaks across irregular schedules, and sync to the cloud once a connection returns without losing edits made while offline.",
    constraints:
      "Two engineers, one-week sprints, must work fully offline and sync later",
    team_capacity_points: 20,
    sprint_length_days: 7,
  },
] as const;

/**
 * Turns a preset into form state.
 *
 * Returns a fresh object every call rather than handing back a shared reference,
 * so a user editing the textarea after clicking a preset cannot mutate the
 * preset itself and poison the next click.
 */
export function presetToFormValues(preset: PresetOption): IntakeFormValues {
  return {
    idea: preset.idea,
    constraints: preset.constraints,
    team_capacity_points: String(preset.team_capacity_points),
    sprint_length_days: String(preset.sprint_length_days),
  };
}

/** The state an untouched form starts in — schema defaults, not magic numbers. */
export function emptyFormValues(): IntakeFormValues {
  return {
    idea: "",
    constraints: "",
    team_capacity_points: String(DEFAULT_TEAM_CAPACITY_POINTS),
    sprint_length_days: String(DEFAULT_SPRINT_LENGTH_DAYS),
  };
}

/** Looks a preset up by id. Returns undefined rather than throwing — a missing
 *  preset is a caller bug, not a user-facing failure. */
export function findPreset(id: string): PresetOption | undefined {
  return STARTER_PRESETS.find((preset) => preset.id === id);
}

/**
 * Narrows form state to the request payload the API expects.
 *
 * `constraints` is omitted entirely when blank rather than sent as "", because
 * RequestSchema treats it as optional and an empty string is not the same thing
 * as "the user did not answer".
 */
export function toRequestPayload(
  values: IntakeFormValues
): Omit<ScopeCraftRequest, "constraints"> & { constraints?: string } {
  const constraints = values.constraints.trim();
  return {
    idea: values.idea.trim(),
    ...(constraints.length > 0 ? { constraints } : {}),
    team_capacity_points: Number(values.team_capacity_points),
    sprint_length_days: Number(values.sprint_length_days),
  };
}

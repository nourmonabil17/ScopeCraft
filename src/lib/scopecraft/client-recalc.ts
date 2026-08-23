// src/lib/scopecraft/client-recalc.ts
//
// Client-side deterministic recompute for human-in-the-loop backlog editing
// (owner: Joe). Pure functions, no I/O, no network — the whole point is that
// moving a story between columns or editing its points must never re-call the
// backend LLM. Runs identically on server or client; nothing here is
// component-specific, so it is independently testable.
//
// Deliberately NOT the same code path as the server's `scheduleSprints` /
// `summarizeSprintPlan` in tools.ts. Those implement "generate a fresh
// capacity-bounded plan from priority order" — re-running that greedy packer
// after every edit would silently override the human's manual choice, which
// defeats the point of human-in-the-loop editing. This module instead answers
// a narrower question: "given the user's current include/defer assignment,
// is it still capacity-valid, and what does it cost?" `priorityScore` is
// reused as-is from tools.ts because the scoring formula itself does not
// change just because editing moved to the client — reimplementing it here
// would risk the two silently drifting apart.

import { priorityScore, PlanningError } from "./tools";
import { toMoscow } from "./taxonomy";
import type { MoscowBucket } from "./schema";
import {
  MAX_STORY_POINTS,
  MAX_RISK,
  MAX_VALUE,
  MIN_STORY_POINTS,
  MIN_RISK,
  MIN_VALUE,
} from "./schema";

export type BoardColumn = "included" | "deferred";

/** One story as the interactive board edits it. A superset of what the API
 *  response carries, plus the two fields the user can change. */
export interface BoardStory {
  storyId: string;
  asA: string;
  iWant: string;
  soThat: string;
  value: number;
  risk: number;
  points: number;
  dependencies: string[];
  column: BoardColumn;
}

export type CapacityState = "ok" | "warning" | "over";

export interface CapacitySummary {
  capacityPoints: number;
  committedPoints: number;
  remainingPoints: number;
  /** 0..1+, uncapped — a value above 1 is exactly the over-capacity signal. */
  utilization: number;
  state: CapacityState;
}

/** Utilization at or above this fraction is flagged before the hard over-
 *  capacity line, so a team sees the warning while there is still time to act
 *  rather than only after they have already overcommitted. */
const WARNING_UTILIZATION = 0.9;

/**
 * Sums the points of every story currently in the "included" column and
 * classifies the result against capacity. Pure arithmetic — no packing, no
 * reordering. `capacityPoints` is trusted from the request that produced the
 * plan, so it is taken as a parameter rather than recomputed.
 */
export function recalcCapacity(
  stories: readonly BoardStory[],
  capacityPoints: number
): CapacitySummary {
  const committedPoints = stories
    .filter((story) => story.column === "included")
    .reduce((total, story) => total + story.points, 0);

  const remainingPoints = capacityPoints - committedPoints;
  const utilization = capacityPoints > 0 ? committedPoints / capacityPoints : 0;

  const state: CapacityState =
    committedPoints > capacityPoints
      ? "over"
      : utilization >= WARNING_UTILIZATION
        ? "warning"
        : "ok";

  return { capacityPoints, committedPoints, remainingPoints, utilization, state };
}

/**
 * Recomputes one story's priority score and MoSCoW bucket from its current
 * value/risk/points. Used after a points edit, since the score is a function
 * of effort.
 *
 * Returns `null` for a mid-edit value that is momentarily out of range (e.g.
 * the points field cleared to type a new number) rather than throwing — the
 * board should show a stale badge for one keystroke, not crash.
 */
export function recalcScore(
  story: Pick<BoardStory, "value" | "risk" | "points">
): { score: number; moscow: MoscowBucket } | null {
  const { value, risk, points } = story;
  const inRange =
    Number.isInteger(value) && value >= MIN_VALUE && value <= MAX_VALUE &&
    Number.isInteger(risk) && risk >= MIN_RISK && risk <= MAX_RISK &&
    Number.isInteger(points) && points >= MIN_STORY_POINTS && points <= MAX_STORY_POINTS;

  if (!inRange) return null;

  try {
    const score = priorityScore({ storyId: "", value, risk, effort: points });
    return { score, moscow: toMoscow(score) };
  } catch (error) {
    if (error instanceof PlanningError) return null;
    throw error;
  }
}

/** Toggles one story's column, returning a new array (the board's state is
 *  owned by React, so mutation would fight the render cycle). */
export function toggleColumn(
  stories: readonly BoardStory[],
  storyId: string
): BoardStory[] {
  return stories.map((story) =>
    story.storyId === storyId
      ? { ...story, column: story.column === "included" ? "deferred" : "included" }
      : story
  );
}

/** Applies an edited points value to one story. The caller is responsible for
 *  clamping/parsing the raw input; this just replaces the field. */
export function setPoints(
  stories: readonly BoardStory[],
  storyId: string,
  points: number
): BoardStory[] {
  return stories.map((story) =>
    story.storyId === storyId ? { ...story, points } : story
  );
}

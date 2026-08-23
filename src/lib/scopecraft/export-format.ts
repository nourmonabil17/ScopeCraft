// src/lib/scopecraft/export-format.ts
//
// Pure formatters for the export actions (owner: Joe). No DOM, no clipboard,
// no file APIs — those live in ExportActions.tsx, which is what actually needs
// jsdom to test. Formatting logic is kept separate specifically so it can be
// unit-tested without rendering anything.

import type { MoscowBucket, ScopeCraftResponse } from "./schema";
import type { BoardStory } from "./client-recalc";

const MOSCOW_LABEL: Record<MoscowBucket, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

/** Escapes the handful of characters that would otherwise corrupt a Markdown
 *  table cell or list item: a literal `|` breaks a table row, and `\n` would
 *  break both. Model prose is untrusted text, so this always runs. */
function mdEscape(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/**
 * Renders the full PRD as Markdown, built field-by-field from structured data
 * — never by dumping raw model prose. Every one of the 11 mandatory fields
 * gets its own section, in the same order the handbook lists them.
 */
export interface BoardOverride {
  stories: readonly BoardStory[];
  capacityPoints: number;
  committedPoints: number;
}

export function toMarkdown(data: ScopeCraftResponse, boardOverride?: BoardOverride): string {
  const lines: string[] = [];

  lines.push("# Product Requirements Document", "");
  lines.push("## Problem", "", data.problem, "");
  lines.push("## Target user", "", data.target_user, "");

  lines.push("## Goals", "");
  for (const goal of data.goals) lines.push(`- ${goal}`);
  lines.push("");

  lines.push("## Non-goals", "");
  for (const item of data.non_goals) lines.push(`- ${item}`);
  lines.push("");

  lines.push("## Requirements", "");
  for (const requirement of data.requirements) lines.push(`- ${requirement}`);
  lines.push("");

  lines.push("## User stories", "");
  for (const story of data.user_stories) {
    const score = data.priority[story.id];
    const bucket = data.moscow[story.id];
    lines.push(`### ${story.id} — ${MOSCOW_LABEL[bucket] ?? bucket}`, "");
    lines.push(`As a ${story.as_a}, I want ${story.i_want}, so that ${story.so_that}.`, "");
    lines.push(
      `Value ${story.value}/5 · Risk ${story.risk}/5 · Points ${story.points} · Priority score ${score}`,
      ""
    );
    if (story.dependencies.length > 0) {
      lines.push(`Depends on: ${story.dependencies.join(", ")}`, "");
    }
    lines.push("Acceptance criteria:", "");
    for (const criterion of story.acceptance_criteria) lines.push(`- [ ] ${criterion}`);
    lines.push("");
  }

  lines.push("## Overall acceptance criteria", "");
  for (const criterion of data.acceptance_criteria) lines.push(`- [ ] ${criterion}`);
  lines.push("");

  lines.push("## Risks", "");
  lines.push("| ID | Description | Impact | Likelihood |");
  lines.push("|---|---|---|---|");
  for (const risk of data.risks) {
    lines.push(
      `| ${risk.id} | ${mdEscape(risk.description)} | ${risk.impact} | ${risk.likelihood} |`
    );
  }
  lines.push("");

  lines.push("## Sprint plan", "");
  lines.push("| Story | Priority score | Effort | Sprint |");
  lines.push("|---|---|---|---|");
  for (const item of data.sprint) {
    lines.push(`| ${item.story_id} | ${item.priority_score} | ${item.effort} | ${item.sprint} |`);
  }
  lines.push("");

  const commitment = boardOverride
    ? {
        capacity: boardOverride.capacityPoints,
        committed: boardOverride.committedPoints,
        included: boardOverride.stories
          .filter((s) => s.column === "included")
          .map((s) => s.storyId),
        deferred: boardOverride.stories
          .filter((s) => s.column === "deferred")
          .map((s) => s.storyId),
      }
    : {
        capacity: data.sprint_plan.capacity_points,
        committed: data.sprint_plan.committed_points,
        included: data.sprint_plan.included,
        deferred: data.sprint_plan.deferred,
      };

  lines.push(
    "## Sprint 1 commitment",
    "",
    boardOverride
      ? "_Reflects manual adjustments made on the interactive board._"
      : "_As generated, before any manual adjustment._",
    "",
    `Capacity: ${commitment.capacity} points · Committed: ${commitment.committed} points`,
    "",
    `Committed: ${commitment.included.join(", ") || "(none)"}`,
    "",
    `Deferred: ${commitment.deferred.join(", ") || "(none)"}`,
    ""
  );

  lines.push(
    "---",
    "",
    "_Priority, effort, MoSCoW, and sprint placement are computed deterministically — see the Evidence panel for the formulas. Nothing above commits a team to a delivery date; scope belongs to the Product Owner._"
  );

  return lines.join("\n");
}

/**
 * The backlog as JSON, reflecting the board's *current* state if the caller
 * passes edited stories — otherwise it falls back to the server's original
 * sprint_plan. This is why the shape is a plain object rather than the raw
 * ScopeCraftResponse: the download should capture what the Product Owner
 * actually decided, not just what the model first proposed.
 */
export interface BacklogExport {
  generated_at: string;
  capacity_points: number;
  committed_points: number;
  stories: Array<{
    id: string;
    as_a: string;
    i_want: string;
    so_that: string;
    points: number;
    value: number;
    risk: number;
    priority_score: number;
    moscow: MoscowBucket;
    column: "included" | "deferred";
  }>;
}

export function toBacklogJson(
  data: ScopeCraftResponse,
  boardOverride?: BoardOverride & {
    liveScores: Readonly<Record<string, { score: number; moscow: MoscowBucket }>>;
  }
): BacklogExport {
  if (boardOverride) {
    return {
      generated_at: new Date().toISOString(),
      capacity_points: boardOverride.capacityPoints,
      committed_points: boardOverride.committedPoints,
      stories: boardOverride.stories.map((story) => ({
        id: story.storyId,
        as_a: story.asA,
        i_want: story.iWant,
        so_that: story.soThat,
        points: story.points,
        value: story.value,
        risk: story.risk,
        priority_score:
          boardOverride.liveScores[story.storyId]?.score ?? data.priority[story.storyId] ?? 0,
        moscow: boardOverride.liveScores[story.storyId]?.moscow ?? data.moscow[story.storyId],
        column: story.column,
      })),
    };
  }

  const includedIds = new Set(data.sprint_plan.included);
  return {
    generated_at: new Date().toISOString(),
    capacity_points: data.sprint_plan.capacity_points,
    committed_points: data.sprint_plan.committed_points,
    stories: data.user_stories.map((story) => ({
      id: story.id,
      as_a: story.as_a,
      i_want: story.i_want,
      so_that: story.so_that,
      points: story.points,
      value: story.value,
      risk: story.risk,
      priority_score: data.priority[story.id],
      moscow: data.moscow[story.id],
      column: includedIds.has(story.id) ? "included" : "deferred",
    })),
  };
}

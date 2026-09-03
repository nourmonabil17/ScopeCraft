// src/components/scopecraft/InteractiveSprintBoard.tsx
//
// Interactive sprint backlog (owner: Joe) — Module 2, internationalized.
//
// Human-in-the-loop editing over the server's sprint_plan: a Product Owner can
// move a story between "committed" and "deferred", or adjust its points, and
// see the capacity math update instantly. Every recompute in this component
// runs through src/lib/scopecraft/client-recalc.ts and touches no network —
// the backend LLM is never re-invoked for an edit.
//
// Scope boundary (handbook non-goal): this component never computes or
// displays a delivery date. It shows *capacity*, not a calendar commitment —
// turning story points into "you'll ship on March 3rd" is a Product Owner
// judgement call this tool must not make for them.
//
// Interaction model: toggle buttons and a number input, not drag-and-drop.
// WCAG 2.2 SC 2.5.7 (Dragging Movements) requires a single-pointer
// alternative to any drag gesture; a button *is* that alternative, and native
// <button>/<input> elements get Enter/Space activation and keyboard focus for
// free, so building on them satisfies the keyboard requirement without extra
// key-handling code to get wrong.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MoscowBucket, SprintPlanResult, UserStory } from "@/lib/scopecraft/schema";
import {
  recalcCapacity,
  recalcScore,
  setPoints,
  toggleColumn,
  type BoardStory,
  type CapacitySummary,
} from "@/lib/scopecraft/client-recalc";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { BoardEdits } from "@/lib/scopecraft/schema";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipProps } from "@/components/ui/Chip";
import styles from "./InteractiveSprintBoard.module.css";

/** What the board reports upward on every change, so a parent (export
 *  actions, a "reset to generated plan" control) can read live state without
 *  the board itself becoming a controlled component. */
export interface BoardSnapshot {
  stories: BoardStory[];
  liveScores: Record<string, { score: number; moscow: MoscowBucket }>;
  capacity: CapacitySummary;
}

export interface InteractiveSprintBoardProps {
  stories: readonly UserStory[];
  priority: Readonly<Record<string, number>>;
  moscow: Readonly<Record<string, MoscowBucket>>;
  sprintPlan: SprintPlanResult;
  onBoardChange?: (snapshot: BoardSnapshot) => void;
  /** Previously saved human edits, applied over the generated plan on load. */
  savedEdits?: BoardEdits;
}

const MOSCOW_LABEL_KEY: Record<MoscowBucket, TranslationKey> = {
  must: "moscow.must",
  should: "moscow.should",
  could: "moscow.could",
  wont: "moscow.wont",
};

// Buckets are encoded by chip weight, not by hue — the same mapping the
// overview tab uses. Until D5 these two tabs rendered the same four buckets in
// two visual languages a single click apart: weights here, red/amber/blue/grey
// there. See src/components/ui/Chip.tsx and docs/decision-log.md entry 34.
const MOSCOW_WEIGHT = {
  must: "solid",
  should: "outline",
  could: "dashed",
  wont: "faint",
} as const satisfies Record<MoscowBucket, NonNullable<ChipProps["weight"]>>;

/**
 * The generated plan, with the human's saved edits laid over it.
 *
 * Only `points` and `column` come from `savedEdits`, because they are the only
 * two things ever stored — everything else is re-derived from the model's own
 * output on every load. That is what makes a saved board safe: the AI's answer
 * is the base layer and cannot be overwritten, and the scores and buckets are
 * recomputed by today's formula rather than replayed from whatever the formula
 * said when the board was saved.
 *
 * A saved edit for a story id that is no longer in the plan is ignored, and a
 * story with no saved edit keeps its generated values.
 */
function deriveInitialStories(
  stories: readonly UserStory[],
  sprintPlan: SprintPlanResult,
  savedEdits?: BoardEdits
): BoardStory[] {
  const includedIds = new Set(sprintPlan.included);
  return stories.map((story) => {
    const saved = savedEdits?.[story.id];
    return {
      storyId: story.id,
      asA: story.as_a,
      iWant: story.i_want,
      soThat: story.so_that,
      value: story.value,
      risk: story.risk,
      points: saved?.points ?? story.points,
      dependencies: story.dependencies ?? [],
      column: saved?.column ?? (includedIds.has(story.id) ? "included" : "deferred"),
    };
  });
}

/**
 * Recomputes score and bucket for every story whose saved points differ from
 * the ones the server scored. Stories with no saved edit are left out, so they
 * keep showing exactly what the API returned.
 */
function seedLiveScores(
  stories: readonly UserStory[],
  savedEdits?: BoardEdits
): Record<string, { score: number; moscow: MoscowBucket }> {
  if (!savedEdits) return {};

  const seeded: Record<string, { score: number; moscow: MoscowBucket }> = {};
  for (const story of stories) {
    const saved = savedEdits[story.id];
    if (!saved || saved.points === story.points) continue;
    const recomputed = recalcScore({
      value: story.value,
      risk: story.risk,
      points: saved.points,
    });
    if (recomputed) seeded[story.id] = recomputed;
  }
  return seeded;
}

export function InteractiveSprintBoard({
  stories,
  priority,
  moscow,
  sprintPlan,
  onBoardChange,
  savedEdits,
}: InteractiveSprintBoardProps) {
  const { t } = useLanguage();
  const [board, setBoard] = useState<BoardStory[]>(() =>
    deriveInitialStories(stories, sprintPlan, savedEdits)
  );
  // Live score/bucket per story, recomputed after any points edit. Falls back
  // to the server-supplied values until an edit invalidates them, so a story
  // nobody touched keeps showing exactly what the API returned.
  //
  // SEEDED FROM SAVED EDITS. A reopened plan arrives with points that already
  // differ from the ones the server scored, so an empty map here would fall
  // back to a score that contradicts the number in the field beside it —
  // "13 points, Score 2.00", which was scored at 3. Seeding recomputes those
  // stories with today's formula, which is also why only `points` and `column`
  // are ever stored: derived values are rebuilt, never replayed.
  const [liveScores, setLiveScores] = useState<
    Record<string, { score: number; moscow: MoscowBucket }>
  >(() => seedLiveScores(stories, savedEdits));

  // Memoized, not recomputed inline: recalcCapacity returns a fresh object
  // literal on every call. Without memoization, `capacity` gets a new object
  // identity on every render even when nothing about it actually changed,
  // which made the reporting effect below re-fire every render (its
  // dependency array sees a "changed" value by reference), which called the
  // parent's setState, which re-rendered this component, which computed a new
  // `capacity` again — an infinite loop, caught as "Maximum update depth
  // exceeded" only once this component was wired into the full page (the
  // standalone component tests never re-render it from a parent, so they
  // never exercised this path).
  const capacity = useMemo(
    () => recalcCapacity(board, sprintPlan.capacity_points),
    [board, sprintPlan.capacity_points]
  );

  // Reports the current board to the parent after every commit. Runs as an
  // effect (not inline during render) because calling a parent's setState
  // synchronously during this component's render would trigger React's
  // "cannot update a component while rendering a different component" warning
  // — the effect defers it to after commit.
  //
  // `onBoardChange` is read through a ref rather than listed in the
  // dependency array below. If a caller passes an inline arrow function, its
  // identity changes every parent render; depending on it directly would
  // re-fire this effect on every such render even though nothing about the
  // board actually changed — and since the callback itself typically triggers
  // a parent re-render (as setBoard does on this page), that becomes an
  // infinite loop. A ref always holds the latest callback without being part
  // of the effect's own change-detection, which is the standard fix for this
  // exact case — not a suppression of the lint rule, but the pattern it
  // expects here.
  const onBoardChangeRef = useRef(onBoardChange);
  useEffect(() => {
    onBoardChangeRef.current = onBoardChange;
  });

  useEffect(() => {
    onBoardChangeRef.current?.({ stories: board, liveScores, capacity });
  }, [board, liveScores, capacity]);

  const previousState = useRef(capacity.state);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (previousState.current !== capacity.state) {
      previousState.current = capacity.state;
      const key: TranslationKey =
        capacity.state === "over"
          ? "board.announce.over"
          : capacity.state === "warning"
            ? "board.announce.warning"
            : "board.announce.ok";
      setAnnouncement(
        t(key, {
          committed: capacity.committedPoints,
          capacity: capacity.capacityPoints,
        })
      );
    }
  }, [capacity.state, capacity.committedPoints, capacity.capacityPoints, t]);

  // A toggle moves a story's <li> from one column's <ul> to the other's — two
  // different parent elements, not a reorder React can reconcile as "the same
  // node moved". The old DOM node is unmounted and a new one mounted
  // elsewhere, which silently drops keyboard focus to <body> on every single
  // toggle. `focusTargetRef` tracks which story's button should reclaim focus
  // once the new element exists, so a keyboard user's position on the board
  // survives the move instead of being lost after every action. A ref, not
  // state — the value is only ever read imperatively for a DOM focus() call,
  // and never affects what gets rendered, so it doesn't belong in state.
  const focusTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusTargetRef.current) {
      document.getElementById(`toggle-${focusTargetRef.current}`)?.focus();
      focusTargetRef.current = null;
    }
  }, [board]);

  function handleToggle(storyId: string) {
    focusTargetRef.current = storyId;
    setBoard((current) => toggleColumn(current, storyId));
  }

  function handlePointsChange(storyId: string, raw: string) {
    const parsed = Number(raw);
    setBoard((current) => setPoints(current, storyId, parsed));

    const story = board.find((s) => s.storyId === storyId);
    if (!story) return;
    const recomputed = recalcScore({ value: story.value, risk: story.risk, points: parsed });
    setLiveScores((current) => {
      if (!recomputed) {
        // Mid-edit / out-of-range: drop the stale live value rather than show
        // a number that no longer matches what's in the field.
        return Object.fromEntries(
          Object.entries(current).filter(([id]) => id !== storyId)
        );
      }
      return { ...current, [storyId]: recomputed };
    });
  }

  function scoreFor(storyId: string): number {
    return liveScores[storyId]?.score ?? priority[storyId] ?? 0;
  }

  function moscowFor(storyId: string): MoscowBucket {
    return liveScores[storyId]?.moscow ?? moscow[storyId] ?? "wont";
  }

  const included = board.filter((s) => s.column === "included");
  const deferred = board.filter((s) => s.column === "deferred");

  const percent = Math.round(capacity.utilization * 100);

  // Two fills for three states. "ok" and "warning" share the accent because
  // neither is a fault; only "over" is. The caption below carries the
  // three-way distinction in words, which is the channel that matters — the
  // track itself is aria-hidden. See the stylesheet.
  const meterFillClass = capacity.state === "over" ? styles.meterFillOver : "";

  const meterCaptionClass =
    capacity.state === "over"
      ? styles.meterCaptionOver
      : capacity.state === "warning"
        ? styles.meterCaptionWarning
        : "";

  function renderCard(story: BoardStory) {
    const blockedDependency = story.dependencies.find((depId) => {
      const dep = board.find((s) => s.storyId === depId);
      return dep && dep.column !== story.column && story.column === "included";
    });
    const bucket = moscowFor(story.storyId);

    return (
      <Card
        key={story.storyId}
        as="li"
        testId={`board-card-${story.storyId}`}
        className={styles.card}
      >
        <div className={styles.cardTop}>
          <div>
            <p className={styles.cardTitle}>{story.storyId}</p>
            <p className={styles.cardBody}>
              {t("board.card.statement", { asA: story.asA, iWant: story.iWant })}
            </p>
          </div>
          <Chip weight={MOSCOW_WEIGHT[bucket]} testId={`board-badge-${story.storyId}`}>
            {t(MOSCOW_LABEL_KEY[bucket])}
          </Chip>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.statTag}>
            {t("board.card.score", { score: scoreFor(story.storyId).toFixed(2) })}
          </span>
          <span className={styles.statTag}>{t("prd.story.value", { value: story.value })}</span>
          <span className={styles.statTag}>{t("prd.story.risk", { risk: story.risk })}</span>
        </div>

        {blockedDependency && (
          <p className={styles.dependencyNote}>
            ⚠ {t("board.dependency.warning", { id: blockedDependency })}
          </p>
        )}

        <div className={styles.cardActions}>
          <label className={styles.pointsField} htmlFor={`points-${story.storyId}`}>
            {t("board.card.points")}
            <input
              id={`points-${story.storyId}`}
              className={styles.pointsInput}
              type="number"
              inputMode="numeric"
              min={1}
              max={13}
              value={story.points}
              onChange={(event) => handlePointsChange(story.storyId, event.target.value)}
              aria-label={t("board.card.pointsLabel", { id: story.storyId })}
            />
          </label>
          <Button
            variant="secondary"
            id={`toggle-${story.storyId}`}
            className={styles.toggleButton}
            onClick={() => handleToggle(story.storyId)}
            aria-label={
              story.column === "included"
                ? t("board.action.deferLabel", { id: story.storyId })
                : t("board.action.commitLabel", { id: story.storyId })
            }
          >
            {story.column === "included" ? t("board.action.defer") : t("board.action.commit")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.meter} role="group" aria-label={t("board.capacity.group")}>
        <div className={styles.meterHeader}>
          <span>{t("board.capacity.title")}</span>
          <span className={styles.meterNumbersGroup}>
            <span className={styles.meterNumbers} data-testid="capacity-meter-numbers">
              {capacity.committedPoints} / {capacity.capacityPoints} points
            </span>
            <span className={styles.meterPercent} data-testid="capacity-meter-percent">
              {percent}%
            </span>
          </span>
        </div>
        <div className={styles.meterTrack} aria-hidden="true">
          <div
            className={`${styles.meterFill} ${meterFillClass}`}
            // inlineSize, not width: the bar has to grow from the inline-start
            // edge, which is the right-hand side in Arabic.
            style={{ inlineSize: `${Math.min(100, percent)}%` }}
          />
        </div>
        <p className={`${styles.meterCaption} ${meterCaptionClass}`}>
          {capacity.state === "over" &&
            t("board.capacity.over", {
              count: capacity.committedPoints - capacity.capacityPoints,
            })}
          {capacity.state === "warning" &&
            t("board.capacity.warning", { count: capacity.remainingPoints })}
          {capacity.state === "ok" &&
            t("board.capacity.ok", { count: capacity.remainingPoints })}
        </p>
        <div className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </div>
      </div>

      <div className={styles.columns}>
        <Card
          as="section"
          labelledBy="board-included-heading"
          className={styles.column}
        >
          <h4 id="board-included-heading" className={styles.columnHeader}>
            {t("board.column.committed")}
            <span className={styles.columnCount}>{included.length}</span>
          </h4>
          {included.length === 0 ? (
            <p className={styles.emptyColumn}>{t("board.column.empty.committed")}</p>
          ) : (
            <ul className={styles.cardList}>{included.map(renderCard)}</ul>
          )}
        </Card>

        {/* recessed + muted: a sunken surface behind a dashed rule. Card's own
            doc for `muted` is "content that is present but not committed to",
            which is the definition of this column. Both props shipped in
            Module C with no consumer until now. */}
        <Card
          as="section"
          recessed
          muted
          labelledBy="board-deferred-heading"
          className={styles.column}
        >
          <h4 id="board-deferred-heading" className={styles.columnHeader}>
            {t("board.column.deferred")}
            <span className={styles.columnCount}>{deferred.length}</span>
          </h4>
          {deferred.length === 0 ? (
            <p className={styles.emptyColumn}>{t("board.column.empty.deferred")}</p>
          ) : (
            <ul className={styles.cardList}>{deferred.map(renderCard)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}

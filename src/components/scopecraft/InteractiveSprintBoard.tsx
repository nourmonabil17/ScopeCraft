// src/components/scopecraft/InteractiveSprintBoard.tsx
//
// Interactive sprint backlog (owner: Joe) — Module 2.
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
}

const MOSCOW_LABEL: Record<MoscowBucket, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

const MOSCOW_BADGE_CLASS: Record<MoscowBucket, string> = {
  must: styles.badgeMust,
  should: styles.badgeShould,
  could: styles.badgeCould,
  wont: styles.badgeWont,
};

function deriveInitialStories(
  stories: readonly UserStory[],
  sprintPlan: SprintPlanResult
): BoardStory[] {
  const includedIds = new Set(sprintPlan.included);
  return stories.map((story) => ({
    storyId: story.id,
    asA: story.as_a,
    iWant: story.i_want,
    soThat: story.so_that,
    value: story.value,
    risk: story.risk,
    points: story.points,
    dependencies: story.dependencies ?? [],
    column: includedIds.has(story.id) ? "included" : "deferred",
  }));
}

export function InteractiveSprintBoard({
  stories,
  priority,
  moscow,
  sprintPlan,
  onBoardChange,
}: InteractiveSprintBoardProps) {
  const [board, setBoard] = useState<BoardStory[]>(() =>
    deriveInitialStories(stories, sprintPlan)
  );
  // Live score/bucket per story, recomputed after any points edit. Falls back
  // to the server-supplied values until an edit invalidates them, so a story
  // nobody touched keeps showing exactly what the API returned.
  const [liveScores, setLiveScores] = useState<
    Record<string, { score: number; moscow: MoscowBucket }>
  >({});

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
      setAnnouncement(
        capacity.state === "over"
          ? `Over capacity: ${capacity.committedPoints} of ${capacity.capacityPoints} points committed.`
          : capacity.state === "warning"
            ? `Nearing capacity: ${capacity.committedPoints} of ${capacity.capacityPoints} points committed.`
            : `Within capacity: ${capacity.committedPoints} of ${capacity.capacityPoints} points committed.`
      );
    }
  }, [capacity.state, capacity.committedPoints, capacity.capacityPoints]);

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

  const meterFillClass =
    capacity.state === "over"
      ? styles.meterFillOver
      : capacity.state === "warning"
        ? styles.meterFillWarning
        : "";

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

    return (
      <li key={story.storyId} className={styles.card} data-testid={`board-card-${story.storyId}`}>
        <div className={styles.cardTop}>
          <div>
            <p className={styles.cardTitle}>{story.storyId}</p>
            <p className={styles.cardBody}>
              As a {story.asA}, I want {story.iWant}.
            </p>
          </div>
          <span
            className={`${styles.badge} ${MOSCOW_BADGE_CLASS[moscowFor(story.storyId)]}`}
            data-testid={`board-badge-${story.storyId}`}
          >
            {MOSCOW_LABEL[moscowFor(story.storyId)]}
          </span>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.statTag}>Score {scoreFor(story.storyId).toFixed(2)}</span>
          <span className={styles.statTag}>Value {story.value}/5</span>
          <span className={styles.statTag}>Risk {story.risk}/5</span>
        </div>

        {blockedDependency && (
          <p className={styles.dependencyNote}>
            ⚠ Depends on {blockedDependency}, which is in the deferred backlog.
          </p>
        )}

        <div className={styles.cardActions}>
          <label className={styles.pointsField} htmlFor={`points-${story.storyId}`}>
            Points
            <input
              id={`points-${story.storyId}`}
              className={styles.pointsInput}
              type="number"
              inputMode="numeric"
              min={1}
              max={13}
              value={story.points}
              onChange={(event) => handlePointsChange(story.storyId, event.target.value)}
              aria-label={`Story points for ${story.storyId}`}
            />
          </label>
          <button
            type="button"
            id={`toggle-${story.storyId}`}
            className={styles.toggleButton}
            onClick={() => handleToggle(story.storyId)}
            aria-label={
              story.column === "included"
                ? `Move ${story.storyId} to the deferred backlog`
                : `Move ${story.storyId} to sprint 1`
            }
          >
            {story.column === "included" ? "Defer" : "Commit to sprint"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.meter} role="group" aria-label="Sprint capacity">
        <div className={styles.meterHeader}>
          <span>Sprint 1 capacity</span>
          <span className={styles.meterNumbers} data-testid="capacity-meter-numbers">
            {capacity.committedPoints} / {capacity.capacityPoints} points
          </span>
        </div>
        <div className={styles.meterTrack} aria-hidden="true">
          <div
            className={`${styles.meterFill} ${meterFillClass}`}
            style={{ width: `${Math.min(100, Math.round(capacity.utilization * 100))}%` }}
          />
        </div>
        <p className={`${styles.meterCaption} ${meterCaptionClass}`}>
          {capacity.state === "over" &&
            `${capacity.committedPoints - capacity.capacityPoints} points over capacity. Move a story to the deferred backlog.`}
          {capacity.state === "warning" &&
            `${capacity.remainingPoints} points of headroom left.`}
          {capacity.state === "ok" &&
            `${capacity.remainingPoints} points of headroom remaining.`}
        </p>
        <div className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </div>
      </div>

      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby="board-included-heading">
          <h4 id="board-included-heading" className={styles.columnHeader}>
            Committed to sprint 1
            <span className={styles.columnCount}>{included.length}</span>
          </h4>
          {included.length === 0 ? (
            <p className={styles.emptyColumn}>No stories committed yet.</p>
          ) : (
            <ul className={styles.cardList}>{included.map(renderCard)}</ul>
          )}
        </section>

        <section className={styles.column} aria-labelledby="board-deferred-heading">
          <h4 id="board-deferred-heading" className={styles.columnHeader}>
            Deferred backlog
            <span className={styles.columnCount}>{deferred.length}</span>
          </h4>
          {deferred.length === 0 ? (
            <p className={styles.emptyColumn}>Nothing deferred.</p>
          ) : (
            <ul className={styles.cardList}>{deferred.map(renderCard)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

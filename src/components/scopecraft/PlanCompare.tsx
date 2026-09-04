// src/components/scopecraft/PlanCompare.tsx
//
// Two plans for one question, and the choice between them (owner: Yousef).
//
// WHY THIS EXISTS. An identical request hashes identically, so A3 serves the
// stored plan verbatim and a second ask returns the same bytes. `bypass_cache`
// is what produces a genuinely independent second answer; this is where the two
// are put next to each other so the difference is visible rather than asserted.
//
// EVERY NUMBER HERE IS ALREADY COMPUTED. `sprint_plan.committed_points` and the
// `moscow` map are written server-side and overwrite whatever the model
// returned, so this component only counts and renders them. It must never
// derive a figure of its own — a second arithmetic path would be free to
// disagree with the board, and the board is the one that is right.
//
// A <table>, not two <div> columns. It is tabular data: three measures read
// across two plans, and the row header is what tells a screen-reader user which
// measure a bare number belongs to. Direction is handled by `text-align: start`
// rather than by any [dir] override.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { MoscowBucket, ScopeCraftResponse } from "@/lib/scopecraft/schema";
import styles from "./PlanCompare.module.css";

export interface PlanSide {
  /** Null when the persistence write failed. Such a plan can be compared but
   *  not kept: there is no row to mark. */
  planId: string | null;
  data: ScopeCraftResponse;
}

export interface PlanCompareProps {
  original: PlanSide;
  alternative: PlanSide;
  chosenPlanId: string | null;
  onChoose: (planId: string) => void;
  /** True while a choice is in flight, so the pair cannot be double-submitted. */
  busy?: boolean;
}

function countBucket(data: ScopeCraftResponse, bucket: MoscowBucket): number {
  return Object.values(data.moscow).filter((value) => value === bucket).length;
}

export function PlanCompare({
  original,
  alternative,
  chosenPlanId,
  onChoose,
  busy = false,
}: PlanCompareProps) {
  const { t } = useLanguage();

  const sides = [
    { key: "original", side: original, labelKey: "compare.original", keepKey: "compare.keepOriginal" },
    {
      key: "alternative",
      side: alternative,
      labelKey: "compare.alternative",
      keepKey: "compare.keepAlternative",
    },
  ] as const;

  return (
    <section className={styles.compare} aria-labelledby="compare-heading" data-testid="plan-compare">
      {/* h2, not h3. This block renders ABOVE ResultView, whose own heading is
          an h2 — an h3 here would make the outline h1 → h3 → h2 and file the
          comparison under a section it precedes. */}
      <h2 className={styles.heading} id="compare-heading">
        {t("compare.heading")}
      </h2>

      <div className={styles.scroll}>
        <table className={styles.table}>
          {/* The section's aria-labelledby does not reach the table, and in a
              screen reader's table-navigation mode an unnamed grid of bare
              integers is unreadable. */}
          <caption className="sc-sr-only">{t("compare.heading")}</caption>
          <thead>
            <tr>
              {/* Empty corner cell: the column it heads holds row headers, which
                  name themselves. */}
              <td />
              {sides.map(({ key, side, labelKey }) => (
                <th key={key} scope="col" data-testid={`compare-side-${key}`}>
                  <span className={styles.sideName}>{t(labelKey)}</span>
                  {side.planId !== null && side.planId === chosenPlanId && (
                    // aria-hidden because this cell is the announced column
                    // header for all three data cells beneath it, and folding
                    // "Kept" into that would repeat it on every number. The
                    // state is carried programmatically by aria-pressed on the
                    // keep control instead, which is where a reader acts on it.
                    <Chip weight="solid" testId="compare-kept" aria-hidden="true">
                      {t("compare.kept")}
                    </Chip>
                  )}
                  <span className={styles.points}>
                    {/* <bdi>, for the reason InteractiveSprintBoard already
                        documents: digits are weak-LTR and " / " is neutral, so
                        under RTL the run reorders and "6 / 30" displays as
                        "30 / 6" — capacity where committed should be. */}
                    <bdi>
                      {side.data.sprint_plan.committed_points} /{" "}
                      {side.data.sprint_plan.capacity_points}
                    </bdi>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <th scope="row">{t("compare.stories")}</th>
              {sides.map(({ key, side }) => (
                <td key={key}>{side.data.user_stories.length}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t("compare.points")}</th>
              {sides.map(({ key, side }) => (
                <td key={key}>{side.data.sprint_plan.committed_points}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t("compare.must")}</th>
              {sides.map(({ key, side }) => (
                <td key={key} data-testid={`compare-must-${key}`}>
                  {countBucket(side.data, "must")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.actions}>
        {sides.map(({ key, side, keepKey }) =>
          // A plan that was never stored has no row to mark, so it gets no
          // control. The plan already kept DOES keep its control: unmounting
          // the button a user just activated drops focus to <body> mid-
          // interaction and tells them nothing. It stays, reports itself as
          // pressed — which is what announces the change — and choosing again
          // is idempotent server-side.
          side.planId !== null ? (
            <Button
              key={key}
              variant="secondary"
              busy={busy}
              aria-pressed={side.planId === chosenPlanId}
              onClick={() => onChoose(side.planId as string)}
            >
              {t(keepKey)}
            </Button>
          ) : null
        )}
      </div>

      <p className={styles.note}>{t("compare.keptNote")}</p>
    </section>
  );
}

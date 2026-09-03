// src/components/scopecraft/ResultView.tsx
//
// Structured PRD rendering (owner: Joe) — Module 2, tabbed + internationalized.
//
// Renders every one of the 11 mandatory response fields as its own labelled
// section, built from typed data — never by parsing or dumping raw model
// prose as markdown. Section numbers follow the handbook's own enumeration of
// the 11 fields, so they encode a real, checkable sequence rather than
// decorating an arbitrary list.
//
// TABS — why a real tablist and not three <details>:
// The three groupings are alternative *views* of one result, not a
// progressive disclosure of optional extras, and a Product Owner moves
// between them repeatedly while editing. That is exactly the tab pattern, so
// it implements the full APG keyboard contract (arrow keys move between tabs,
// Home/End jump to the ends, only the active tab is in the tab sequence).
// Every panel stays mounted — `hidden` rather than unmounted — because
// unmounting the backlog panel would discard the user's in-progress board
// edits every time they glanced at the evidence tab.
//
// Acceptance criteria are rendered with a "Scenario:" keyword prefix as the
// Gherkin-style treatment the spec asks for. The underlying data is plain
// strings, not actual Given/When/Then clauses — inventing those substeps
// would misrepresent the model's output as more structured than it actually
// is, so only the keyword/typographic treatment is added, not fabricated
// content.

"use client";

import { useId, useRef, useState } from "react";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { InteractiveSprintBoard, type BoardSnapshot } from "./InteractiveSprintBoard";
import type { BoardEdits } from "@/lib/scopecraft/schema";
import { EvidencePanel } from "./EvidencePanel";
import { ExportActions } from "./ExportActions";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipProps } from "@/components/ui/Chip";
import styles from "./ResultView.module.css";

export interface ResultViewProps {
  data: ScopeCraftResponse;
  onBoardChange?: (snapshot: BoardSnapshot) => void;
  /** Provenance for the evidence tab. */
  providerUsed?: "nvidia" | "groq" | "gemini" | "unknown";
  promptVersion?: string;
  /** Live board state, so exports reflect manual edits. */
  board?: BoardSnapshot;
  /** Previously saved edits, when viewing a plan loaded from the database. */
  savedEdits?: BoardEdits;
}

const MOSCOW_LABEL_KEY = {
  must: "moscow.must",
  should: "moscow.should",
  could: "moscow.could",
  wont: "moscow.wont",
} as const satisfies Record<string, TranslationKey>;

// Buckets and levels are encoded by chip weight, not by hue — see
// src/components/ui/Chip.tsx and docs/decision-log.md entry 34. The word is
// always rendered too; the weight only reinforces it.
const MOSCOW_WEIGHT = {
  must: "solid",
  should: "outline",
  could: "dashed",
  wont: "faint",
} as const satisfies Record<string, NonNullable<ChipProps["weight"]>>;

// Three levels, the top three weights. Descending emphasis, same ramp.
const LEVEL_WEIGHT = {
  high: "solid",
  medium: "outline",
  low: "dashed",
} as const satisfies Record<string, NonNullable<ChipProps["weight"]>>;

const LEVEL_LABEL_KEY = {
  low: "level.low",
  medium: "level.medium",
  high: "level.high",
} as const satisfies Record<string, TranslationKey>;

const TABS = [
  { id: "overview", labelKey: "result.tab.overview" },
  { id: "backlog", labelKey: "result.tab.backlog" },
  { id: "evidence", labelKey: "result.tab.evidence" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SectionHeading({ number, children }: { number: string; children: string }) {
  return (
    <h3 className={styles.sectionHeading}>
      <span className={styles.sectionNumber} aria-hidden="true">
        {number}.
      </span>
      {children}
    </h3>
  );
}

export function ResultView({
  data,
  onBoardChange,
  providerUsed = "unknown",
  promptVersion = "unknown",
  board,
  savedEdits,
}: ResultViewProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const uid = useId();
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const tabId = (id: TabId) => `${uid}-tab-${id}`;
  const panelId = (id: TabId) => `${uid}-panel-${id}`;

  /** APG roving-focus: arrows move between tabs, Home/End jump to the ends.
   *  Focus follows selection, which is correct here because switching tabs is
   *  instant and has no side effects. */
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TABS[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <div className={styles.result} data-testid="result-view">
      <h2 className={styles.resultHeading}>{t("result.heading")}</h2>

      <div
        className={styles.tabList}
        role="tablist"
        aria-label={t("result.heading")}
        data-testid="result-tablist"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              // Only the active tab is reachable by Tab; arrows move within.
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleTabKeyDown}
              data-testid={`result-tab-${tab.id}`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ---- Panel 1: PRD overview ---- */}
      <div
        role="tabpanel"
        id={panelId("overview")}
        aria-labelledby={tabId("overview")}
        hidden={activeTab !== "overview"}
        tabIndex={0}
        className={styles.panel}
        data-testid="result-panel-overview"
      >
        <section className={styles.section}>
          <SectionHeading number="1">{t("prd.problem")}</SectionHeading>
          <p className={styles.prose}>{data.problem}</p>
        </section>

        <section className={styles.section}>
          <SectionHeading number="2">{t("prd.targetUser")}</SectionHeading>
          <p className={styles.prose}>{data.target_user}</p>
        </section>

        <section className={styles.section}>
          <SectionHeading number="3">{t("prd.goals")}</SectionHeading>
          <ul className={styles.list}>
            {data.goals.map((goal, i) => (
              <li key={i}>{goal}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <SectionHeading number="4">{t("prd.nonGoals")}</SectionHeading>
          {data.non_goals.length === 0 ? (
            <p className={styles.prose}>{t("prd.nonGoals.none")}</p>
          ) : (
            <ul className={styles.list}>
              {data.non_goals.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <SectionHeading number="5">{t("prd.requirements")}</SectionHeading>
          <ul className={styles.list}>
            {data.requirements.map((requirement, i) => (
              <li key={i}>{requirement}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby={`${uid}-stories-heading`}>
          <h3 id={`${uid}-stories-heading`} className={styles.sectionHeading}>
            <span className={styles.sectionNumber} aria-hidden="true">
              6, 7, 9, 10.
            </span>
            {t("prd.stories")}
          </h3>
          <div className={styles.storyGrid}>
            {data.user_stories.map((story) => {
              const score = data.priority[story.id];
              const bucket = data.moscow[story.id];
              return (
                <Card
                  key={story.id}
                  as="article"
                  labelledBy={`story-${story.id}-heading`}
                  testId={`story-card-${story.id}`}
                  className={styles.storyCard}
                >
                  <div className={styles.storyHeader}>
                    <span id={`story-${story.id}-heading`} className={styles.storyId}>
                      {story.id}
                    </span>
                    <div className={styles.storyBadges}>
                      {bucket && <Chip weight={MOSCOW_WEIGHT[bucket]}>{t(MOSCOW_LABEL_KEY[bucket])}</Chip>}
                    </div>
                  </div>

                  <p className={styles.storyStatement}>
                    {t("prd.story.statement", {
                      asA: story.as_a,
                      iWant: story.i_want,
                      soThat: story.so_that,
                    })}
                  </p>

                  <div className={styles.storyStats}>
                    <span>{t("prd.story.value", { value: story.value })}</span>
                    <span>{t("prd.story.risk", { risk: story.risk })}</span>
                    <span>{t("prd.story.effort", { points: story.points })}</span>
                    {typeof score === "number" && (
                      <span>{t("prd.story.priority", { score: score.toFixed(2) })}</span>
                    )}
                  </div>

                  {story.dependencies.length > 0 && (
                    <p className={styles.storyDependencies}>
                      {t("prd.story.dependsOn", { ids: story.dependencies.join(", ") })}
                    </p>
                  )}

                  <p className={styles.acLabel}>{t("prd.story.acceptanceCriteria")}</p>
                  <ul className={styles.gherkinList}>
                    {story.acceptance_criteria.map((criterion, i) => (
                      <li key={i} className={styles.gherkinItem}>
                        <span className={styles.gherkinKeyword}>{t("gherkin.scenario")}</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHeading number="7">{t("prd.acceptanceCriteria")}</SectionHeading>
          <ul className={styles.gherkinList}>
            {data.acceptance_criteria.map((criterion, i) => (
              <li key={i} className={styles.gherkinItem}>
                <span className={styles.gherkinKeyword}>{t("gherkin.scenario")}</span>
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby={`${uid}-risks-heading`}>
          <h3 id={`${uid}-risks-heading`} className={styles.sectionHeading}>
            <span className={styles.sectionNumber} aria-hidden="true">
              8.
            </span>
            {t("prd.risks")}
          </h3>
          <div className={styles.tableScroll}>
            <table className={styles.riskTable}>
              <thead>
                <tr>
                  <th scope="col">{t("prd.risk.id")}</th>
                  <th scope="col">{t("prd.risk.description")}</th>
                  <th scope="col">{t("prd.risk.impact")}</th>
                  <th scope="col">{t("prd.risk.likelihood")}</th>
                </tr>
              </thead>
              <tbody>
                {data.risks.map((risk) => (
                  <tr key={risk.id}>
                    <td>{risk.id}</td>
                    <td>{risk.description}</td>
                    <td>
                      <Chip weight={LEVEL_WEIGHT[risk.impact]}>
                        {t(LEVEL_LABEL_KEY[risk.impact])}
                      </Chip>
                    </td>
                    <td>
                      <Chip weight={LEVEL_WEIGHT[risk.likelihood]}>
                        {t(LEVEL_LABEL_KEY[risk.likelihood])}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---- Panel 2: interactive backlog ---- */}
      <div
        role="tabpanel"
        id={panelId("backlog")}
        aria-labelledby={tabId("backlog")}
        hidden={activeTab !== "backlog"}
        tabIndex={0}
        className={styles.panel}
        data-testid="result-panel-backlog"
      >
        <section className={styles.section} aria-labelledby={`${uid}-sprint-heading`}>
          <h3 id={`${uid}-sprint-heading`} className={styles.sectionHeading}>
            <span className={styles.sectionNumber} aria-hidden="true">
              11.
            </span>
            {t("prd.sprintPlan")}
          </h3>
          <p className={styles.prose}>{t("board.intro")}</p>

          <InteractiveSprintBoard
            savedEdits={savedEdits}
            stories={data.user_stories}
            priority={data.priority}
            moscow={data.moscow}
            sprintPlan={data.sprint_plan}
            onBoardChange={onBoardChange}
          />

          {data.sprint.length > 0 && (
            <details>
              <summary className={styles.acLabel} style={{ cursor: "pointer" }}>
                {t("prd.sprint.fullSequence")}
              </summary>
              <div className={styles.tableScroll} style={{ marginTop: "0.625rem" }}>
                <table className={styles.sprintTable}>
                  <thead>
                    <tr>
                      <th scope="col">{t("prd.sprint.story")}</th>
                      <th scope="col">{t("prd.sprint.priorityScore")}</th>
                      <th scope="col">{t("prd.sprint.effort")}</th>
                      <th scope="col">{t("prd.sprint.number")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sprint.map((item, i) => (
                      <tr key={i}>
                        <td>{item.story_id}</td>
                        <td>{item.priority_score}</td>
                        <td>{item.effort}</td>
                        <td>{item.sprint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <p className={styles.disclaimer}>{t("prd.disclaimer")}</p>
        </section>
      </div>

      {/* ---- Panel 3: traceability & evidence ---- */}
      <div
        role="tabpanel"
        id={panelId("evidence")}
        aria-labelledby={tabId("evidence")}
        hidden={activeTab !== "evidence"}
        tabIndex={0}
        className={styles.panel}
        data-testid="result-panel-evidence"
      >
        <ExportActions data={data} board={board} />
        <EvidencePanel providerUsed={providerUsed} promptVersion={promptVersion} />
      </div>
    </div>
  );
}

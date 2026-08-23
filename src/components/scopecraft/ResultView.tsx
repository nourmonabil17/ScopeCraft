// src/components/scopecraft/ResultView.tsx
//
// Structured PRD rendering (owner: Joe) — Module 2.
//
// Renders every one of the 11 mandatory response fields as its own labelled
// section, built from typed data — never by parsing or dumping raw model
// prose as markdown. Section numbers follow the handbook's own enumeration of
// the 11 fields, so they encode a real, checkable sequence rather than
// decorating an arbitrary list.
//
// Acceptance criteria are rendered with a "Scenario:" keyword prefix as the
// Gherkin-style treatment the spec asks for. The underlying data is plain
// strings, not actual Given/When/Then clauses — inventing those substeps
// would misrepresent the model's output as more structured than it actually
// is, so only the keyword/typographic treatment is added, not fabricated
// content.

import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";
import { InteractiveSprintBoard, type BoardSnapshot } from "./InteractiveSprintBoard";
import styles from "./ResultView.module.css";

export interface ResultViewProps {
  data: ScopeCraftResponse;
  onBoardChange?: (snapshot: BoardSnapshot) => void;
}

const MOSCOW_LABEL = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
} as const;

const MOSCOW_BADGE_CLASS = {
  must: styles.badgeMust,
  should: styles.badgeShould,
  could: styles.badgeCould,
  wont: styles.badgeWont,
} as const;

const IMPACT_CLASS = {
  high: styles.impactHigh,
  medium: styles.impactMedium,
  low: styles.impactLow,
} as const;

function SectionHeading({ number, children }: { number: number; children: string }) {
  return (
    <h3 className={styles.sectionHeading}>
      <span className={styles.sectionNumber} aria-hidden="true">
        {number}.
      </span>
      {children}
    </h3>
  );
}

export function ResultView({ data, onBoardChange }: ResultViewProps) {
  return (
    <div className={styles.result} data-testid="result-view">
      <section className={styles.section} aria-labelledby="prd-heading">
        <h2 id="prd-heading" className={styles.sectionHeading} style={{ fontSize: "1.25rem" }}>
          Product requirements
        </h2>
      </section>

      <section className={styles.section}>
        <SectionHeading number={1}>Problem statement</SectionHeading>
        <p className={styles.prose}>{data.problem}</p>
      </section>

      <section className={styles.section}>
        <SectionHeading number={2}>Target persona</SectionHeading>
        <p className={styles.prose}>{data.target_user}</p>
      </section>

      <section className={styles.section}>
        <SectionHeading number={3}>Goals</SectionHeading>
        <ul className={styles.list}>
          {data.goals.map((goal, i) => (
            <li key={i}>{goal}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <SectionHeading number={4}>Out of scope</SectionHeading>
        {data.non_goals.length === 0 ? (
          <p className={styles.prose}>None stated.</p>
        ) : (
          <ul className={styles.list}>
            {data.non_goals.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <SectionHeading number={5}>Requirements</SectionHeading>
        <ul className={styles.list}>
          {data.requirements.map((requirement, i) => (
            <li key={i}>{requirement}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="stories-heading">
        <h3 id="stories-heading" className={styles.sectionHeading}>
          <span className={styles.sectionNumber} aria-hidden="true">
            6, 7, 9, 10.
          </span>
          User stories, acceptance criteria, priority &amp; effort
        </h3>
        <div className={styles.storyGrid}>
          {data.user_stories.map((story) => {
            const score = data.priority[story.id];
            const bucket = data.moscow[story.id];
            return (
              <article
                key={story.id}
                className={styles.storyCard}
                aria-labelledby={`story-${story.id}-heading`}
                data-testid={`story-card-${story.id}`}
              >
                <div className={styles.storyHeader}>
                  <span id={`story-${story.id}-heading`} className={styles.storyId}>
                    {story.id}
                  </span>
                  <div className={styles.storyBadges}>
                    {bucket && (
                      <span className={`${styles.badge} ${MOSCOW_BADGE_CLASS[bucket]}`}>
                        {MOSCOW_LABEL[bucket]}
                      </span>
                    )}
                  </div>
                </div>

                <p className={styles.storyStatement}>
                  As a {story.as_a}, I want {story.i_want}, so that {story.so_that}.
                </p>

                <div className={styles.storyStats}>
                  <span>Value {story.value}/5</span>
                  <span>Risk {story.risk}/5</span>
                  <span>Effort {story.points} pts</span>
                  {typeof score === "number" && <span>Priority {score.toFixed(2)}</span>}
                </div>

                {story.dependencies.length > 0 && (
                  <p className={styles.storyDependencies}>
                    Depends on: {story.dependencies.join(", ")}
                  </p>
                )}

                <p className={styles.acLabel}>Acceptance criteria</p>
                <ul className={styles.gherkinList}>
                  {story.acceptance_criteria.map((criterion, i) => (
                    <li key={i} className={styles.gherkinItem}>
                      <span className={styles.gherkinKeyword}>Scenario:</span>
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeading number={7}>Overall acceptance criteria</SectionHeading>
        <ul className={styles.gherkinList}>
          {data.acceptance_criteria.map((criterion, i) => (
            <li key={i} className={styles.gherkinItem}>
              <span className={styles.gherkinKeyword}>Scenario:</span>
              <span>{criterion}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="risks-heading">
        <h3 id="risks-heading" className={styles.sectionHeading}>
          <span className={styles.sectionNumber} aria-hidden="true">
            8.
          </span>
          Risk register
        </h3>
        <div className={styles.tableScroll}>
          <table className={styles.riskTable}>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Description</th>
                <th scope="col">Impact</th>
                <th scope="col">Likelihood</th>
              </tr>
            </thead>
            <tbody>
              {data.risks.map((risk) => (
                <tr key={risk.id}>
                  <td>{risk.id}</td>
                  <td>{risk.description}</td>
                  <td>
                    <span className={`${styles.impactChip} ${IMPACT_CLASS[risk.impact]}`}>
                      {risk.impact}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.impactChip} ${IMPACT_CLASS[risk.likelihood]}`}>
                      {risk.likelihood}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sprint-heading">
        <h3 id="sprint-heading" className={styles.sectionHeading}>
          <span className={styles.sectionNumber} aria-hidden="true">
            11.
          </span>
          Sprint plan
        </h3>
        <p className={styles.prose}>
          Drag-free, keyboard-operable board below — move a story between sprint 1 and
          the deferred backlog, or adjust its points, and the capacity math updates
          instantly. Nothing here calls the AI again.
        </p>
        <InteractiveSprintBoard
          stories={data.user_stories}
          priority={data.priority}
          moscow={data.moscow}
          sprintPlan={data.sprint_plan}
          onBoardChange={onBoardChange}
        />

        {data.sprint.length > 0 && (
          <details>
            <summary className={styles.acLabel} style={{ cursor: "pointer" }}>
              Full sprint sequence (all sprints, as generated)
            </summary>
            <div className={styles.tableScroll} style={{ marginTop: "0.625rem" }}>
              <table className={styles.sprintTable}>
                <thead>
                  <tr>
                    <th scope="col">Story</th>
                    <th scope="col">Priority score</th>
                    <th scope="col">Effort</th>
                    <th scope="col">Sprint</th>
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

        <p className={styles.disclaimer}>
          Sprint placement reflects story points and priority, not calendar dates. No
          delivery date is calculated or implied — that decision belongs to your team.
        </p>
      </section>
    </div>
  );
}

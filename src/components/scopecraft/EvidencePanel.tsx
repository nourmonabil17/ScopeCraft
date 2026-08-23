// src/components/scopecraft/EvidencePanel.tsx
//
// Shows which provider answered, distinguishes model-generated content from
// deterministic calculation, and cites the sources that ground the domain
// vocabulary (owner: Joe, extended in Module 2).
//
// The two source URLs below are not new citations invented for this panel —
// they are the exact URLs already registered and verified in
// docs/decision-log.md (Scrum Guide: Yousef/Yasmin, accessed 2026-07-26;
// GitHub Issues: Nour, accessed 2026-07-26). Reusing them here rather than
// picking new ones keeps the UI's claims traceable to the same record the
// handbook audit checks against.

import styles from "./EvidencePanel.module.css";

export interface EvidencePanelProps {
  providerUsed: "nvidia" | "groq" | "gemini" | "unknown";
  promptVersion: string;
  templateVersion?: string;
}

const SOURCES = [
  {
    title: "The 2020 Scrum Guide",
    author: "Ken Schwaber & Jeff Sutherland",
    url: "https://scrumguides.org/scrum-guide.html",
    grounds: "Sprint, backlog and increment vocabulary",
  },
  {
    title: "About issues",
    author: "GitHub",
    url: "https://docs.github.com/issues/tracking-your-work-with-issues/about-issues",
    grounds: "Issue-based backlog tracking conventions",
  },
] as const;

export function EvidencePanel({
  providerUsed,
  promptVersion,
  templateVersion = "v1",
}: EvidencePanelProps) {
  return (
    <aside className={styles.panel} aria-labelledby="evidence-heading">
      <h3 id="evidence-heading" className={styles.title}>
        Evidence &amp; provenance
      </h3>

      <dl className={styles.metaGrid}>
        <dt>AI provider</dt>
        <dd>{providerUsed}</dd>
        <dt>Prompt version</dt>
        <dd>{promptVersion}</dd>
        <dt>Template version</dt>
        <dd>{templateVersion}</dd>
      </dl>

      <div className={styles.boundary}>
        <p className={styles.boundaryRow}>
          <span className={`${styles.boundaryLabel} ${styles.labelModel}`}>Model</span>
          <span>
            Problem statement, target user, goals, requirements, user stories, acceptance
            criteria, and risks — descriptive prose, validated against a strict schema but
            not independently fact-checked.
          </span>
        </p>
        <p className={styles.boundaryRow}>
          <span className={`${styles.boundaryLabel} ${styles.labelDeterministic}`}>
            Deterministic
          </span>
          <span>
            Priority score — <code className={styles.formula}>(value + risk) / effort</code> —
            MoSCoW bucket, and sprint capacity packing are computed by pure functions on the
            server and again on this page when you edit the board. The model&apos;s own
            estimates for these four fields are discarded before you ever see them; nothing
            here is asked of, or trusted from, the AI.
          </span>
        </p>
      </div>

      <div>
        <p className={styles.title} style={{ marginBottom: "0.375rem" }}>
          Grounding sources
        </p>
        <ul className={styles.sources}>
          {SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>{" "}
              — {source.author}. {source.grounds}.
            </li>
          ))}
        </ul>
      </div>

      <p>
        Scope, priority, and delivery timing remain Product Owner decisions. This tool
        computes capacity math; it does not commit a team to a date.
      </p>
    </aside>
  );
}

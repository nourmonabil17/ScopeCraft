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
//
// Source *titles* stay in their original language — a citation renamed into
// Arabic would no longer match the document a reader actually finds at that
// URL. What each source grounds IS translated.

"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
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
    groundsKey: "evidence.source.scrum",
  },
  {
    title: "About issues",
    author: "GitHub",
    url: "https://docs.github.com/issues/tracking-your-work-with-issues/about-issues",
    groundsKey: "evidence.source.github",
  },
] as const satisfies readonly {
  title: string;
  author: string;
  url: string;
  groundsKey: TranslationKey;
}[];

export function EvidencePanel({
  providerUsed,
  promptVersion,
  templateVersion = "v1",
}: EvidencePanelProps) {
  const { t } = useLanguage();

  return (
    <aside className={styles.panel} aria-labelledby="evidence-heading">
      <h3 id="evidence-heading" className={styles.title}>
        {t("evidence.heading")}
      </h3>

      <dl className={styles.metaGrid}>
        <dt>{t("evidence.provider")}</dt>
        <dd>{providerUsed}</dd>
        <dt>{t("evidence.promptVersion")}</dt>
        <dd>{promptVersion}</dd>
        <dt>{t("evidence.templateVersion")}</dt>
        <dd>{templateVersion}</dd>
      </dl>

      <div className={styles.boundary}>
        <p className={styles.boundaryRow}>
          <span className={`${styles.boundaryLabel} ${styles.labelModel}`}>
            {t("evidence.label.model")}
          </span>
          <span>{t("evidence.model.body")}</span>
        </p>
        <p className={styles.boundaryRow}>
          <span className={`${styles.boundaryLabel} ${styles.labelDeterministic}`}>
            {t("evidence.label.deterministic")}
          </span>
          <span>
            {/* The formula is rendered as code, and left in symbols — it reads
                identically in both locales and is not prose to translate. */}
            <code className={styles.formula} dir="ltr">
              (value + risk) / effort
            </code>{" "}
            {t("evidence.deterministic.body")}
          </span>
        </p>
      </div>

      <div>
        <p className={styles.title} style={{ marginBottom: "0.375rem" }}>
          {t("evidence.sources")}
        </p>
        <ul className={styles.sources}>
          {SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>{" "}
              — {source.author}. {t(source.groundsKey)}.
            </li>
          ))}
        </ul>
      </div>

      <p>{t("evidence.footer")}</p>
    </aside>
  );
}

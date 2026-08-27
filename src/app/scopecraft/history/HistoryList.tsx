// src/app/scopecraft/history/HistoryList.tsx
//
// The rendering half of "Your plans" (owner: Yousef).
//
// A client component only because it needs two things the server cannot supply:
// the reader's chosen language, and their timezone. Dates are formatted here
// for that second reason — the server renders in its own locale and timezone,
// which is neither the reader's nor the one they picked, and a server-formatted
// date is a classic hydration mismatch.

"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import styles from "./HistoryList.module.css";

export interface PlanSummary {
  id: string;
  idea: string;
  status: "ok" | "failed";
  errorCode: string | null;
  capacityPoints: number;
  sprintDays: number;
  providerUsed: string | null;
  edited: boolean;
  createdAt: string;
}

/** `null` means the query failed — distinct from an empty list, which means the
 *  user genuinely has no plans. Conflating the two would tell someone their
 *  work had vanished during a database outage. */
export function HistoryList({ plans }: { plans: PlanSummary[] | null }) {
  const { t, locale } = useLanguage();

  if (plans === null) {
    return <ErrorState message={t("history.unavailable")} />;
  }

  if (plans.length === 0) {
    return <EmptyState headingKey="history.empty" bodyKey="history.emptyAction" />;
  }

  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title" className={styles.title}>
        {t("history.title")}
      </h1>
      <p className={styles.subtitle}>{t("history.showing")}</p>

      <ul className={styles.list}>
        {plans.map((plan) => (
          <li key={plan.id} className={styles.item}>
            {/* dir="auto" because this is the user's own text and may be in
                either language regardless of the interface language. Without
                it, an Arabic idea renders left-aligned in the English UI and an
                English idea renders right-aligned in the Arabic one — the
                browser infers direction from the first strong character. */}
            {plan.status === "ok" ? (
              // Only successful plans open: a failed row has no `response` to
              // render, so linking it would promise a page that 404s.
              <Link href={`/scopecraft/history/${plan.id}`} className={styles.ideaLink}>
                <span className={styles.idea} dir="auto">
                  {plan.idea}
                </span>
              </Link>
            ) : (
              <p className={styles.idea} dir="auto">
                {plan.idea}
              </p>
            )}

            <p className={styles.meta}>
              {/* `time` carries the machine-readable value; the text is the
                  human one, in the reader's own locale and timezone. */}
              <time dateTime={plan.createdAt}>
                {new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(plan.createdAt))}
              </time>
              {" · "}
              {plan.capacityPoints} {t("history.points")}
              {" · "}
              {plan.sprintDays} {t("history.days")}
            </p>

            <p className={styles.badges}>
              {plan.status === "failed" && (
                <span className={styles.badgeFailed}>
                  {t("history.failed")}
                  {plan.errorCode ? ` (${plan.errorCode})` : ""}
                </span>
              )}
              {plan.edited && (
                // The one flag worth showing: it distinguishes a plan the human
                // reshaped from one left as the model produced it, which is the
                // product's central distinction.
                <span className={styles.badgeEdited}>{t("history.edited")}</span>
              )}
              {plan.providerUsed && (
                <span className={styles.badgeProvider}>{plan.providerUsed}</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

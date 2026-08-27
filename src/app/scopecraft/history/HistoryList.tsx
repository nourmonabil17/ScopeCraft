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

import { useLanguage } from "@/context/LanguageContext";
import { EmptyState } from "@/components/common/EmptyState";
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

export function HistoryList({ plans }: { plans: PlanSummary[] }) {
  const { t, locale } = useLanguage();

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
            <p className={styles.idea} dir="auto">
              {plan.idea}
            </p>

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

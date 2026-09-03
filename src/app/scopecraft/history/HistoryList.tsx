// src/app/scopecraft/history/HistoryList.tsx
//
// The rendering half of "Your plans" (owner: Yousef).
//
// A client component only because it needs three things the server cannot
// supply: the reader's chosen language, their timezone, and the ability to
// call fetch() and the router directly for delete/duplicate. Dates are
// formatted here for the timezone reason — the server renders in its own
// locale and timezone, which is neither the reader's nor the one they
// picked, and a server-formatted date is a classic hydration mismatch.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { DUPLICATE_PREFILL_STORAGE_KEY } from "@/components/scopecraft/presets";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import styles from "./HistoryList.module.css";

export interface PlanSummary {
  id: string;
  idea: string;
  constraints: string | null;
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
  const router = useRouter();
  const { showToast } = useToast();
  const [visiblePlans, setVisiblePlans] = useState<PlanSummary[] | null>(plans);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (visiblePlans === null) {
    return <ErrorState message={t("history.unavailable")} />;
  }

  if (visiblePlans.length === 0) {
    return <EmptyState headingKey="history.empty" bodyKey="history.emptyAction" />;
  }

  const totalCapacity = visiblePlans.reduce((sum, plan) => sum + plan.capacityPoints, 0);
  const averageCapacity = Math.round(totalCapacity / visiblePlans.length);

  function duplicate(plan: PlanSummary) {
    sessionStorage.setItem(
      DUPLICATE_PREFILL_STORAGE_KEY,
      JSON.stringify({
        idea: plan.idea,
        constraints: plan.constraints ?? "",
        team_capacity_points: String(plan.capacityPoints),
        sprint_length_days: String(plan.sprintDays),
      })
    );
    router.push("/scopecraft");
  }

  async function deletePlan(id: string) {
    setConfirmingId(null);
    try {
      const response = await fetch(`/api/scopecraft/${id}`, { method: "DELETE" });
      if (!response.ok) {
        showToast(t("history.deleteFailed"), "error");
        return;
      }
      setVisiblePlans((current) => (current ?? []).filter((plan) => plan.id !== id));
      router.refresh();
    } catch {
      showToast(t("history.deleteFailed"), "error");
    }
  }

  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title" className={styles.title}>
        {t("history.title")}
      </h1>
      <p className={styles.subtitle}>{t("history.showing")}</p>

      <p className={styles.stats}>
        {/* The count sits in its own span so it's an isolated text node —
            otherwise "1 plan" and " · Average capacity: ..." merge into one
            run of text and neither half is independently queryable. */}
        <span>
          {visiblePlans.length === 1
            ? t("history.stats.plans.one")
            : t("history.stats.plans.many", { count: visiblePlans.length })}
        </span>
        {" · "}
        {t("history.stats.avgCapacity", { avg: averageCapacity })}
      </p>

      <ul className={styles.list}>
        {visiblePlans.map((plan) => (
          <Card key={plan.id} as="li" className={styles.item}>
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

            {/* Both actions are the Button primitive, which is what raises
                them from 32px to the 44px comfort target. They sit side by
                side, so one of them staying hand-rolled would recreate exactly
                the height mismatch decision-log entry 31 was about. */}
            <div className={styles.cardActions}>
              <Button
                variant="secondary"
                onClick={() => duplicate(plan)}
                title={t("history.duplicate.description")}
              >
                {t("history.duplicate")}
              </Button>
              {confirmingId === plan.id ? (
                <Button
                  variant="danger"
                  onClick={() => deletePlan(plan.id)}
                  onBlur={() => setConfirmingId(null)}
                >
                  {t("history.delete.confirm")}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setConfirmingId(plan.id)}
                  title={t("history.delete.description")}
                >
                  {t("history.delete")}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </ul>
    </section>
  );
}

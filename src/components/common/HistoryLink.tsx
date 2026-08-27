// src/components/common/HistoryLink.tsx
//
// "Your plans" in the app bar (owner: Yousef).
//
// Its own component for the same reason UserMenu is: the Header renders on
// /login too, and a link to a page that immediately redirects a signed-out
// visitor back to /login is worse than no link at all. Session state lives
// here rather than in Header so Header stays presentational.

"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./ToggleControls.module.css";

export function HistoryLink() {
  const { status } = useSession();
  const { t } = useLanguage();

  // "loading" renders nothing rather than a placeholder — the session resolves
  // in a few milliseconds and a flash of skeleton reads as a glitch.
  if (status !== "authenticated") return null;

  return (
    <Link href="/scopecraft/history" className={styles.linkButton}>
      {t("history.link")}
    </Link>
  );
}

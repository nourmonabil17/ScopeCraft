// src/components/common/UserMenu.tsx
//
// Who is signed in, and the way out. Renders nothing at all when there is no
// session, so the same Header works on /login (signed out) and /scopecraft
// (signed in) without either page having to know which it is.

"use client";

import { useSession, signOut } from "next-auth/react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./Header.module.css";

export function UserMenu() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();

  // "loading" renders nothing rather than a skeleton: the session resolves
  // from a cookie in one same-origin request, and a placeholder that appears
  // and vanishes inside the header is more distracting than a brief absence.
  if (status !== "authenticated" || !session.user) return null;

  const label = session.user.name ?? session.user.email ?? "";

  return (
    <span className={styles.user} data-testid="user-menu">
      <span className={styles.userName} title={label}>
        {label}
      </span>
      <button
        type="button"
        className={styles.resetButton}
        onClick={() => void signOut({ callbackUrl: "/login" })}
        data-testid="sign-out"
      >
        {t("header.signOut")}
      </button>
    </span>
  );
}

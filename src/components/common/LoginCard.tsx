// src/components/common/LoginCard.tsx
//
// The sign-in card. A client component because every string on it comes from
// LanguageContext — a server component cannot call useLanguage, and a
// monolingual login page in a bilingual app is a visible regression.
//
// WHY signIn() FROM next-auth/react AND NOT A <form action={signIn}>
// The server-action form posts to this page and answers with a 303 to
// github.com. `form-action 'self'` in next.config.js covers redirect targets
// in Chrome, so that flow would be blocked by our own CSP. The client helper
// instead fetches the CSRF token and the provider URL (both same-origin,
// allowed by `connect-src 'self'`) and then does a top-level navigation, which
// no directive in the policy restricts. Same result, no CSP hole opened.

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLanguage } from "@/context/LanguageContext";
import { Header } from "./Header";
import styles from "./LoginCard.module.css";

export function LoginCard() {
  const { t } = useLanguage();
  // The GitHub round trip is a full page navigation, so this only has to
  // survive until the browser leaves — but without it the button looks inert
  // for the second or so that takes.
  const [pending, setPending] = useState(false);

  return (
    <>
      {/* Reused as-is: it already carries the language and theme toggles, and
          without them a first-time Arabic visitor would have no way to switch
          before signing in. No `onReset` — there is nothing to reset here. */}
      <Header />
      <main className={styles.main} id="main-content" data-testid="login-card">
        <div className={styles.card}>
          <span className={styles.mark} aria-hidden="true">
            SC
          </span>
          <h1 className={styles.title}>{t("login.heading")}</h1>
          <p className={styles.subtitle}>{t("login.subtitle")}</p>

          <button
            type="button"
            className={styles.githubButton}
            disabled={pending}
            data-testid="login-github"
            onClick={() => {
              setPending(true);
              void signIn("github", { callbackUrl: "/scopecraft" });
            }}
          >
            <GitHubMark />
            {pending ? t("login.redirecting") : t("login.github")}
          </button>

          <p className={styles.note}>{t("login.note")}</p>
        </div>
      </main>
    </>
  );
}

/** Inline rather than an <img>: `img-src 'self'` would need the file served,
 *  and a one-path logo is smaller as markup than as a network request. */
function GitHubMark() {
  return (
    <svg
      className={styles.githubMark}
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

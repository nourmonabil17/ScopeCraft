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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import styles from "./LoginCard.module.css";

// Which provider button is mid-redirect, if any. Two independent booleans
// would let both buttons claim "pending" at once (impossible, since a click
// on one navigates away before the other could ever be pressed) and would
// need two nearly-identical bits of JSX to disable the sibling button while
// its own is redirecting. One nullable field models the actual state machine:
// idle, or redirecting via exactly one named provider.
type PendingProvider = "github" | "google" | null;

type LoginCardProps = {
  /** Which providers have credentials configured. Defaults to both shown —
   *  callers that skip this prop (e.g. existing tests) keep today's
   *  behavior rather than silently losing a button. */
  providers?: { github: boolean; google: boolean };
};

export function LoginCard({ providers = { github: true, google: true } }: LoginCardProps) {
  const { t } = useLanguage();
  // The OAuth round trip is a full page navigation, so this only has to
  // survive until the browser leaves — but without it the clicked button
  // looks inert for the second or so that takes.
  const [pending, setPending] = useState<PendingProvider>(null);

  return (
    <>
      {/* Reused as-is: it already carries the language and theme toggles, and
          without them a first-time Arabic visitor would have no way to switch
          before signing in. No `onReset` — there is nothing to reset here. */}
      <Header />
      <main className={styles.main} id="main-content" data-testid="login-card">
        <Card className={styles.card}>
          <span className={styles.mark} aria-hidden="true">
            SC
          </span>
          <h1 className={styles.title}>{t("login.heading")}</h1>
          <p className={styles.subtitle}>{t("login.subtitle")}</p>

          {providers.github && (
            <Button
              variant="primary"
              className={styles.providerButton}
              // `busy`, not `disabled`. A disabled control leaves the tab
              // order, so a keyboard user who was on this button when the
              // redirect started loses their place and is told nothing. Both
              // buttons go busy together, so neither can fire while the other
              // is redirecting — which is what `disabled` was here for.
              busy={pending !== null}
              data-testid="login-github"
              onClick={() => {
                setPending("github");
                void signIn("github", { callbackUrl: "/scopecraft" });
              }}
            >
              <GitHubMark />
              {pending === "github" ? t("login.redirecting") : t("login.github")}
            </Button>
          )}

          {providers.google && (
            <Button
              variant="secondary"
              className={styles.providerButton}
              busy={pending !== null}
              data-testid="login-google"
              onClick={() => {
                setPending("google");
                void signIn("google", { callbackUrl: "/scopecraft" });
              }}
            >
              <GoogleMark />
              {pending === "google" ? t("login.redirecting.google") : t("login.google")}
            </Button>
          )}

          <p className={styles.note}>{t("login.note")}</p>
        </Card>
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

/** Google's mark is the one place this file breaks from `currentColor`: the
 *  four brand colors are the mark's whole identity (they're how a user
 *  recognizes the button at a glance), unlike the monochrome GitHub logo,
 *  which is designed to work in a single ink. Inline for the same reason as
 *  GitHubMark — see the comment above it. */
function GoogleMark() {
  return (
    <svg
      className={styles.googleMark}
      viewBox="0 0 18 18"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

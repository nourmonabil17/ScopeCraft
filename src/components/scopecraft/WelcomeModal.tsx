// src/components/scopecraft/WelcomeModal.tsx
//
// A one-time welcome, shown on first visit to the main page (owner: Yousef).
//
// This is the content that used to live on a separate landing page at `/`.
// `/` now redirects straight into `/scopecraft` — the intake form is the
// main page — and this popup carries the explanation instead of making a
// signed-in visitor click through a page to reach the form they came for.
//
// The panel is the Dialog primitive, which owns showModal(), the native
// <dialog>, the backdrop and the not-rendered-until-open rule. What stays here
// is the one thing a primitive should not know: "don't show this again", a
// plain localStorage flag checked once on mount.

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import styles from "./WelcomeModal.module.css";

const SEEN_KEY = "scopecraft.welcomeSeen";

export function WelcomeModal() {
  const { t } = useLanguage();
  const [shouldRender, setShouldRender] = useState(false);

  // Reading localStorage must happen after mount, not during render: this is
  // a client-only value the server render can never see, and checking it
  // during render would make the client's hydrating pass disagree with the
  // server-rendered HTML — the same hydration-mismatch shape already fixed
  // elsewhere in this app for the duplicate-prefill read.
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    // Same justified exception as the duplicate-prefill effect in
    // ScopeCraftPage: this is a one-shot read of an external, non-reactive
    // source (localStorage) on mount, not state derivable during render —
    // computing it during render is exactly what would reintroduce the
    // hydration mismatch the comment above explains.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShouldRender(true);
  }, []);

  // The second effect that called showModal() is gone — Dialog does that. So
  // is the ref: the CTA below calls this directly rather than reaching for the
  // element, and Escape still arrives through Dialog's own `close` handler.
  // Both paths record "seen", which is the property that matters.
  function handleClose() {
    localStorage.setItem(SEEN_KEY, "1");
    setShouldRender(false);
  }

  return (
    <Dialog open={shouldRender} onClose={handleClose} labelledBy="welcome-heading">
      <h2 id="welcome-heading" className={styles.heading}>
        {t("landing.heading")}
      </h2>
      <p className={styles.tagline}>{t("app.tagline")}</p>

      <section className={styles.example} aria-labelledby="welcome-example-heading">
        <h3 id="welcome-example-heading" className={styles.exampleHeading}>
          {t("landing.exampleHeading")}
        </h3>
        <p className={styles.examplePrd}>{t("landing.examplePrd")}</p>
      </section>

      <Button onClick={handleClose}>{t("landing.cta")}</Button>
    </Dialog>
  );
}

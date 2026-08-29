// src/components/scopecraft/WelcomeModal.tsx
//
// A one-time welcome, shown on first visit to the main page (owner: Yousef).
//
// This is the content that used to live on a separate landing page at `/`.
// `/` now redirects straight into `/scopecraft` — the intake form is the
// main page — and this popup carries the explanation instead of making a
// signed-in visitor click through a page to reach the form they came for.
//
// Native <dialog>, not a hand-rolled overlay: `showModal()` gives focus
// trapping, Escape-to-close, and a real top-layer backdrop for free. The one
// thing it doesn't give is "don't show this again" — that's a plain
// localStorage flag, checked once on mount.
//
// Not rendered at all until the mount effect decides it should be — rather
// than always rendering a closed <dialog> and relying on `dialog:not([open])
// { display: none }` to hide its content. A closed dialog's children are
// still real DOM nodes, and that UA-stylesheet rule isn't something every
// environment applies consistently. Rendering nothing until shown sidesteps
// the question entirely.

"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./WelcomeModal.module.css";

const SEEN_KEY = "scopecraft.welcomeSeen";

export function WelcomeModal() {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
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

  // A second effect, not folded into the one above: `ref.current` is only
  // non-null once the <dialog> has actually rendered, which only happens
  // after `shouldRender` flips true and React commits that render.
  useEffect(() => {
    if (shouldRender) ref.current?.showModal();
  }, [shouldRender]);

  // Fires on every path a <dialog> can close through — the button below,
  // and the browser's own Escape-key handling — so "seen" is recorded
  // however the visitor dismissed it, not just on a button click.
  function handleClose() {
    localStorage.setItem(SEEN_KEY, "1");
    setShouldRender(false);
  }

  if (!shouldRender) return null;

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="welcome-heading" onClose={handleClose}>
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

      <button type="button" className={styles.cta} onClick={() => ref.current?.close()}>
        {t("landing.cta")}
      </button>
    </dialog>
  );
}

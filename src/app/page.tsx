// Public landing page (owner: Yousef).
//
// Deliberately has no `auth()` call. The single CTA always points at
// /login, which already resolves the "already signed in" case server-side
// (redirect("/scopecraft") in src/app/login/page.tsx) before rendering
// anything — duplicating that check here would be a second place a session
// check could drift out of sync with the first. That also keeps this page a
// plain static route: no cookies read, nothing here opts it out of
// prerendering.
//
// The body copy lives in HomeContent, a client component, because it needs
// useLanguage() to respond to the language toggle — this file stays a
// Server Component so `metadata` below is valid and the route can still
// prerender.

import type { Metadata } from "next";
import { Header } from "@/components/common/Header";
import { translate } from "@/lib/i18n/translations";
import { HomeContent } from "./HomeContent";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ScopeCraft",
  description: translate("en", "landing.heading"),
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <HomeContent />
      </main>
    </>
  );
}

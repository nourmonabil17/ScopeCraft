"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./page.module.css";

export function HomeContent() {
  const { t } = useLanguage();

  return (
    <div className={styles.content}>
      <h1 className={styles.heading}>{t("landing.heading")}</h1>
      <p className={styles.tagline}>{t("app.tagline")}</p>

      <section className={styles.example} aria-labelledby="example-heading">
        <h2 id="example-heading" className={styles.exampleHeading}>
          {t("landing.exampleHeading")}
        </h2>
        <p className={styles.examplePrd}>{t("landing.examplePrd")}</p>
      </section>

      <Link href="/login" className={styles.cta}>
        {t("landing.cta")}
      </Link>
    </div>
  );
}

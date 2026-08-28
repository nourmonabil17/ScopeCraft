//
// A back-navigation link with a direction-aware arrow.
//
// No literal "←" glyph: it points the wrong way once the page is `dir="rtl"`,
// where "back" reads right, not left. `inset-inline-start` on the icon
// container solves this the same way the rest of this app's layout does —
// no per-direction branching in the component itself.

"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import styles from "./BackLink.module.css";

export interface BackLinkProps {
  href: string;
  labelKey: TranslationKey;
}

export function BackLink({ href, labelKey }: BackLinkProps) {
  const { t } = useLanguage();

  return (
    <Link href={href} className={styles.link}>
      <span className={styles.arrow} aria-hidden="true" />
      {t(labelKey)}
    </Link>
  );
}

// src/context/LanguageContext.tsx
//
// Active locale + text direction.
//
// `t()` is exposed rather than the raw dictionary so every call site goes
// through one interpolation path, and so a missing key is a TypeScript error
// at the call site (TranslationKey is a closed union) rather than an
// "undefined" rendered into the page.
//
// Direction is applied to <html> — not to a wrapper div — because `dir` on the
// root is what CSS logical properties, form controls, and the browser's own
// text-selection and caret behaviour all key off.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  directionFor,
  interpolate,
  isLocale,
  TRANSLATIONS,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n/translations";

export const LOCALE_STORAGE_KEY = "scopecraft.locale";

export type Translator = (
  key: TranslationKey,
  values?: Record<string, string | number>
) => string;

interface LanguageContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: Translator;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Applied before first paint, alongside the theme script, so the document
 * never renders LTR and then snaps to RTL. Behaviourally identical to the
 * effect below.
 */
export const LANGUAGE_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${LOCALE_STORAGE_KEY}');
    var locale = (stored === 'en' || stored === 'ar') ? stored : 'en';
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  } catch (e) {}
})();
`.trim();

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored && isLocale(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Won't persist across reloads; the session still switches.
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const next: Locale = current === "en" ? "ar" : "en";
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // As above.
      }
      return next;
    });
  }, []);

  const direction = directionFor(locale);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const t = useCallback<Translator>(
    (key, values) => interpolate(TRANSLATIONS[locale][key], values),
    [locale]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, direction, setLocale, toggleLocale, t }),
    [locale, direction, setLocale, toggleLocale, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }
  return context;
}

/** Convenience for components that only need the translator. */
export function useTranslation(): Translator {
  return useLanguage().t;
}

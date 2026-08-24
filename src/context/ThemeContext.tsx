// src/context/ThemeContext.tsx
//
// Theme preference: 'light' | 'dark' | 'system'.
//
// The *preference* and the *resolved* theme are deliberately separate values.
// 'system' is a real, persistable choice — it means "follow the OS" — and it
// must keep following the OS if the user changes their OS setting while the
// page is open. Collapsing the two would make 'system' a one-shot read.
//
// Flash prevention: the stored preference is applied by a blocking inline
// script in layout.tsx *before* first paint (see THEME_INIT_SCRIPT). This
// provider then adopts whatever that script already decided, so React's first
// render agrees with the DOM instead of correcting it a frame later.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "scopecraft.theme";

interface ThemeContextValue {
  /** What the user chose, including 'system'. */
  preference: ThemePreference;
  /** What is actually rendered right now — never 'system'. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Cycles light → dark → system, for the single-button toggle. */
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs before first paint, inlined into <head>. Kept dependency-free and
 * wrapped in try/catch because localStorage throws outright in some privacy
 * modes — a theme preference is never worth breaking the page over.
 *
 * Must stay behaviourally identical to `resolveTheme` + `applyTheme` below.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`.trim();

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The OS colour preference as an external store.
 *
 * `useSyncExternalStore` rather than state-plus-effect: the OS setting is
 * exactly that — state owned outside React that we subscribe to. Mirroring it
 * into `useState` and syncing with an effect would make the resolved theme
 * lag one render behind, and is the pattern `react-hooks/set-state-in-effect`
 * exists to prevent.
 */
function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/** Server snapshot: no OS to ask, so assume light. The pre-paint script
 *  corrects this before the user sees anything. */
function getServerSystemPrefersDark(): boolean {
  return false;
}

function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // Private mode / storage disabled. Fall back to following the OS.
    return "system";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initial state reads the same source the inline script read, so the
  // first React render matches the pre-painted DOM rather than fighting it.
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);

  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemPrefersDark,
    getServerSystemPrefersDark
  );

  // Derived during render, not mirrored into state. A user on 'system' whose
  // OS flips to dark re-renders through the store subscription above.
  const theme = resolveTheme(preference, systemDark);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference simply won't persist; the session still honours it.
    }
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((current) => {
      const next: ThemePreference =
        current === "light" ? "dark" : current === "dark" ? "system" : "light";
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // As above.
      }
      return next;
    });
  }, []);

  // The one genuine side effect: pushing the resolved theme onto <html>. This
  // is React talking to an external system (the document), which is exactly
  // what an effect is for.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, cyclePreference }),
    [preference, theme, setPreference, cyclePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}

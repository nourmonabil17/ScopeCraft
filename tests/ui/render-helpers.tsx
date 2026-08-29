// tests/ui/render-helpers.tsx
//
// Every UI component now reads from LanguageProvider (translations) and most
// read ThemeProvider / ToastProvider too. Rendering one bare would throw, so
// tests go through `renderWithProviders` — which also mirrors how the real app
// mounts them, rather than testing components in an arrangement production
// never uses.
//
// `localStorage` is cleared between tests by `resetPreferences` (called from
// setup.ts), so a theme or locale chosen in one test cannot leak into the next.

import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider, LOCALE_STORAGE_KEY } from "@/context/LanguageContext";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastViewport } from "@/components/common/Toast";
import type { Locale } from "@/lib/i18n/translations";

export interface ProviderRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Seeds the stored locale before mounting, so a component can be rendered
   *  directly in Arabic without a click. */
  locale?: Locale;
  /** Seeds the stored theme preference the same way. */
  theme?: "light" | "dark" | "system";
}

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    // `session={null}` is not decoration: given an explicit session,
    // SessionProvider treats it as already-resolved and skips the mount-time
    // GET /api/auth/session. Without it every UI test would fire a fetch that
    // the shared `globalThis.fetch` mock answers with undefined, and the
    // resulting rejection surfaces as an unrelated failure in whichever test
    // happens to still be mounted. Signed-out is also the honest default —
    // no component under test depends on being signed in.
    <SessionProvider session={null}>
      <LanguageProvider>
        <ThemeProvider>
          <ToastProvider>
            {children}
            <ToastViewport />
          </ToastProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  { locale, theme, ...options }: ProviderRenderOptions = {}
): RenderResult {
  // Written before mount: both providers read localStorage in their lazy
  // useState initializer, so setting it afterwards would be too late.
  if (locale) window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  if (theme) window.localStorage.setItem(THEME_STORAGE_KEY, theme);

  return render(ui, { wrapper: AllProviders, ...options });
}

/** Clears persisted preferences and any <html> attributes the providers set. */
export function resetPreferences(): void {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("style");
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
}

/**
 * jsdom does not implement `matchMedia` at all. ThemeProvider subscribes to
 * it through useSyncExternalStore, so without a stub every themed render
 * throws. Returns a setter so a test can simulate the OS being in dark mode.
 */
export function installMatchMedia(initialDark = false): (dark: boolean) => void {
  let matches = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        return query.includes("dark") ? matches : false;
      },
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });

  return (dark: boolean) => {
    matches = dark;
    for (const listener of listeners) {
      listener({ matches: dark } as MediaQueryListEvent);
    }
  };
}

/**
 * jsdom implements the <dialog> element's `open` attribute but not the
 * imperative modal API — `showModal`/`close` are simply absent at runtime
 * (TypeScript's DOM lib still declares them, since real browsers have them),
 * so any component that calls them throws under Jest with no polyfill. Only
 * ever imported from test setup, never from application code, so this
 * unconditionally overwrites rather than feature-detecting first — there is
 * no real-browser case here to protect. Side-effect-free to call more than
 * once, unlike `installMatchMedia`: there is no per-test state to reset, so
 * this runs once at module load from setup.ts rather than per-test.
 */
export function installDialogPolyfill(): void {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

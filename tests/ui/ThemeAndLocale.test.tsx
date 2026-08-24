// tests/ui/ThemeAndLocale.test.tsx
//
// The theme engine and the bilingual/RTL layer.
//
// These assert the *observable contract* — what lands on <html>, what is
// written to localStorage, what a screen reader is told — rather than
// component internals, because those are exactly the things a regression
// would break silently: a theme that no longer persists, or a direction that
// stops flipping, still renders a page that looks fine in a screenshot.

import { screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, installMatchMedia } from "./render-helpers";
import ScopeCraftPage from "@/app/scopecraft/page";
import { InputForm } from "@/components/scopecraft/InputForm";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { THEME_STORAGE_KEY } from "@/context/ThemeContext";
import { LOCALE_STORAGE_KEY } from "@/context/LanguageContext";
import { TRANSLATIONS, translate } from "@/lib/i18n/translations";

const root = () => document.documentElement;

// ---------------------------------------------------------------------------
// Theme engine
// ---------------------------------------------------------------------------

describe("ThemeProvider · resolution and persistence", () => {
  it("defaults to system and follows the OS when no preference is stored", () => {
    installMatchMedia(true); // OS is in dark mode
    renderWithProviders(<ThemeToggle />);

    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-preference", "system");
    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-theme", "dark");
    expect(root()).toHaveClass("dark");
    expect(root().style.colorScheme).toBe("dark");
  });

  it("resolves system to light when the OS is light", () => {
    installMatchMedia(false);
    renderWithProviders(<ThemeToggle />);

    expect(root()).not.toHaveClass("dark");
    expect(root().style.colorScheme).toBe("light");
  });

  it("honours an explicit light choice even while the OS is dark", () => {
    installMatchMedia(true);
    renderWithProviders(<ThemeToggle />, { theme: "light" });

    // This is the case a bare prefers-color-scheme media query cannot express,
    // and the whole reason theming is class-driven.
    expect(root()).not.toHaveClass("dark");
    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-theme", "light");
  });

  it("cycles light -> dark -> system on each activation", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />, { theme: "light" });
    const toggle = screen.getByTestId("theme-toggle");

    expect(toggle).toHaveAttribute("data-preference", "light");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-preference", "dark");
    expect(root()).toHaveClass("dark");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-preference", "system");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-preference", "light");
  });

  it("persists the chosen preference to localStorage", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />, { theme: "light" });

    await user.click(screen.getByTestId("theme-toggle"));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("restores a persisted preference on the next mount", () => {
    installMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderWithProviders(<ThemeToggle />);

    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-preference", "dark");
    expect(root()).toHaveClass("dark");
  });

  it("keeps following the OS while on system if the OS changes mid-session", () => {
    const setSystemDark = installMatchMedia(false);
    renderWithProviders(<ThemeToggle />, { theme: "system" });
    expect(root()).not.toHaveClass("dark");

    // The OS flips while the tab is open. A one-shot read at mount would miss
    // this entirely.
    act(() => setSystemDark(true));

    expect(root()).toHaveClass("dark");
    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-theme", "dark");
  });

  it("does NOT follow the OS once an explicit choice has been made", () => {
    const setSystemDark = installMatchMedia(false);
    renderWithProviders(<ThemeToggle />, { theme: "light" });

    act(() => setSystemDark(true));

    expect(root()).not.toHaveClass("dark");
  });

  it("ignores a corrupted stored value instead of throwing", () => {
    installMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "chartreuse");
    renderWithProviders(<ThemeToggle />);

    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-preference", "system");
  });

  it("names the current state and the next one in its accessible label", () => {
    installMatchMedia(false);
    renderWithProviders(<ThemeToggle />, { theme: "light" });

    // "Switch theme" alone would leave a screen-reader user unable to tell
    // what they are switching from.
    const label = screen.getByTestId("theme-toggle").getAttribute("aria-label") ?? "";
    expect(label).toMatch(/light/i);
    expect(label).toMatch(/dark/i);
  });
});

// ---------------------------------------------------------------------------
// Locale + direction
// ---------------------------------------------------------------------------

describe("LanguageProvider · locale and direction", () => {
  it("starts in English, LTR", () => {
    renderWithProviders(<LanguageToggle />);

    expect(root().lang).toBe("en");
    expect(root().dir).toBe("ltr");
  });

  it("sets dir=rtl and lang=ar when Arabic is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByTestId("language-option-ar"));

    expect(root().lang).toBe("ar");
    expect(root().dir).toBe("rtl");
  });

  it("returns to LTR when switching back to English", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />, { locale: "ar" });
    expect(root().dir).toBe("rtl");

    await user.click(screen.getByTestId("language-option-en"));

    expect(root().lang).toBe("en");
    expect(root().dir).toBe("ltr");
  });

  it("persists and restores the chosen locale", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByTestId("language-option-ar"));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ar");

    unmount();
    renderWithProviders(<LanguageToggle />);

    expect(root().dir).toBe("rtl");
    expect(screen.getByTestId("language-option-ar")).toHaveAttribute("aria-checked", "true");
  });

  it("exposes the choice as a radiogroup, not two unrelated buttons", () => {
    renderWithProviders(<LanguageToggle />);

    const group = screen.getByRole("radiogroup");
    const options = within(group).getAllByRole("radio");
    expect(options).toHaveLength(2);
    // Exactly one is checked — that is what tells a screen reader which
    // language is active.
    expect(options.filter((o) => o.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("labels each option in its own language, with a matching lang attribute", () => {
    renderWithProviders(<LanguageToggle />);

    const arabic = screen.getByTestId("language-option-ar");
    expect(arabic).toHaveAttribute("lang", "ar");
    expect(arabic).toHaveTextContent("العربية");
    expect(screen.getByTestId("language-option-en")).toHaveAttribute("lang", "en");
  });
});

// ---------------------------------------------------------------------------
// Dictionary integrity
// ---------------------------------------------------------------------------

describe("translations", () => {
  it("has an Arabic string for every English key", () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const arKeys = Object.keys(TRANSLATIONS.ar).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it("leaves no Arabic value empty or accidentally left in English", () => {
    for (const [key, value] of Object.entries(TRANSLATIONS.ar)) {
      expect(value.trim().length).toBeGreaterThan(0);
      // Language/product names are legitimately shared between the two.
      const sharedByDesign = ["header.language.en", "header.language.ar"];
      if (!sharedByDesign.includes(key)) {
        expect(value).not.toBe(TRANSLATIONS.en[key as keyof typeof TRANSLATIONS.en]);
      }
    }
  });

  it("substitutes placeholders and leaves unknown ones untouched", () => {
    expect(translate("en", "form.idea.hint", { min: 20 })).toContain("20");
    // A missing value must not render "undefined" into the page.
    expect(translate("en", "form.idea.hint")).toContain("{min}");
  });

  it("keeps every placeholder present in the English string in the Arabic one", () => {
    const placeholders = (text: string) =>
      (text.match(/\{(\w+)\}/g) ?? []).sort();

    for (const key of Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[]) {
      // A dropped placeholder silently loses a number the sentence needs.
      expect(placeholders(TRANSLATIONS.ar[key])).toEqual(
        placeholders(TRANSLATIONS.en[key])
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Bilingual rendering of real components
// ---------------------------------------------------------------------------

describe("bilingual rendering", () => {
  it("renders the intake wizard in Arabic", () => {
    renderWithProviders(<InputForm onSubmit={jest.fn()} />, { locale: "ar" });

    expect(screen.getByLabelText(/فكرة المنتج/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "أنشئ الخطة" })).toBeInTheDocument();
    expect(screen.getByText(/ابدأ من مثال/)).toBeInTheDocument();
  });

  it("shows Arabic validation messages for an Arabic user", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InputForm onSubmit={jest.fn()} />, { locale: "ar" });

    await user.click(screen.getByRole("button", { name: "أنشئ الخطة" }));

    expect(screen.getAllByText(/فكرة المنتج مطلوبة/).length).toBeGreaterThan(0);
  });

  it("re-translates already-visible errors when the language changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <LanguageToggle />
        <InputForm onSubmit={jest.fn()} />
      </>
    );

    await user.click(screen.getByRole("button", { name: /generate plan/i }));
    expect(screen.getAllByText(/product idea is required/i).length).toBeGreaterThan(0);

    await user.click(screen.getByTestId("language-option-ar"));

    // The message must follow the switch — a stale English string sitting in
    // component state is exactly what deriving errors during render prevents.
    expect(screen.getAllByText(/فكرة المنتج مطلوبة/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/product idea is required/i)).not.toBeInTheDocument();
  });

  it("switches the whole page, header included, without losing state", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScopeCraftPage />);

    const idea = screen.getByLabelText(/product idea/i);
    await user.type(idea, "A tool for planning student software projects end to end.");

    await user.click(screen.getByTestId("language-option-ar"));

    expect(root().dir).toBe("rtl");
    expect(screen.getByRole("button", { name: "أنشئ الخطة" })).toBeInTheDocument();
    // Typed input survives a language change.
    expect(screen.getByLabelText(/فكرة المنتج/)).toHaveValue(
      "A tool for planning student software projects end to end."
    );
  });
});

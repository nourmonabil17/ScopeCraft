// tests/ui/WelcomeModal.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { WelcomeModal } from "@/components/scopecraft/WelcomeModal";

const SEEN_KEY = "scopecraft.welcomeSeen";

describe("WelcomeModal", () => {
  // The shared test setup defaults every test to "already seen" so
  // WelcomeModal doesn't pop open in unrelated tests elsewhere in the suite
  // (see tests/ui/setup.ts). This file is specifically testing the
  // first-visit behavior, so it opts back out of that default.
  beforeEach(() => {
    localStorage.removeItem(SEEN_KEY);
  });

  it("opens automatically on first visit", () => {
    renderWithProviders(<WelcomeModal />);

    expect(
      screen.getByRole("heading", { name: "Turn a product idea into a sprint-ready plan." })
    ).toBeInTheDocument();
    expect(screen.getByText(/one of seven user stories/i)).toBeInTheDocument();
  });

  it("does not open again once dismissed", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<WelcomeModal />);

    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    unmount();

    renderWithProviders(<WelcomeModal />);
    expect(
      screen.queryByRole("heading", { name: "Turn a product idea into a sprint-ready plan." })
    ).not.toBeInTheDocument();
  });

  it("records dismissal on Escape, not only the button", () => {
    renderWithProviders(<WelcomeModal />);

    const dialog = screen.getByRole("heading", {
      name: "Turn a product idea into a sprint-ready plan.",
    }).closest("dialog") as HTMLDialogElement;
    dialog.close();

    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
  });

  it("translates its content", () => {
    renderWithProviders(<WelcomeModal />, { locale: "ar" });

    expect(
      screen.getByRole("heading", { name: "حوّل فكرة منتجك إلى خطة جاهزة للسبرنت." })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ابدأ الآن" })).toBeInTheDocument();
  });
});

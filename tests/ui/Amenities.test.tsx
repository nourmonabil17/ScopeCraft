// tests/ui/Amenities.test.tsx
//
// The modern-app amenities layered on in this pass: the toast system, the
// global header, the capacity slider, and the character progress ring.
//
// The recurring theme in these assertions is that a convenience must not cost
// accessibility — a second visual affordance for an existing control must not
// become a second thing a screen reader has to disambiguate.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { Header } from "@/components/common/Header";
import { InputForm } from "@/components/scopecraft/InputForm";
import { useToast } from "@/context/ToastContext";
import {
  MAX_TEAM_CAPACITY_POINTS,
  MIN_TEAM_CAPACITY_POINTS,
} from "@/lib/scopecraft/schema";

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

/** Small harness so toasts can be raised without driving a full export flow. */
function ToastDriver() {
  const { showToast } = useToast();
  return (
    <div>
      <button type="button" onClick={() => showToast("Saved successfully", "success")}>
        raise success
      </button>
      <button type="button" onClick={() => showToast("Something failed", "error")}>
        raise error
      </button>
    </div>
  );
}

describe("Toast system", () => {
  it("renders the live region before any toast exists", () => {
    renderWithProviders(<ToastDriver />);

    // Mounting a live region only once a message arrives is the classic
    // mistake — assistive tech never registers it, so nothing is announced.
    const viewport = screen.getByTestId("toast-viewport");
    expect(viewport).toHaveAttribute("aria-live", "polite");
    expect(viewport).toHaveAttribute("role", "status");
    expect(within(viewport).queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("shows a toast with its message and tone", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastDriver />);

    await user.click(screen.getByRole("button", { name: /raise success/i }));

    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("Saved successfully");
    expect(toast).toHaveAttribute("data-tone", "success");
  });

  it("distinguishes an error toast from a success one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastDriver />);

    await user.click(screen.getByRole("button", { name: /raise error/i }));

    expect(screen.getByTestId("toast")).toHaveAttribute("data-tone", "error");
  });

  it("stacks multiple toasts rather than replacing the previous one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastDriver />);

    await user.click(screen.getByRole("button", { name: /raise success/i }));
    await user.click(screen.getByRole("button", { name: /raise error/i }));

    expect(screen.getAllByTestId("toast")).toHaveLength(2);
  });

  it("can be dismissed with an explicitly labelled control", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastDriver />);
    await user.click(screen.getByRole("button", { name: /raise success/i }));

    await user.click(screen.getByRole("button", { name: /dismiss notification/i }));

    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
    // The region itself survives, ready for the next message.
    expect(screen.getByTestId("toast-viewport")).toBeInTheDocument();
  });

  it("localizes the dismiss control", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastDriver />, { locale: "ar" });
    await user.click(screen.getByRole("button", { name: /raise success/i }));

    expect(screen.getByRole("button", { name: "إغلاق الإشعار" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

describe("Header", () => {
  it("renders as a banner landmark with brand, status, and both toggles", () => {
    renderWithProviders(<Header />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("ScopeCraft")).toBeInTheDocument();
    expect(screen.getByText(/live/i)).toBeInTheDocument();
    expect(screen.getByTestId("language-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("hides the reset action when there is nothing to reset", () => {
    renderWithProviders(<Header />);

    // A permanently-disabled control is noise; absence is the honest state.
    expect(screen.queryByTestId("header-reset")).not.toBeInTheDocument();
  });

  it("calls onReset when the action is available and used", async () => {
    const onReset = jest.fn();
    const user = userEvent.setup();
    renderWithProviders(<Header onReset={onReset} />);

    await user.click(screen.getByTestId("header-reset"));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("translates its actions but keeps the brand name as-is", () => {
    renderWithProviders(<Header onReset={jest.fn()} />, { locale: "ar" });

    expect(screen.getByTestId("header-reset")).toHaveTextContent("وثيقة جديدة");
    // The brand is a name, not a string to localize.
    expect(screen.getByText("ScopeCraft")).toBeInTheDocument();
  });

  // The header is sticky and precedes the form with several toggles in between,
  // so without this a keyboard user tabs the entire chrome on every visit.
  it("offers a skip link as the first focusable element, pointing at main", () => {
    renderWithProviders(<Header onReset={jest.fn()} />);

    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");

    // "First focusable" is the property that makes it useful; a skip link that
    // arrives after the toggles has skipped nothing.
    const focusable = screen.getByRole("banner").querySelectorAll("a, button");
    expect(focusable[0]).toBe(skip);
  });

  it("localizes the skip link", () => {
    renderWithProviders(<Header />, { locale: "ar" });

    expect(
      screen.getByRole("link", { name: "تخطَّ إلى المحتوى الرئيسي" })
    ).toBeInTheDocument();
  });

  // Machine translation renders "ScopeCraft" as "craft of scope" in Arabic.
  it("marks the brand name as non-translatable", () => {
    renderWithProviders(<Header />);

    expect(screen.getByText("ScopeCraft")).toHaveAttribute("translate", "no");
  });
});

// ---------------------------------------------------------------------------
// Capacity slider + progress ring
// ---------------------------------------------------------------------------

describe("Intake wizard amenities", () => {
  it("keeps the slider out of the accessibility tree so capacity is announced once", () => {
    renderWithProviders(<InputForm onSubmit={jest.fn()} />);

    const slider = screen.getByTestId("capacity-slider");
    // Two visible controls, one setting: exposing both would announce the same
    // value twice with no indication they are linked.
    expect(slider).toHaveAttribute("aria-hidden", "true");
    expect(slider).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    // The labelled number input remains the single accessible control.
    expect(screen.getByLabelText(/team capacity/i)).toBeInTheDocument();
  });

  it("binds the slider to the schema's capacity range", () => {
    renderWithProviders(<InputForm onSubmit={jest.fn()} />);

    const slider = screen.getByTestId("capacity-slider");
    expect(slider).toHaveAttribute("min", String(MIN_TEAM_CAPACITY_POINTS));
    expect(slider).toHaveAttribute("max", String(MAX_TEAM_CAPACITY_POINTS));
  });

  it("keeps slider and number input in sync when the number changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InputForm onSubmit={jest.fn()} />);

    const capacity = screen.getByLabelText(/team capacity/i);
    await user.clear(capacity);
    await user.type(capacity, "45");

    expect(screen.getByTestId("capacity-slider")).toHaveValue("45");
  });

  it("submits the value set through the slider", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    renderWithProviders(<InputForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText(/product idea/i),
      "A planning tool for student software teams working in short sprints."
    );
    // Dragging is not simulable; setting the range's value fires the same
    // change event the pointer would.
    const slider = screen.getByTestId("capacity-slider");
    await user.clear(screen.getByLabelText(/team capacity/i));
    await user.type(screen.getByLabelText(/team capacity/i), "12");
    expect(slider).toHaveValue("12");

    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ team_capacity_points: 12 })
    );
  });

  it("does not announce the decorative progress ring", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<InputForm onSubmit={jest.fn()} />);

    await user.type(screen.getByLabelText(/product idea/i), "Halfway there");

    // The numeric counter is the accessible source of truth; the ring is a
    // second visual encoding of the same number.
    const ring = container.querySelector("svg[aria-hidden='true']");
    expect(ring).not.toBeNull();
    expect(screen.getByText(/13\/2000/)).toBeInTheDocument();
  });
});

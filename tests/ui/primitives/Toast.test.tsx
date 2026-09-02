// tests/ui/primitives/Toast.test.tsx
//
// Tone changes how the message is announced, not just how it looks. An error
// routed through a polite live region waits for a pause in speech, which for a
// failed generation can mean the user acts on a plan that was never produced.
// That is why role is asserted per tone here and not treated as styling.

import { render, screen } from "@testing-library/react";
import { Toast } from "@/components/ui/Toast";

describe("Toast", () => {
  it("renders its message", () => {
    render(<Toast>Plan saved.</Toast>);
    expect(screen.getByText("Plan saved.")).toBeInTheDocument();
  });

  it("announces an error assertively", () => {
    render(<Toast tone="error">Generation failed.</Toast>);
    expect(screen.getByRole("alert")).toHaveTextContent("Generation failed.");
  });

  it.each(["success", "info"] as const)("announces %s politely", (tone) => {
    render(<Toast tone={tone}>Saved.</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("defaults to the info tone", () => {
    const { container } = render(<Toast>Heads up.</Toast>);
    expect(container.firstElementChild).toHaveClass("info");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it.each(["success", "error", "info"] as const)("applies the %s tone class", (tone) => {
    const { container } = render(<Toast tone={tone}>message</Toast>);
    expect(container.firstElementChild).toHaveClass(tone);
  });

  // The tone must survive greyscale: the message text is the information, and
  // the colour only reinforces it. A toast whose meaning is carried by its
  // background alone fails WCAG 1.4.1 the same way a coloured chip would.
  it("carries its meaning as text rather than colour", () => {
    render(<Toast tone="error">Could not reach the planner.</Toast>);
    expect(screen.getByText("Could not reach the planner.")).toBeInTheDocument();
  });
});

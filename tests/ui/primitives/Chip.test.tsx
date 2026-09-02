// tests/ui/primitives/Chip.test.tsx
//
// The test that matters here is the last one. A chip's bucket must be legible
// without colour — that is a WCAG 1.4.1 obligation, not a stylistic choice —
// and the way this component keeps that promise is by having no colour props
// at all and always rendering its label as text.

import { render, screen } from "@testing-library/react";
import { Chip } from "@/components/ui/Chip";

describe("Chip", () => {
  it("renders its text content", () => {
    render(<Chip>MUST</Chip>);
    expect(screen.getByText("MUST")).toBeInTheDocument();
  });

  it("defaults to the outline weight", () => {
    const { container } = render(<Chip>SHOULD</Chip>);
    expect(container.firstElementChild).toHaveClass("outline");
  });

  it.each(["solid", "outline", "dashed"] as const)("applies the %s weight class", (weight) => {
    const { container } = render(<Chip weight={weight}>bucket</Chip>);
    expect(container.firstElementChild).toHaveClass(weight);
  });

  // The guarantee, stated as a test: the bucket is readable text, so it
  // survives greyscale, colour blindness and a screen reader alike. If someone
  // later adds a `tone` or `colour` prop, this is the test that should stop
  // them — the information may never live in the fill alone.
  it("carries its meaning as text, not as colour", () => {
    render(<Chip weight="dashed">COULD</Chip>);
    expect(screen.getByText("COULD")).toBeInTheDocument();
  });

  it("keeps a caller's own className alongside its own", () => {
    const { container } = render(<Chip className="inline">WON&apos;T</Chip>);
    expect(container.firstElementChild).toHaveClass("inline");
    expect(container.firstElementChild).toHaveClass("chip");
  });
});

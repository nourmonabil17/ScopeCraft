// tests/ui/primitives/Card.test.tsx
//
// A Card carries no behaviour, so what is worth testing is the shape of the
// element it produces and the promise that it stays inert. The visual half —
// that a light card is lifted by its rule and a dark one by its fill — cannot
// be tested in jsdom and is verified in the browser instead.

import { render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Sprint 1</Card>);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("renders a div by default", () => {
    const { container } = render(<Card>plain</Card>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("renders the element named by `as`", () => {
    render(<Card as="article">a story</Card>);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("renders an li when asked, for use inside a real list", () => {
    render(
      <ul>
        <Card as="li">a plan</Card>
      </ul>
    );
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("applies the recessed class only when asked", () => {
    const { container, rerender } = render(<Card>default</Card>);
    expect(container.firstElementChild).not.toHaveClass("recessed");

    rerender(<Card recessed>deferred</Card>);
    expect(container.firstElementChild).toHaveClass("recessed");
  });

  it("applies the muted class only when asked", () => {
    const { container } = render(<Card muted>deferred</Card>);
    expect(container.firstElementChild).toHaveClass("muted");
  });

  // A card is a surface, not a control. If one ever needs to be clickable, the
  // button goes inside it — a clickable div is the accessibility bug this
  // primitive exists to make hard to write.
  it("is inert: it contributes no button or link of its own", () => {
    render(<Card>just content</Card>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps a caller's own className alongside its own", () => {
    const { container } = render(<Card className="wide">x</Card>);
    expect(container.firstElementChild).toHaveClass("wide");
    expect(container.firstElementChild).toHaveClass("card");
  });

  // A story card is an <article>. An article with no accessible name is an
  // unlabelled landmark-adjacent region, so the name has to be able to get in
  // — and the name lives on a heading that is already inside the card.
  it("names itself from an element inside it", () => {
    render(
      <Card as="article" labelledBy="story-US-1-heading" testId="story-card-US-1">
        <span id="story-US-1-heading">US-1</span>
      </Card>
    );
    const card = screen.getByTestId("story-card-US-1");
    expect(card.tagName).toBe("ARTICLE");
    expect(card).toHaveAttribute("aria-labelledby", "story-US-1-heading");
  });

  it("takes an id so something else can point at it", () => {
    const { container } = render(<Card id="panel-1">body</Card>);
    expect(container.firstElementChild).toHaveAttribute("id", "panel-1");
  });

  // The reason there is no {...rest} spread: it would carry onClick, and a
  // clickable div is exactly what this component's header refuses to be.
  it("emits no attribute for props that were not passed", () => {
    const { container } = render(<Card>body</Card>);
    const card = container.firstElementChild!;
    expect(card).not.toHaveAttribute("id");
    expect(card).not.toHaveAttribute("aria-labelledby");
    expect(card).not.toHaveAttribute("data-testid");
  });
});

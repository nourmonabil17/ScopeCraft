// tests/ui/primitives/Button.test.tsx
//
// jest.config.js maps *.module.css to identity-obj-proxy, so there is no
// computed style in jsdom and no assertion here can be about colour, spacing or
// breakpoints. What is testable is what actually matters for a primitive:
// the element it renders, its accessible name, its attributes, and its
// behaviour. Visual and responsive checking happens in a browser.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../render-helpers";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders a real button element with its label as the accessible name", () => {
    renderWithProviders(<Button>Generate plan</Button>);
    expect(screen.getByRole("button", { name: "Generate plan" })).toBeInTheDocument();
  });

  it("defaults to type=button so it cannot accidentally submit a form", () => {
    renderWithProviders(<Button>Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
  });

  it("still accepts type=submit when a form actually wants it", () => {
    renderWithProviders(<Button type="submit">Generate</Button>);
    expect(screen.getByRole("button", { name: "Generate" })).toHaveAttribute("type", "submit");
  });

  it("calls onClick when activated", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderWithProviders(<Button onClick={onClick}>Export</Button>);

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderWithProviders(
      <Button disabled onClick={onClick}>
        Export
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  // busy is a distinct state from disabled: the control stays focusable and
  // keeps its name, so a screen-reader user is told it is working rather than
  // finding it silently gone from the tab order.
  it("marks a busy button aria-busy without removing it from the tab order", () => {
    renderWithProviders(<Button busy>Generating</Button>);
    const button = screen.getByRole("button", { name: "Generating" });

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toHaveAttribute("disabled");
  });

  it("suppresses onClick while busy", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderWithProviders(
      <Button busy onClick={onClick}>
        Generating
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "Generating" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the variant as a class so styling is selectable", () => {
    renderWithProviders(<Button variant="secondary">Reset</Button>);
    expect(screen.getByRole("button", { name: "Reset" })).toHaveClass("secondary");
  });

  // Added at Point 3 for the history list's delete action. It is a variant
  // rather than a colour passed in through className because both would be
  // single-class selectors, and which one won would depend on the order the
  // CSS chunks loaded — not something to leave to chance on a delete button.
  it.each(["primary", "secondary", "quiet", "danger"] as const)(
    "applies the %s variant as a class",
    (variant) => {
      renderWithProviders(<Button variant={variant}>Delete</Button>);
      expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(variant);
    }
  );

  it("keeps a caller's own className alongside its own", () => {
    renderWithProviders(<Button className="pinned">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toHaveClass("pinned");
    expect(button).toHaveClass("button");
  });
});

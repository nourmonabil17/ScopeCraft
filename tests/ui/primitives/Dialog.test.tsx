// tests/ui/primitives/Dialog.test.tsx
//
// The first test is the load-bearing one, and it is not obvious why. jsdom
// does not apply the UA stylesheet rule that hides a closed <dialog>'s
// children, so a component that merely rendered a closed dialog would still
// leak its content into every query on the page — which is exactly the bug
// that was found and fixed in WelcomeModal. Rendering null is the fix, and
// this asserts it.
//
// showModal() and close() come from installDialogPolyfill() in
// tests/ui/render-helpers.tsx, already called once from tests/ui/setup.ts.
// jsdom implements neither.

import { render, screen } from "@testing-library/react";
import { Dialog } from "@/components/ui/Dialog";

describe("Dialog", () => {
  it("renders nothing at all when closed", () => {
    render(
      <Dialog open={false} onClose={jest.fn()} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
  });

  it("renders its children when open", () => {
    render(
      <Dialog open onClose={jest.fn()} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });

  it("opens modally rather than merely being present", () => {
    render(
      <Dialog open onClose={jest.fn()} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    // The polyfill records showModal() by setting the open attribute.
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
  });

  it("takes its accessible name from the element named by labelledBy", () => {
    render(
      <Dialog open onClose={jest.fn()} labelledBy="dialog-title">
        <h2 id="dialog-title">Welcome to ScopeCraft</h2>
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "Welcome to ScopeCraft" })).toBeInTheDocument();
  });

  // Escape closes a native dialog without any handler of ours running, so
  // onClose must be driven by the element's own close event or a dismissal
  // that did not come from our button would go unrecorded.
  it("calls onClose when the dialog fires its close event", () => {
    const onClose = jest.fn();
    render(
      <Dialog open onClose={onClose} labelledBy="t">
        <h2 id="t">Welcome</h2>
      </Dialog>
    );

    (screen.getByRole("dialog") as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

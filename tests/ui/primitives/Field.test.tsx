// tests/ui/primitives/Field.test.tsx
//
// getByLabelText is the assertion that matters most in this file: it only
// succeeds when the label is genuinely associated with the control, so it
// fails for the exact bug this primitive exists to prevent — a label that
// merely sits next to an input.

import { render, screen } from "@testing-library/react";
import { Field } from "@/components/ui/Field";

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field id="idea" label="Product idea">
        <textarea />
      </Field>
    );
    expect(screen.getByLabelText("Product idea")).toBeInTheDocument();
  });

  it("links a hint through aria-describedby", () => {
    render(
      <Field id="idea" label="Product idea" hint="One or two sentences.">
        <textarea />
      </Field>
    );

    const control = screen.getByLabelText("Product idea");
    const hint = screen.getByText("One or two sentences.");

    expect(hint.id).toBeTruthy();
    expect(control.getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("links an error and marks the control invalid", () => {
    render(
      <Field id="idea" label="Product idea" error="Required.">
        <textarea />
      </Field>
    );

    const control = screen.getByLabelText("Product idea");
    const error = screen.getByText("Required.");

    expect(control.getAttribute("aria-describedby")).toContain(error.id);
    expect(control).toHaveAttribute("aria-invalid", "true");
  });

  it("references both hint and error when both are present", () => {
    render(
      <Field id="idea" label="Product idea" hint="One or two sentences." error="Required.">
        <textarea />
      </Field>
    );

    const control = screen.getByLabelText("Product idea");
    const describedBy = control.getAttribute("aria-describedby") ?? "";

    expect(describedBy).toContain(screen.getByText("One or two sentences.").id);
    expect(describedBy).toContain(screen.getByText("Required.").id);
  });

  // aria-invalid="false" is a valid value that some assistive tech announces.
  // A field that is simply not yet filled in is not invalid, and saying so out
  // loud on every control in a form is noise.
  it("sets no aria-invalid attribute at all when there is no error", () => {
    render(
      <Field id="idea" label="Product idea">
        <textarea />
      </Field>
    );
    expect(screen.getByLabelText("Product idea")).not.toHaveAttribute("aria-invalid");
  });

  it("sets no aria-describedby when there is neither hint nor error", () => {
    render(
      <Field id="idea" label="Product idea">
        <textarea />
      </Field>
    );
    expect(screen.getByLabelText("Product idea")).not.toHaveAttribute("aria-describedby");
  });

  // The control keeps ownership of its own value and handlers; this primitive
  // supplies identity and description only.
  it("leaves the control's own props untouched", () => {
    render(
      <Field id="capacity" label="Capacity">
        <input type="number" defaultValue={40} />
      </Field>
    );

    const control = screen.getByLabelText("Capacity");
    expect(control).toHaveAttribute("type", "number");
    expect(control).toHaveValue(40);
  });

  it("marks a required field for both sighted and screen-reader users", () => {
    render(
      <Field id="idea" label="Idea" requiredLabel="(required)">
        <textarea defaultValue="" />
      </Field>
    );

    const control = screen.getByLabelText(/idea/i);
    expect(control).toHaveAttribute("aria-required", "true");
    // The glyph is decorative; the word is what a screen reader reads — and it
    // comes from the caller, so the Arabic page gets the Arabic word.
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });

  it("points aria-errormessage at the error it renders", () => {
    render(
      <Field id="idea" label="Idea" error="Too short">
        <textarea defaultValue="" />
      </Field>
    );

    const control = screen.getByLabelText(/idea/i);
    expect(control).toHaveAttribute("aria-errormessage", "idea-error");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Too short")).toHaveAttribute("id", "idea-error");
  });

  it("appends extra described-by ids after its own", () => {
    render(
      <Field id="idea" label="Idea" hint="Describe it" describedBy={["idea-counter"]}>
        <textarea defaultValue="" />
      </Field>
    );

    // Order is the reading order: what to enter, then what went wrong, then
    // the running count.
    expect(screen.getByLabelText(/idea/i)).toHaveAttribute(
      "aria-describedby",
      "idea-hint idea-counter"
    );
  });

  it("omits aria-required and aria-errormessage when they do not apply", () => {
    render(
      <Field id="idea" label="Idea">
        <textarea defaultValue="" />
      </Field>
    );

    const control = screen.getByLabelText(/idea/i);
    expect(control).not.toHaveAttribute("aria-required");
    expect(control).not.toHaveAttribute("aria-errormessage");
  });
});

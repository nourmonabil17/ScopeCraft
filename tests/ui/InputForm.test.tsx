// tests/ui/InputForm.test.tsx
//
// Intake Discovery Wizard component tests (owner: Joe).
//
// These are written against the accessible surface — labels, roles, names —
// rather than against class names or DOM structure, so a restyle cannot break
// them and a broken label association cannot pass them. If `getByLabelText`
// stops finding a field, that IS the bug: a screen-reader user just lost it too.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { InputForm, validateIntake } from "@/components/scopecraft/InputForm";
import { STARTER_PRESETS } from "@/components/scopecraft/presets";
import {
  DEFAULT_SPRINT_LENGTH_DAYS,
  DEFAULT_TEAM_CAPACITY_POINTS,
  MAX_CONSTRAINTS_LENGTH,
  MAX_IDEA_LENGTH,
  MIN_IDEA_LENGTH,
} from "@/lib/scopecraft/schema";

/** Renders the form and returns the handler plus a configured user-event. */
function setup(props: Partial<React.ComponentProps<typeof InputForm>> = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  renderWithProviders(<InputForm onSubmit={onSubmit} {...props} />);
  return { onSubmit, user };
}

const fields = () => ({
  idea: screen.getByLabelText(/product idea/i),
  constraints: screen.getByLabelText(/constraints/i),
  capacity: screen.getByLabelText(/team capacity/i),
  sprintLength: screen.getByLabelText(/sprint length/i),
});

const submitButton = () => screen.getByRole("button", { name: /generate plan/i });

const VALID_IDEA =
  "A collaborative tool that helps student teams turn a rough idea into a sprint-ready backlog.";

// ---------------------------------------------------------------------------
// Test 1 — renders all four fields with labels and defaults
// ---------------------------------------------------------------------------

describe("Test 1 · renders all inputs with labels and default values", () => {
  it("exposes all four controls by their visible label", () => {
    setup();
    const { idea, constraints, capacity, sprintLength } = fields();

    expect(idea).toBeInTheDocument();
    expect(constraints).toBeInTheDocument();
    expect(capacity).toBeInTheDocument();
    expect(sprintLength).toBeInTheDocument();
  });

  it("applies the schema defaults, not hard-coded numbers", () => {
    setup();
    const { idea, constraints, capacity, sprintLength } = fields();

    expect(idea).toHaveValue("");
    expect(constraints).toHaveValue("");
    expect(capacity).toHaveValue(DEFAULT_TEAM_CAPACITY_POINTS);
    expect(sprintLength).toHaveValue(DEFAULT_SPRINT_LENGTH_DAYS);
    // Guards against the defaults silently drifting from the API contract.
    expect(DEFAULT_TEAM_CAPACITY_POINTS).toBe(30);
    expect(DEFAULT_SPRINT_LENGTH_DAYS).toBe(14);
  });

  it("marks only the idea field as required", () => {
    setup();
    const { idea, constraints } = fields();

    expect(idea).toBeRequired();
    expect(idea).toHaveAttribute("aria-required", "true");
    expect(constraints).not.toBeRequired();
  });

  it("gives every control a helper description via aria-describedby", () => {
    setup();
    for (const control of Object.values(fields())) {
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      // Every referenced id must actually exist, or the association is a lie.
      for (const id of describedBy!.split(/\s+/)) {
        expect(document.getElementById(id)).not.toBeNull();
      }
    }
  });

  it("constrains the number inputs to the schema's range", () => {
    setup();
    const { capacity, sprintLength } = fields();

    expect(capacity).toHaveAttribute("min", "1");
    expect(capacity).toHaveAttribute("max", "500");
    expect(sprintLength).toHaveAttribute("min", "5");
    expect(sprintLength).toHaveAttribute("max", "30");
  });
});

// ---------------------------------------------------------------------------
// Test 2 — character counter
// ---------------------------------------------------------------------------

describe("Test 2 · character counter updates while typing", () => {
  it("counts up as the user types into the idea field", async () => {
    const { user } = setup();

    expect(screen.getByText(new RegExp(`^0/${MAX_IDEA_LENGTH}`))).toBeInTheDocument();

    await user.type(fields().idea, "Hello");

    expect(screen.getByText(new RegExp(`^5/${MAX_IDEA_LENGTH}`))).toBeInTheDocument();
  });

  it("shows how many more characters are needed while under the minimum", async () => {
    const { user } = setup();
    await user.type(fields().idea, "Too short");   // 9 characters

    expect(
      screen.getByText(new RegExp(`${MIN_IDEA_LENGTH - 9} more needed`))
    ).toBeInTheDocument();
  });

  it("drops the shortfall hint once the minimum is met", async () => {
    const { user } = setup();
    await user.type(fields().idea, VALID_IDEA);

    expect(screen.queryByText(/more needed/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`^${VALID_IDEA.length}/${MAX_IDEA_LENGTH}`))
    ).toBeInTheDocument();
  });

  it("counts the constraints field independently", async () => {
    const { user } = setup();
    await user.type(fields().constraints, "Team of 4");

    expect(
      screen.getByText(new RegExp(`^9/${MAX_CONSTRAINTS_LENGTH}$`))
    ).toBeInTheDocument();
  });

  it("does not put the counter in a live region", () => {
    setup();
    // Announcing every keystroke would flood a screen reader. The counter is
    // reachable via aria-describedby instead.
    const counter = screen.getByText(new RegExp(`^0/${MAX_IDEA_LENGTH}`));
    expect(counter.closest("[aria-live]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 3 — presets
// ---------------------------------------------------------------------------

describe("Test 3 · preset buttons populate every field", () => {
  it.each(STARTER_PRESETS.map((preset) => [preset.label, preset] as const))(
    "fills the form from the %s preset",
    async (_label, preset) => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: new RegExp(preset.label, "i") }));

      const { idea, constraints, capacity, sprintLength } = fields();
      expect(idea).toHaveValue(preset.idea);
      expect(constraints).toHaveValue(preset.constraints);
      expect(capacity).toHaveValue(preset.team_capacity_points);
      expect(sprintLength).toHaveValue(preset.sprint_length_days);
    }
  );

  it("renders one button per preset inside a labelled group", () => {
    setup();
    const group = screen.getByRole("group", { name: /start from an example/i });

    for (const preset of STARTER_PRESETS) {
      expect(
        within(group).getByRole("button", { name: new RegExp(preset.label, "i") })
      ).toBeInTheDocument();
    }
  });

  it("announces the applied preset politely", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /student capstone/i }));

    // The app renders two polite live regions: this form's own announcer and
    // the global toast viewport. Selecting by role alone now matches both, so
    // the form's is identified by the message it owns.
    const status = screen
      .getAllByRole("status")
      .find((node) => /preset applied/i.test(node.textContent ?? ""));
    expect(status).toBeDefined();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/student capstone preset applied/i);
  });

  it("produces a payload that passes validation", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: /developer tool/i }));
    await user.click(submitButton());

    // A preset that cannot be submitted is a broken preset.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });

  it("clears a previous error when a preset is applied", async () => {
    const { user } = setup();

    await user.type(fields().idea, "short");
    await user.click(submitButton());
    expect(screen.getByTestId("error-banner")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mobile mvp/i }));
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 4 — blocks submission below the minimum
// ---------------------------------------------------------------------------

describe("Test 4 · blocks submission when the idea is too short", () => {
  it("does not call onSubmit and shows the exact required message", async () => {
    const { user, onSubmit } = setup();

    await user.type(fields().idea, "Too short to plan");   // 17 characters
    await user.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(
        `Product idea must be at least ${MIN_IDEA_LENGTH} characters long.`
      ).length
    ).toBeGreaterThan(0);
  });

  it("renders the summary as a focused alert", async () => {
    const { user } = setup();

    await user.type(fields().idea, "nope");
    await user.click(submitButton());

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/1 problem with this form/i);
    // Focus moves to the summary, so a keyboard user is not left in silence.
    expect(banner).toHaveFocus();
  });

  it("rejects an empty submission with a required-field message", async () => {
    const { user, onSubmit } = setup();

    await user.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText(/product idea is required/i).length).toBeGreaterThan(0);
  });

  it("rejects out-of-range numbers and lists every problem at once", async () => {
    const { user, onSubmit } = setup();

    await user.clear(fields().capacity);
    await user.type(fields().capacity, "9999");
    await user.clear(fields().sprintLength);
    await user.type(fields().sprintLength, "1");
    await user.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    const banner = screen.getByTestId("error-banner");
    expect(banner).toHaveTextContent(/3 problems with this form/i);
    expect(banner).toHaveTextContent(/product idea/i);
    expect(banner).toHaveTextContent(/team capacity/i);
    expect(banner).toHaveTextContent(/sprint length/i);
  });

  it("counts whitespace-only input as empty rather than long enough", async () => {
    const { user, onSubmit } = setup();

    await user.type(fields().idea, " ".repeat(MIN_IDEA_LENGTH + 5));
    await user.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 5 — successful submission
// ---------------------------------------------------------------------------

describe("Test 5 · submits a valid payload", () => {
  it("calls onSubmit once with canonical field names", async () => {
    const { user, onSubmit } = setup();

    await user.type(fields().idea, VALID_IDEA);
    await user.type(fields().constraints, "Team of 4, 5 weeks");
    await user.clear(fields().capacity);
    await user.type(fields().capacity, "25");
    await user.clear(fields().sprintLength);
    await user.type(fields().sprintLength, "7");
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      idea: VALID_IDEA,
      constraints: "Team of 4, 5 weeks",
      team_capacity_points: 25,
      sprint_length_days: 7,
    });
  });

  it("omits constraints entirely when left blank", async () => {
    const { user, onSubmit } = setup();

    await user.type(fields().idea, VALID_IDEA);
    await user.click(submitButton());

    const payload = onSubmit.mock.calls[0][0];
    // Absent, not "" — the schema treats those differently.
    expect("constraints" in payload).toBe(false);
    expect(payload.team_capacity_points).toBe(DEFAULT_TEAM_CAPACITY_POINTS);
  });

  it("trims surrounding whitespace before submitting", async () => {
    const { user, onSubmit } = setup();

    await user.type(fields().idea, `   ${VALID_IDEA}   `);
    await user.click(submitButton());

    expect(onSubmit.mock.calls[0][0].idea).toBe(VALID_IDEA);
  });

  it("disables the form and marks it busy while loading", async () => {
    setup({ isLoading: true });

    const button = screen.getByRole("button", { name: /generating plan/i });
    // Busy, not disabled: a disabled control leaves the tab order mid-request
    // and tells a screen-reader user nothing about why. The inputs, unlike
    // the submit button, are still disabled while loading.
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
    for (const control of Object.values(fields())) {
      expect(control).toBeDisabled();
    }
  });

  it("builds the submit action from the Button primitive and keeps busy separate from disabled", async () => {
    const { user, onSubmit } = setup({ isLoading: true, initialValues: { idea: VALID_IDEA } });

    const submit = screen.getByRole("button", { name: /generating plan/i });
    // toHaveClass("button") would also pass on the old hand-rolled button:
    // identity-obj-proxy maps every CSS-module class to its own name, so
    // InputForm.module.css's .button also renders as class "button". The
    // variant class is what only the Button primitive can carry.
    expect(submit).toHaveClass("button", "primary");
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit).not.toBeDisabled();

    // Focusable and announced is not the same as actionable: a click still
    // must not fire the submit while busy, or the "not disabled" choice
    // above becomes a way to double-submit rather than just a11y polish.
    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit while loading", async () => {
    // A valid idea is required here: an empty field makes validateIntake
    // bail before onSubmit is ever reachable, which would pass this test
    // even if `busy` failed to suppress the click entirely.
    const { user, onSubmit } = setup({ isLoading: true, initialValues: { idea: VALID_IDEA } });

    await user.click(screen.getByRole("button", { name: /generating plan/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 6 — keyboard navigation and aria-invalid
// ---------------------------------------------------------------------------

describe("Test 6 · keyboard order and aria-invalid toggling", () => {
  it("reaches every control in visual order by Tab alone", async () => {
    const { user } = setup();
    const { idea, constraints, capacity, sprintLength } = fields();

    // Presets come first — they are the shortcut past the whole form.
    await user.tab();
    expect(
      screen.getByRole("button", { name: /student capstone/i })
    ).toHaveFocus();

    for (const expected of [idea, constraints, capacity, sprintLength]) {
      // Walk forward until the expected control has focus, bounded so a
      // regression fails instead of looping forever.
      let guard = 0;
      while (document.activeElement !== expected && guard < 12) {
        await user.tab();
        guard += 1;
      }
      expect(expected).toHaveFocus();
    }

    await user.tab();
    expect(submitButton()).toHaveFocus();
  });

  it("adds aria-invalid and aria-errormessage only once invalid", async () => {
    const { user } = setup();
    const idea = fields().idea;

    // Clean on first render: no accusation before the user has done anything.
    expect(idea).not.toHaveAttribute("aria-invalid");
    expect(idea).not.toHaveAttribute("aria-errormessage");

    await user.type(idea, "short");
    await user.tab();   // blur triggers validation

    expect(idea).toHaveAttribute("aria-invalid", "true");
    const errorId = idea.getAttribute("aria-errormessage");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent(
      `Product idea must be at least ${MIN_IDEA_LENGTH} characters long.`
    );
  });

  it("removes aria-invalid as soon as the field becomes valid", async () => {
    const { user } = setup();
    const idea = fields().idea;

    await user.type(idea, "short");
    await user.tab();
    expect(idea).toHaveAttribute("aria-invalid", "true");

    await user.click(idea);
    await user.type(idea, VALID_IDEA);

    expect(idea).not.toHaveAttribute("aria-invalid");
  });

  it("does not flag a field the user has not left yet", async () => {
    const { user } = setup();
    const idea = fields().idea;

    await user.type(idea, "s");

    // Still typing. Marking this invalid mid-word is technically true and
    // practically hostile.
    expect(idea).not.toHaveAttribute("aria-invalid");
  });

  it("lets the error summary link jump to the offending field", async () => {
    const { user } = setup();

    await user.type(fields().idea, "short");
    await user.click(submitButton());

    const link = within(screen.getByTestId("error-banner")).getByRole("link", {
      name: /product idea/i,
    });
    expect(link).toHaveAttribute("href", `#${fields().idea.id}`);
  });

  it("can be submitted from the keyboard without touching the mouse", async () => {
    const { user, onSubmit } = setup();

    await user.click(fields().idea);
    await user.keyboard(VALID_IDEA);
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 7 — initialValues prefill
// ---------------------------------------------------------------------------

describe("InputForm initialValues", () => {
  it("prefills every field from initialValues on first render", () => {
    renderWithProviders(
      <InputForm
        onSubmit={jest.fn()}
        initialValues={{
          idea: "A duplicate of an existing plan",
          constraints: "Team of two",
          team_capacity_points: "25",
          sprint_length_days: "7",
        }}
      />
    );

    expect(screen.getByLabelText(/product idea/i)).toHaveValue(
      "A duplicate of an existing plan"
    );
    expect(screen.getByLabelText(/constraints/i)).toHaveValue("Team of two");
  });

  it("falls back to the empty defaults when initialValues is omitted", () => {
    renderWithProviders(<InputForm onSubmit={jest.fn()} />);

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("");
  });

  it("fills in missing fields from the defaults when initialValues is only partial", () => {
    // initialValues is `Partial<IntakeFormValues>` — a real caller (a
    // duplicate-plan payload read back from sessionStorage) may be missing
    // fields entirely, not just have them empty.
    renderWithProviders(
      <InputForm onSubmit={jest.fn()} initialValues={{ idea: "Only the idea is set" }} />
    );

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("Only the idea is set");
    expect(screen.getByLabelText(/team capacity/i)).toHaveValue(DEFAULT_TEAM_CAPACITY_POINTS);
    expect(screen.getByLabelText(/sprint length/i)).toHaveValue(DEFAULT_SPRINT_LENGTH_DAYS);
  });
});

// ---------------------------------------------------------------------------
// The validation rules on their own, with no DOM in the way.
// ---------------------------------------------------------------------------

describe("Test 8 · Field primitive wiring", () => {
  it("keeps the character counter in the idea field's description", () => {
    setup();

    const idea = screen.getByLabelText(/product idea/i);
    const describedBy = (idea.getAttribute("aria-describedby") ?? "").split(" ");
    const counter = describedBy.map((x) => document.getElementById(x)).find(Boolean);

    // The counter must be reachable by description, not announced live — see
    // the decision recorded at the top of InputForm.tsx.
    expect(describedBy.length).toBeGreaterThanOrEqual(2);
    expect(counter).not.toBeNull();
    expect(
      describedBy.some((x) => document.getElementById(x)?.textContent?.match(/\d+\s*\/\s*\d+/))
    ).toBe(true);
  });

  it("marks the idea field required through the primitive", () => {
    setup();

    expect(screen.getByLabelText(/product idea/i)).toHaveAttribute("aria-required", "true");
  });

  it("gives every field a label that is attached, not merely adjacent", () => {
    setup();

    // getByLabelText resolves through htmlFor/id, so it fails on a label that
    // only looks attached.
    for (const re of [/product idea/i, /constraints/i, /capacity/i, /sprint length/i]) {
      expect(screen.getByLabelText(re)).toBeInTheDocument();
    }
  });
});

describe("validateIntake", () => {
  const valid = {
    idea: VALID_IDEA,
    constraints: "",
    team_capacity_points: "30",
    sprint_length_days: "14",
  };

  it("accepts a valid form", () => {
    expect(validateIntake(valid)).toEqual({});
  });

  it("accepts an idea of exactly the minimum length", () => {
    expect(validateIntake({ ...valid, idea: "a".repeat(MIN_IDEA_LENGTH) }).idea)
      .toBeUndefined();
  });

  it("rejects one character below the minimum", () => {
    expect(validateIntake({ ...valid, idea: "a".repeat(MIN_IDEA_LENGTH - 1) }).idea)
      .toBe(`Product idea must be at least ${MIN_IDEA_LENGTH} characters long.`);
  });

  it("rejects a non-integer capacity", () => {
    expect(validateIntake({ ...valid, team_capacity_points: "7.5" }).team_capacity_points)
      .toMatch(/whole number/i);
  });

  it("rejects an empty number field", () => {
    expect(validateIntake({ ...valid, sprint_length_days: "" }).sprint_length_days)
      .toMatch(/whole number/i);
  });
});

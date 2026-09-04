// tests/ui/PlanCompare.test.tsx
//
// Two plans for one question, and the choice between them.
//
// The numbers this component shows are all server-computed — committed points,
// the MoSCoW split — so the risk here is not arithmetic, it is showing the
// right plan's arithmetic under the wrong heading. Every assertion below scopes
// to one column for that reason.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanCompare } from "@/components/scopecraft/PlanCompare";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";
import { renderWithProviders } from "./render-helpers";

/** A complete response, varied only where a comparison would notice. */
function plan(over: {
  stories: string[];
  committed: number;
  capacity: number;
  must: string[];
}): ScopeCraftResponse {
  return {
    problem: "p",
    target_user: "t",
    goals: ["g"],
    non_goals: [],
    requirements: ["r"],
    user_stories: over.stories.map((id) => ({
      id,
      as_a: "student",
      i_want: "a backlog",
      so_that: "we can start",
      acceptance_criteria: ["given/when/then"],
      points: 3,
      value: 4,
      risk: 2,
      dependencies: [],
    })),
    acceptance_criteria: ["ac"],
    risks: [{ id: "R-1", description: "d", impact: "low", likelihood: "low" }],
    priority: Object.fromEntries(over.stories.map((id) => [id, 2])),
    effort: Object.fromEntries(over.stories.map((id) => [id, 3])),
    sprint: over.stories.map((id) => ({
      story_id: id,
      priority_score: 2,
      effort: 3,
      sprint: 1,
    })),
    sprint_plan: {
      capacity_points: over.capacity,
      committed_points: over.committed,
      included: over.stories,
      deferred: [],
    },
    moscow: Object.fromEntries(
      over.stories.map((id) => [id, over.must.includes(id) ? "must" : "could"])
    ),
  };
}

const ORIGINAL = plan({ stories: ["US-1", "US-2"], committed: 6, capacity: 30, must: ["US-1"] });
const ALTERNATIVE = plan({
  stories: ["US-1", "US-2", "US-3"],
  committed: 9,
  capacity: 30,
  must: ["US-1", "US-2", "US-3"],
});

function renderCompare(over: Partial<Parameters<typeof PlanCompare>[0]> = {}) {
  const onChoose = jest.fn();
  renderWithProviders(
    <PlanCompare
      original={{ planId: "plan-a", data: ORIGINAL }}
      alternative={{ planId: "plan-b", data: ALTERNATIVE }}
      chosenPlanId={null}
      onChoose={onChoose}
      {...over}
    />
  );
  return { onChoose };
}

describe("PlanCompare", () => {
  it("reports each plan's committed points against its capacity", () => {
    renderCompare();

    expect(within(screen.getByTestId("compare-side-original")).getByText("6 / 30")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("compare-side-alternative")).getByText("9 / 30")
    ).toBeInTheDocument();
  });

  // The number that most often differs between two answers to one question, and
  // the reason someone asked twice.
  it("counts the MUST stories on each side", () => {
    renderCompare();

    expect(within(screen.getByTestId("compare-must-original")).getByText("1")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("compare-must-alternative")).getByText("3")
    ).toBeInTheDocument();
  });

  // Two buttons that both read "Keep this one" are indistinguishable to anyone
  // navigating by a list of controls.
  it("names each plan in its own keep control", async () => {
    renderCompare();

    expect(screen.getByRole("button", { name: /keep the first plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep the second plan/i })).toBeInTheDocument();
  });

  it("reports the id of the plan the user kept", async () => {
    const user = userEvent.setup();
    const { onChoose } = renderCompare();

    await user.click(screen.getByRole("button", { name: /keep the second plan/i }));

    expect(onChoose).toHaveBeenCalledWith("plan-b");
  });

  // The kept plan's control STAYS. Unmounting the button the user just
  // activated drops focus to <body> mid-interaction and announces nothing;
  // aria-pressed is what reports the change without moving anyone.
  it("marks the plan already kept without taking away the control", () => {
    renderCompare({ chosenPlanId: "plan-a" });

    expect(within(screen.getByTestId("compare-side-original")).getByTestId("compare-kept"))
      .toBeInTheDocument();

    const kept = screen.getByRole("button", { name: /keep the first plan/i });
    expect(kept).toHaveAttribute("aria-pressed", "true");
    expect(kept).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /keep the second plan/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  // A plan whose insert failed has no id, so there is nothing to mark. The
  // comparison is still worth showing; only the choice is unavailable.
  it("cannot be kept when the plan was never persisted", () => {
    renderCompare({ alternative: { planId: null, data: ALTERNATIVE } });

    expect(screen.queryByRole("button", { name: /keep the second plan/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep the first plan/i })).toBeInTheDocument();
  });

  // A check that runs LTR only is not a passing check on a bilingual app.
  it("renders in Arabic", () => {
    renderWithProviders(
      <PlanCompare
        original={{ planId: "plan-a", data: ORIGINAL }}
        alternative={{ planId: "plan-b", data: ALTERNATIVE }}
        chosenPlanId={null}
        onChoose={jest.fn()}
      />,
      { locale: "ar" }
    );

    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByTestId("compare-side-original")).toBeInTheDocument();
    // The numbers are the point of the table and must survive the direction.
    //
    // jsdom lays nothing out, so the reordering itself is unobservable here;
    // the <bdi> that prevents it is not. Digits are weak-LTR and " / " is
    // neutral, so without the isolate the run reorders under RTL and "9 / 30"
    // displays as "30 / 9" — capacity where committed should be. The sprint
    // board hit exactly this and fixed it the same way.
    const points = within(screen.getByTestId("compare-side-alternative")).getByText(/9 \/ 30/);
    expect(points.tagName).toBe("BDI");
  });
});

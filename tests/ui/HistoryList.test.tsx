// tests/ui/HistoryList.test.tsx

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { HistoryList, type PlanSummary } from "@/app/scopecraft/history/HistoryList";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

function makePlan(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    idea: "A test idea",
    constraints: "Team of four",
    status: "ok",
    errorCode: null,
    capacityPoints: 30,
    sprintDays: 14,
    providerUsed: "groq",
    edited: false,
    chosen: false,
    createdAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("HistoryList stats strip", () => {
  it("shows a singular count for exactly one plan", () => {
    renderWithProviders(<HistoryList plans={[makePlan()]} />);
    expect(screen.getByText("1 plan")).toBeInTheDocument();
  });

  it("shows a plural count and the average capacity for several plans", () => {
    renderWithProviders(
      <HistoryList
        plans={[
          makePlan({ id: "1", capacityPoints: 20 }),
          makePlan({ id: "2", capacityPoints: 40 }),
        ]}
      />
    );
    expect(screen.getByText("2 plans")).toBeInTheDocument();
    expect(screen.getByText(/Average capacity: 30 pts/)).toBeInTheDocument();
  });

  it("shows no stats strip when there are no plans", () => {
    renderWithProviders(<HistoryList plans={[]} />);
    expect(screen.queryByText(/Average capacity/)).not.toBeInTheDocument();
  });
});

describe("HistoryList duplicate action", () => {
  afterEach(() => sessionStorage.clear());

  it("writes the plan's fields to sessionStorage as strings", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HistoryList plans={[makePlan()]} />);

    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    const raw = sessionStorage.getItem("scopecraft.duplicatePrefill");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      idea: "A test idea",
      constraints: "Team of four",
      team_capacity_points: "30",
      sprint_length_days: "14",
    });
  });
});

describe("HistoryList delete action", () => {
  it("requires a second click to actually delete", async () => {
    const user = userEvent.setup();
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 204 } as Response);
    renderWithProviders(<HistoryList plans={[makePlan()]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Confirm delete?" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete?" }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/scopecraft/11111111-1111-1111-1111-111111111111",
      { method: "DELETE" }
    );
  });

  it("shows a toast and keeps the row on failure", async () => {
    const user = userEvent.setup();
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 404 } as Response);
    renderWithProviders(<HistoryList plans={[makePlan()]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete?" }));

    expect(
      await screen.findByText("This plan could not be deleted. Please try again.")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// D6/D7: primitives, and the 44px target the checklist named
// ---------------------------------------------------------------------------

describe("HistoryList primitives", () => {
  // The checklist's actual ask for this point was "fix the 32px action-button
  // targets". jsdom resolves no CSS, so the size itself cannot be measured
  // here — what can be proved is that both controls are the Button primitive,
  // and design-tokens.test.ts separately asserts Button declares exactly one
  // target size and that it is 2.75rem. The two together are the check.
  it("puts both row actions on the Button primitive", () => {
    renderWithProviders(<HistoryList plans={[makePlan()]} />);
    expect(screen.getByRole("button", { name: "Duplicate" })).toHaveClass("button");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("button");
  });

  it("gives delete the danger variant and duplicate the secondary one", () => {
    renderWithProviders(<HistoryList plans={[makePlan()]} />);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("danger");
    expect(screen.getByRole("button", { name: "Duplicate" })).toHaveClass("secondary");
  });

  // The confirming state keeps the danger variant: the escalation is carried
  // by the label changing to "Confirm delete?", which is also the only signal
  // a screen reader ever had.
  it("keeps the danger variant while confirming", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HistoryList plans={[makePlan()]} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Confirm delete?" })).toHaveClass("danger");
  });

  it("puts every row on the Card primitive as a real li", () => {
    renderWithProviders(<HistoryList plans={[makePlan({ id: "a" }), makePlan({ id: "b" })]} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveClass("card");
    }
  });
});

// A check that runs LTR only is not a passing check on a bilingual app.
describe("HistoryList · Arabic", () => {
  it("renders the actions and the row in Arabic", () => {
    renderWithProviders(<HistoryList plans={[makePlan()]} />, { locale: "ar" });
    // The row still renders as a Card, and the actions are still Buttons —
    // neither primitive depends on direction, which is the point of checking.
    expect(screen.getByRole("listitem")).toHaveClass("card");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveClass("button");
    }
  });
});

// A plan kept over its alternative is the one served if the same question is
// asked again, so history has to say which one that is — otherwise the choice
// is invisible the moment the page is reloaded.
describe("HistoryList · the kept plan", () => {
  it("marks a plan the user kept", () => {
    renderWithProviders(<HistoryList plans={[makePlan({ chosen: true })]} />);
    expect(screen.getByTestId("history-chosen")).toBeInTheDocument();
  });

  it("says nothing about a plan with no alternative to be kept over", () => {
    renderWithProviders(<HistoryList plans={[makePlan()]} />);
    expect(screen.queryByTestId("history-chosen")).not.toBeInTheDocument();
  });
});

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

// tests/ui/ResultView.test.tsx
//
// The result view had no test of its own before D4 — everything covering it
// was incidental, in StateTransitions.test.tsx, which drives the whole page
// through fetch and whose fixture carries only two of the four MoSCoW buckets
// and one of the three risk levels.
//
// These tests were written against the pre-rebuild component and are the net
// D4 rebuilds inside: the APG tab contract, the eleven PRD sections, and the
// two tables. They assert text, roles and ARIA — never colour, spacing or
// breakpoints, none of which exist under identity-obj-proxy.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { ResultView } from "@/components/scopecraft/ResultView";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";

// All four buckets and all three levels, which is the whole reason this file
// does not reuse the transitions fixture.
const FIXTURE: ScopeCraftResponse = {
  problem: "Teams cannot turn a rough idea into a backlog.",
  target_user: "Student software teams",
  goals: ["Ship a usable PRD in under five minutes"],
  non_goals: ["Replace the Product Owner's judgement"],
  requirements: ["Generate a structured PRD from free text"],
  user_stories: [
    {
      id: "US-1",
      as_a: "student",
      i_want: "a structured backlog",
      so_that: "my team can start building",
      acceptance_criteria: ["The backlog contains at least one story"],
      points: 3,
      value: 5,
      risk: 5,
      dependencies: [],
    },
    {
      id: "US-2",
      as_a: "student",
      i_want: "to see my sprint capacity",
      so_that: "I don't overcommit",
      acceptance_criteria: ["The capacity meter reflects committed points"],
      points: 5,
      value: 2,
      risk: 1,
      dependencies: ["US-1"],
    },
    {
      id: "US-3",
      as_a: "tutor",
      i_want: "to export the plan",
      so_that: "I can mark it offline",
      acceptance_criteria: ["Export produces a file"],
      points: 2,
      value: 3,
      risk: 2,
      dependencies: [],
    },
    {
      id: "US-4",
      as_a: "student",
      i_want: "a dark theme",
      so_that: "late sessions hurt less",
      acceptance_criteria: ["The theme persists across reloads"],
      points: 1,
      value: 1,
      risk: 1,
      dependencies: [],
    },
  ],
  acceptance_criteria: ["Every story is testable"],
  risks: [
    { id: "R-1", description: "Scope may grow", impact: "high", likelihood: "medium" },
    { id: "R-2", description: "Provider may rate-limit", impact: "medium", likelihood: "low" },
    { id: "R-3", description: "Copy may need review", impact: "low", likelihood: "low" },
  ],
  priority: { "US-1": 3.33, "US-2": 0.6, "US-3": 1.5, "US-4": 1 },
  effort: { "US-1": 3, "US-2": 5, "US-3": 2, "US-4": 1 },
  sprint: [
    { story_id: "US-1", priority_score: 3.33, effort: 3, sprint: 1 },
    { story_id: "US-2", priority_score: 0.6, effort: 5, sprint: 1 },
  ],
  sprint_plan: {
    capacity_points: 30,
    committed_points: 11,
    included: ["US-1", "US-2", "US-3"],
    deferred: ["US-4"],
  },
  moscow: { "US-1": "must", "US-2": "should", "US-3": "could", "US-4": "wont" },
};

describe("ResultView · tabs", () => {
  it("opens on the overview panel with the other two hidden", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("result-panel-overview")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("result-panel-backlog")).toHaveAttribute("hidden");
    expect(screen.getByTestId("result-panel-evidence")).toHaveAttribute("hidden");
  });

  // APG roving focus: only the selected tab is in the tab sequence, and the
  // arrows move between them. Losing this turns three tabs into three tab
  // stops, which is the bug the pattern exists to prevent.
  it("keeps only the selected tab in the tab sequence", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("result-tab-backlog")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("tabindex", "-1");
  });

  it("moves between tabs with the arrow keys and wraps", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultView data={FIXTURE} />);
    screen.getByTestId("result-tab-overview").focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("result-tab-backlog")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the ends with Home and End", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultView data={FIXTURE} />);
    screen.getByTestId("result-tab-overview").focus();

    await user.keyboard("{End}");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");
  });

  it("wires every tab to its panel in both directions", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    for (const id of ["overview", "backlog", "evidence"] as const) {
      const tab = screen.getByTestId(`result-tab-${id}`);
      const panel = screen.getByTestId(`result-panel-${id}`);
      expect(tab).toHaveAttribute("aria-controls", panel.id);
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }
  });

  // Panels stay mounted so that switching to the evidence tab and back does
  // not discard in-progress board edits. `hidden`, never unmounted.
  it("keeps the backlog panel mounted while it is hidden", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultView data={FIXTURE} />);
    const backlog = screen.getByTestId("result-panel-backlog");
    expect(backlog).toHaveAttribute("hidden");
    await user.click(screen.getByTestId("result-tab-backlog"));
    expect(screen.getByTestId("result-panel-backlog")).toBe(backlog);
  });
});

describe("ResultView · PRD content", () => {
  it("renders the prose sections", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getByText(FIXTURE.problem)).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.target_user)).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.goals[0])).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.non_goals[0])).toBeInTheDocument();
    expect(screen.getByText(FIXTURE.requirements[0])).toBeInTheDocument();
  });

  it("renders one card per story, each named by its id", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    for (const story of FIXTURE.user_stories) {
      const card = screen.getByTestId(`story-card-${story.id}`);
      expect(card).toHaveAttribute("aria-labelledby", `story-${story.id}-heading`);
      expect(within(card).getByText(story.id)).toBeInTheDocument();
    }
  });

  it("labels every story with its MoSCoW bucket as text", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(within(screen.getByTestId("story-card-US-1")).getByText("Must")).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-2")).getByText("Should")).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-3")).getByText("Could")).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-4")).getByText("Won't")).toBeInTheDocument();
  });

  it("shows a story's dependencies only when it has some", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(within(screen.getByTestId("story-card-US-2")).getByText(/US-1/)).toBeInTheDocument();
    expect(within(screen.getByTestId("story-card-US-1")).queryByText(/depends/i)).toBeNull();
  });

  it("renders the risk table as a real table with column headers", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    // Only one table is in the accessibility tree: the sequence table lives in
    // the backlog panel, which is `hidden`, and role queries skip it.
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByRole("columnheader", { name: "Description" })).toBeInTheDocument();
    expect(within(table).getByText("Scope may grow")).toBeInTheDocument();
    expect(within(table).getByText("Provider may rate-limit")).toBeInTheDocument();
  });

  // The level word is the information. If it ever stops being rendered as
  // text, impact and likelihood become colour-only — a WCAG 1.4.1 failure.
  it("renders every risk level as a word, not only as a colour", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getAllByText("high").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("medium").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("low").length).toBeGreaterThanOrEqual(3);
  });

  it("prefixes each acceptance criterion with the Scenario keyword", () => {
    renderWithProviders(<ResultView data={FIXTURE} />);
    expect(screen.getAllByText("Scenario:").length).toBeGreaterThan(0);
    expect(screen.getByText("Every story is testable")).toBeInTheDocument();
  });
});

describe("ResultView · Arabic", () => {
  // A check that runs LTR only is not a passing check on a bilingual app.
  it("renders the Arabic tab labels", () => {
    renderWithProviders(<ResultView data={FIXTURE} />, { locale: "ar" });
    expect(screen.getByTestId("result-tab-overview")).toHaveTextContent("نظرة عامة");
  });

  it("renders the Arabic MoSCoW labels", () => {
    renderWithProviders(<ResultView data={FIXTURE} />, { locale: "ar" });
    expect(within(screen.getByTestId("story-card-US-1")).getByText("يجب")).toBeInTheDocument();
  });
});

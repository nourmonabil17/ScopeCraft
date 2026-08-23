// tests/ui/InteractiveBoard.test.tsx
//
// Interactive sprint backlog: the pure recompute functions in
// src/lib/scopecraft/client-recalc.ts (no rendering) plus the
// InteractiveSprintBoard component itself — toggling, editing, capacity math,
// and keyboard operability (owner: Joe).

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  recalcCapacity,
  recalcScore,
  setPoints,
  toggleColumn,
  type BoardStory,
} from "@/lib/scopecraft/client-recalc";
import { InteractiveSprintBoard, type BoardSnapshot } from "@/components/scopecraft/InteractiveSprintBoard";
import type { MoscowBucket, SprintPlanResult, UserStory } from "@/lib/scopecraft/schema";

// ---------------------------------------------------------------------------
// client-recalc.ts — pure functions, no DOM involved
// ---------------------------------------------------------------------------

function story(overrides: Partial<BoardStory>): BoardStory {
  return {
    storyId: "US-1",
    asA: "user",
    iWant: "a thing",
    soThat: "a reason",
    value: 3,
    risk: 3,
    points: 5,
    dependencies: [],
    column: "included",
    ...overrides,
  };
}

describe("client-recalc · recalcCapacity", () => {
  it("sums only the included column", () => {
    const stories = [
      story({ storyId: "US-1", points: 5, column: "included" }),
      story({ storyId: "US-2", points: 8, column: "included" }),
      story({ storyId: "US-3", points: 13, column: "deferred" }),
    ];
    expect(recalcCapacity(stories, 30).committedPoints).toBe(13);
  });

  it("reports ok well under capacity", () => {
    const summary = recalcCapacity([story({ points: 5 })], 30);
    expect(summary.state).toBe("ok");
    expect(summary.remainingPoints).toBe(25);
  });

  it("reports warning at or above 90% utilization but not over", () => {
    const summary = recalcCapacity([story({ points: 27 })], 30);
    expect(summary.utilization).toBeCloseTo(0.9);
    expect(summary.state).toBe("warning");
  });

  it("reports over exactly when committed exceeds capacity", () => {
    const atCapacity = recalcCapacity([story({ points: 30 })], 30);
    expect(atCapacity.state).not.toBe("over");

    const overCapacity = recalcCapacity([story({ points: 31 })], 30);
    expect(overCapacity.state).toBe("over");
    expect(overCapacity.remainingPoints).toBe(-1);
  });
});

describe("client-recalc · recalcScore", () => {
  it("matches the deterministic (value + risk) / effort formula", () => {
    const result = recalcScore({ value: 4, risk: 4, points: 2 });
    expect(result).toEqual({ score: 4, moscow: "must" });
  });

  it("returns null for an out-of-range or mid-edit value rather than throwing", () => {
    expect(recalcScore({ value: 4, risk: 4, points: 0 })).toBeNull();
    expect(recalcScore({ value: 6, risk: 4, points: 5 })).toBeNull();
    expect(recalcScore({ value: NaN, risk: 4, points: 5 })).toBeNull();
  });

  it("classifies into all four MoSCoW bands at the documented cutoffs", () => {
    expect(recalcScore({ value: 5, risk: 5, points: 1 })!.moscow).toBe("must"); // 10
    expect(recalcScore({ value: 3, risk: 3, points: 4 })!.moscow).toBe("should"); // 1.5
    expect(recalcScore({ value: 2, risk: 2, points: 5 })!.moscow).toBe("could"); // 0.8
    expect(recalcScore({ value: 1, risk: 1, points: 13 })!.moscow).toBe("wont"); // 0.15
  });
});

describe("client-recalc · toggleColumn / setPoints", () => {
  it("flips only the targeted story's column", () => {
    const stories = [story({ storyId: "US-1", column: "included" }), story({ storyId: "US-2", column: "deferred" })];
    const next = toggleColumn(stories, "US-1");
    expect(next.find((s) => s.storyId === "US-1")!.column).toBe("deferred");
    expect(next.find((s) => s.storyId === "US-2")!.column).toBe("deferred");
    // Original array is untouched — React state must never be mutated in place.
    expect(stories[0].column).toBe("included");
  });

  it("replaces only the targeted story's points", () => {
    const stories = [story({ storyId: "US-1", points: 5 })];
    const next = setPoints(stories, "US-1", 8);
    expect(next[0].points).toBe(8);
    expect(stories[0].points).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// <InteractiveSprintBoard> — rendered, interactive
// ---------------------------------------------------------------------------

const STORIES: UserStory[] = [
  {
    id: "US-1",
    as_a: "student",
    i_want: "a scoped plan",
    so_that: "I can start delivery",
    acceptance_criteria: ["The plan is structured"],
    points: 5,
    value: 5,
    risk: 5,
    dependencies: [],
  },
  {
    id: "US-2",
    as_a: "student",
    i_want: "a prioritized backlog",
    so_that: "I can plan delivery",
    acceptance_criteria: ["Stories have deterministic scores"],
    points: 8,
    value: 2,
    risk: 1,
    dependencies: [],
  },
  {
    id: "US-3",
    as_a: "student",
    i_want: "dependency awareness",
    so_that: "sequencing is correct",
    acceptance_criteria: ["Dependencies are visible"],
    points: 3,
    value: 3,
    risk: 3,
    dependencies: ["US-1"],
  },
];

const PRIORITY: Record<string, number> = { "US-1": 2, "US-2": 0.375, "US-3": 2 };
const MOSCOW: Record<string, MoscowBucket> = { "US-1": "should", "US-2": "wont", "US-3": "should" };
const SPRINT_PLAN: SprintPlanResult = {
  capacity_points: 20,
  committed_points: 8, // US-1 (5) + US-3 (3) — matches actual story points
  included: ["US-1", "US-3"],
  deferred: ["US-2"],
};

/** For the over-capacity test: a small enough ceiling that moving one story
 *  in is guaranteed to exceed it, rather than relying on fragile arithmetic
 *  against the shared 20-point fixture above. */
const TIGHT_SPRINT_PLAN: SprintPlanResult = {
  capacity_points: 10,
  committed_points: 5,
  included: ["US-1"],
  deferred: ["US-2", "US-3"],
};

function setup(
  onBoardChange?: (snapshot: BoardSnapshot) => void,
  sprintPlan: SprintPlanResult = SPRINT_PLAN
) {
  const user = userEvent.setup();
  render(
    <InteractiveSprintBoard
      stories={STORIES}
      priority={PRIORITY}
      moscow={MOSCOW}
      sprintPlan={sprintPlan}
      onBoardChange={onBoardChange}
    />
  );
  return { user };
}

/** The committed/capacity text is three separate JSX text nodes
 *  ("{n}", " / ", "{n} points"), so a plain getByText(exact string) never
 *  matches — this reads the container's combined textContent instead. */
function meterText(): string {
  return screen.getByTestId("capacity-meter-numbers").textContent ?? "";
}

describe("InteractiveSprintBoard · initial layout", () => {
  it("seeds each column from sprint_plan.included / deferred", () => {
    setup();
    const included = screen.getByRole("group", { name: /sprint capacity/i });
    expect(included).toBeInTheDocument();

    const committedColumn = screen.getByRole("heading", { name: /committed to sprint 1/i }).closest("section")!;
    expect(within(committedColumn).getByTestId("board-card-US-1")).toBeInTheDocument();
    expect(within(committedColumn).getByTestId("board-card-US-3")).toBeInTheDocument();
    expect(within(committedColumn).queryByTestId("board-card-US-2")).not.toBeInTheDocument();

    const deferredColumn = screen.getByRole("heading", { name: /deferred backlog/i }).closest("section")!;
    expect(within(deferredColumn).getByTestId("board-card-US-2")).toBeInTheDocument();
  });

  it("shows the capacity meter with the correct starting numbers", () => {
    setup();
    expect(meterText()).toBe("8 / 20 points");
  });
});

describe("InteractiveSprintBoard · toggling", () => {
  it("moves a story to the deferred column on click and updates capacity", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /move us-1 to the deferred backlog/i }));

    const deferredColumn = screen.getByRole("heading", { name: /deferred backlog/i }).closest("section")!;
    expect(within(deferredColumn).getByTestId("board-card-US-1")).toBeInTheDocument();
    expect(meterText()).toBe("3 / 20 points"); // 8 - 5 (US-1)
  });

  it("moves a story back to committed and re-sums capacity", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /move us-2 to sprint 1/i }));

    const committedColumn = screen.getByRole("heading", { name: /committed to sprint 1/i }).closest("section")!;
    expect(within(committedColumn).getByTestId("board-card-US-2")).toBeInTheDocument();
    expect(meterText()).toBe("16 / 20 points"); // 8 + 8 (US-2)
  });

  it("is operable with Enter and Space alone, no click required", async () => {
    const { user } = setup();

    // Tab from the document body through the capacity meter (not focusable)
    // to the first interactive element on the board: US-1's points input,
    // then its toggle button.
    await user.tab(); // points input for US-1
    await user.tab(); // toggle button for US-1
    expect(screen.getByRole("button", { name: /move us-1 to the deferred backlog/i })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: /move us-1 to sprint 1/i })
    ).toBeInTheDocument();

    await user.keyboard(" ");
    expect(
      screen.getByRole("button", { name: /move us-1 to the deferred backlog/i })
    ).toBeInTheDocument();
  });

  it("warns when a deferred story still depends on something no longer committed", async () => {
    const { user } = setup();

    // US-3 depends on US-1. Defer US-1 first, then look at US-3's card.
    await user.click(screen.getByRole("button", { name: /move us-1 to the deferred backlog/i }));

    const card = screen.getByTestId("board-card-US-3");
    expect(within(card).getByText(/depends on us-1, which is in the deferred backlog/i)).toBeInTheDocument();
  });
});

describe("InteractiveSprintBoard · editing points", () => {
  it("recomputes the capacity meter as points change", async () => {
    const { user } = setup();
    const input = screen.getByLabelText(/story points for us-1/i);

    await user.clear(input);
    await user.type(input, "10");

    expect(meterText()).toBe("13 / 20 points"); // 10 (edited US-1) + 3 (US-3)
  });

  it("recomputes the story's own score and MoSCoW badge", async () => {
    const { user } = setup();
    const card = screen.getByTestId("board-card-US-2");
    const input = within(card).getByLabelText(/story points for us-2/i);

    // US-2: value 2, risk 1. At points 8 -> score 0.375 -> wont (seeded).
    // Dropping to 1 point -> score 3.0 -> must.
    await user.clear(input);
    await user.type(input, "1");

    expect(within(card).getByTestId("board-badge-US-2")).toHaveTextContent(/must/i);
    expect(within(card).getByText("Score 3.00")).toBeInTheDocument();
  });
});

describe("InteractiveSprintBoard · over-capacity warning", () => {
  it("flags over capacity in both the caption and the live announcement", async () => {
    // capacity 10, US-1 (5) already included; moving US-2 (8) in makes 13 > 10.
    const { user } = setup(undefined, TIGHT_SPRINT_PLAN);

    await user.click(screen.getByRole("button", { name: /move us-2 to sprint 1/i }));

    expect(meterText()).toBe("13 / 10 points");
    expect(screen.getByText(/points over capacity/i)).toBeInTheDocument();
    const status = screen.getByRole("status", { name: "" });
    expect(status).toHaveTextContent(/over capacity/i);
  });
});

describe("InteractiveSprintBoard · reports state upward", () => {
  it("calls onBoardChange with the current stories, scores, and capacity", async () => {
    const onBoardChange = jest.fn();
    const { user } = setup(onBoardChange);

    onBoardChange.mockClear();
    await user.click(screen.getByRole("button", { name: /move us-1 to the deferred backlog/i }));

    expect(onBoardChange).toHaveBeenCalled();
    const snapshot: BoardSnapshot = onBoardChange.mock.calls.at(-1)![0];
    expect(snapshot.stories.find((s) => s.storyId === "US-1")!.column).toBe("deferred");
    expect(snapshot.capacity.committedPoints).toBe(3); // US-3 only: 8 - 5 (US-1)
  });
});

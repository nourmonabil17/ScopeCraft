import { priorityScore, planSprint } from "@/lib/scopecraft/tools";

describe("priorityScore", () => {
  it("computes (value + risk) / effort", () => {
    expect(priorityScore({ storyId: "US-1", value: 8, risk: 6, effort: 2 })).toBe(7);
  });

  it("throws when effort is 0", () => {
    expect(() => priorityScore({ storyId: "US-1", value: 8, risk: 6, effort: 0 })).toThrow();
  });
});

describe("planSprint", () => {
  it("fills sprints up to capacity before moving to the next", () => {
    const plan = planSprint({
      capacityPerSprint: 5,
      stories: [
        { storyId: "US-1", value: 9, risk: 8, effort: 3 },
        { storyId: "US-2", value: 5, risk: 3, effort: 3 },
        { storyId: "US-3", value: 2, risk: 2, effort: 2 },
      ],
    });
    expect(plan.find((p) => p.story_id === "US-1")?.sprint).toBe(1);
    expect(plan.length).toBe(3);
  });
});

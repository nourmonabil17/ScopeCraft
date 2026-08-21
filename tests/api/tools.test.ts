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

  it("rejects out-of-range or non-integer planning inputs", () => {
    expect(() =>
      priorityScore({ storyId: "US-1", value: 11, risk: 5, effort: 2 })
    ).toThrow("value must be an integer from 1 to 10");
    expect(() =>
      priorityScore({ storyId: "US-1", value: 5, risk: 0, effort: 2 })
    ).toThrow("risk must be an integer from 1 to 10");
    expect(() =>
      priorityScore({ storyId: "US-1", value: 5, risk: 5, effort: 1.5 })
    ).toThrow("effort must be an integer");
  });

  it("rejects a story larger than the total sprint capacity", () => {
    expect(() =>
      planSprint({
        capacityPerSprint: 5,
        stories: [{ storyId: "US-1", value: 9, risk: 8, effort: 6 }],
      })
    ).toThrow("story US-1 effort exceeds sprint capacity");
  });

  it("plans dependencies before higher-priority dependent stories", () => {
    const plan = planSprint({
      capacityPerSprint: 10,
      stories: [
        {
          storyId: "US-2",
          value: 10,
          risk: 10,
          effort: 1,
          dependencies: ["US-1"],
        },
        { storyId: "US-1", value: 2, risk: 2, effort: 2 },
      ],
    });

    expect(plan.map((story) => story.story_id)).toEqual(["US-1", "US-2"]);
  });

  it("rejects a dependency that does not exist", () => {
    expect(() =>
      planSprint({
        capacityPerSprint: 10,
        stories: [{
          storyId: "US-2",
          value: 8,
          risk: 6,
          effort: 2,
          dependencies: ["US-404"],
        }],
      })
    ).toThrow("story US-2 has missing dependency US-404");
  });

  it("rejects circular dependencies", () => {
    expect(() =>
      planSprint({
        capacityPerSprint: 10,
        stories: [
          {
            storyId: "US-1",
            value: 8,
            risk: 6,
            effort: 2,
            dependencies: ["US-2"],
          },
          {
            storyId: "US-2",
            value: 7,
            risk: 5,
            effort: 2,
            dependencies: ["US-1"],
          },
        ],
      })
    ).toThrow("story dependencies contain a cycle");
  });
});

import { priorityScore, planSprint, scheduleSprints } from "@/lib/scopecraft/tools";

describe("priorityScore", () => {
  it("computes (value + risk) / effort", () => {
    expect(priorityScore({ storyId: "US-1", value: 4, risk: 4, effort: 2 })).toBe(4);
  });

  it("throws when effort is 0", () => {
    expect(() => priorityScore({ storyId: "US-1", value: 4, risk: 4, effort: 0 })).toThrow();
  });
});

describe("scheduleSprints", () => {
  it("fills sprints up to capacity before moving to the next", () => {
    const plan = scheduleSprints({
      capacityPerSprint: 5,
      stories: [
        { storyId: "US-1", value: 5, risk: 4, effort: 3 },
        { storyId: "US-2", value: 5, risk: 3, effort: 3 },
        { storyId: "US-3", value: 2, risk: 2, effort: 2 },
      ],
    });
    expect(plan.find((p) => p.story_id === "US-1")?.sprint).toBe(1);
    expect(plan.length).toBe(3);
  });

  it("rejects out-of-range or non-integer planning inputs", () => {
    expect(() =>
      priorityScore({ storyId: "US-1", value: 6, risk: 5, effort: 2 })
    ).toThrow("value must be an integer from 1 to 5");
    expect(() =>
      priorityScore({ storyId: "US-1", value: 5, risk: 0, effort: 2 })
    ).toThrow("risk must be an integer from 1 to 5");
    expect(() =>
      priorityScore({ storyId: "US-1", value: 5, risk: 5, effort: 1.5 })
    ).toThrow("effort must be an integer");
  });

  it("rejects a story larger than the total sprint capacity", () => {
    expect(() =>
      planSprint({
        capacityPerSprint: 5,
        stories: [{ storyId: "US-1", value: 5, risk: 4, effort: 6 }],
      })
    ).toThrow("story US-1 effort exceeds sprint capacity");
  });

  it("plans dependencies before higher-priority dependent stories", () => {
    const plan = scheduleSprints({
      capacityPerSprint: 10,
      stories: [
        {
          storyId: "US-2",
          value: 5,
          risk: 5,
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
          value: 4,
          risk: 3,
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
            value: 4,
            risk: 3,
            effort: 2,
            dependencies: ["US-2"],
          },
          {
            storyId: "US-2",
            value: 4,
            risk: 5,
            effort: 2,
            dependencies: ["US-1"],
          },
        ],
      })
    ).toThrow("story dependencies contain a cycle");
  });
});

describe("planSprint — first-sprint commitment contract", () => {
  it("reports capacity, commitment, and what fits versus what slipped", () => {
    const plan = planSprint({
      capacityPerSprint: 10,
      stories: [
        { storyId: "US-1", value: 5, risk: 5, effort: 3 },  // score 3.33
        { storyId: "US-2", value: 4, risk: 4, effort: 5 },  // score 1.6
        { storyId: "US-3", value: 2, risk: 2, effort: 8 },  // score 0.5
      ],
    });

    expect(plan).toEqual({
      capacity_points: 10,
      committed_points: 8,
      included: ["US-1", "US-2"],
      deferred: ["US-3"],
    });
  });

  it("never commits beyond capacity, and loses no story", () => {
    const stories = [
      { storyId: "US-1", value: 5, risk: 5, effort: 4 },
      { storyId: "US-2", value: 4, risk: 4, effort: 4 },
      { storyId: "US-3", value: 3, risk: 3, effort: 4 },
      { storyId: "US-4", value: 2, risk: 2, effort: 4 },
    ];
    const plan = planSprint({ capacityPerSprint: 9, stories });

    expect(plan.committed_points).toBeLessThanOrEqual(plan.capacity_points);
    expect([...plan.included, ...plan.deferred].sort())
      .toEqual(stories.map((s) => s.storyId).sort());
    // No story appears in both halves.
    expect(plan.included.filter((id) => plan.deferred.includes(id))).toEqual([]);
  });

  it("defers nothing when the whole backlog fits", () => {
    const plan = planSprint({
      capacityPerSprint: 50,
      stories: [
        { storyId: "US-1", value: 5, risk: 5, effort: 3 },
        { storyId: "US-2", value: 4, risk: 4, effort: 5 },
      ],
    });

    expect(plan.deferred).toEqual([]);
    expect(plan.committed_points).toBe(8);
  });

  it("defers a story whose dependency pushed it past the boundary", () => {
    // US-2 scores highest but cannot start before US-1; together they exceed
    // capacity, so the dependent story slips even though it is the priority.
    const plan = planSprint({
      capacityPerSprint: 6,
      stories: [
        { storyId: "US-1", value: 2, risk: 2, effort: 5 },
        { storyId: "US-2", value: 5, risk: 5, effort: 5, dependencies: ["US-1"] },
      ],
    });

    expect(plan.included).toEqual(["US-1"]);
    expect(plan.deferred).toEqual(["US-2"]);
  });

  it("rejects the same unusable inputs as the scheduler", () => {
    expect(() =>
      planSprint({
        capacityPerSprint: 5,
        stories: [{ storyId: "US-1", value: 5, risk: 4, effort: 6 }],
      })
    ).toThrow("story US-1 effort exceeds sprint capacity");

    expect(() =>
      planSprint({ capacityPerSprint: 0, stories: [] })
    ).toThrow("capacityPerSprint must be a positive integer");

    expect(() =>
      planSprint({
        capacityPerSprint: 10,
        stories: [
          { storyId: "US-1", value: 4, risk: 3, effort: 2 },
          { storyId: "US-1", value: 4, risk: 3, effort: 2 },
        ],
      })
    ).toThrow("story IDs must be unique");
  });

  it("is exposed under its snake_case contract name", async () => {
    const tools = await import("@/lib/scopecraft/tools");
    expect(tools.plan_sprint).toBe(tools.planSprint);
    expect(tools.priority_score).toBe(tools.priorityScore);
    expect(tools.schedule_sprints).toBe(tools.scheduleSprints);
  });
});

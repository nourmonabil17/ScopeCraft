// src/lib/scopecraft/tool-rules.ts
//
// Knowledge, Tools & Quality Engineer (Yasmin) — deterministic tool rules.
// These are the business rules priority_score() / plan_sprint() must respect.
// Kept separate from tools.ts (Youssef's implementation) so domain rules can be reviewed independently.

export const TOOL_RULES = {
  // priority_score() must only use these three inputs — no hidden factors
  priorityInputs: ["value", "risk", "effort"] as const,

  // plan_sprint() must never exceed team capacity per sprint
  respectsCapacity: true,

  // plan_sprint() must respect declared dependencies (a story cannot be
  // scheduled before a story it depends on) — enforce this once dependency
  // fields are added to user_stories.
  respectsDependencies: true,

  // The tool must be deterministic: same input -> same output, every time.
  // No AI call is allowed inside tools.ts.
  deterministic: true,
};

export const DEFAULT_TEAM_CAPACITY_PROFILE = {
  teamName: "Team 10 default",
  capacityPerSprint: 10, // story points per sprint
  sprintLengthWeeks: 2,
};

import {
  classifyRequestDomain,
  classifyOutputField,
  findOffDomainLeak,
  extractPlanTextFields,
  type PlanTextSource,
} from "@/lib/scopecraft/taxonomy";

// A minimal, otherwise-valid plan shape to mutate per test. Keeps each test
// focused on the one field it is checking rather than re-declaring the whole
// object every time.
function samplePlan(overrides: Partial<PlanTextSource> = {}): PlanTextSource {
  return {
    problem: "Student teams lose track of scope between planning sessions.",
    target_user: "A 4-person student capstone team.",
    goals: ["Turn a rough idea into a sprint-ready backlog."],
    non_goals: ["Replacing the team's existing issue tracker."],
    requirements: ["The app must let a user submit a one-paragraph idea."],
    acceptance_criteria: ["A submitted idea returns a backlog within 30 seconds."],
    user_stories: [
      {
        as_a: "team lead",
        i_want: "to see a prioritized backlog",
        so_that: "the team knows what to build first",
        acceptance_criteria: ["The backlog is sorted by priority score."],
      },
    ],
    ...overrides,
  };
}

describe("classifyRequestDomain", () => {
  it("does not flag a normal software product idea", () => {
    expect(
      classifyRequestDomain(
        "An app that helps student teams turn a rough idea into a sprint-ready backlog."
      ).offDomain
    ).toBe(false);
  });

  it("does not flag a legitimate idea that happens to mention medicine", () => {
    // The exact case the classifier must not punish: a medication-reminder
    // app is a software idea, not a request for medical advice.
    expect(
      classifyRequestDomain(
        "A mobile app that reminds elderly users to take their medication on schedule."
      ).offDomain
    ).toBe(false);
  });

  it("does not flag a legitimate fintech or legaltech idea", () => {
    expect(
      classifyRequestDomain(
        "A platform that helps small businesses track tax deadlines and file on time."
      ).offDomain
    ).toBe(false);
    expect(
      classifyRequestDomain(
        "A tool that helps freelancers generate simple legal contract templates."
      ).offDomain
    ).toBe(false);
  });

  it("flags a direct medical advice request with no product framing", () => {
    expect(
      classifyRequestDomain("What medication should I take for a bad headache?").offDomain
    ).toBe(true);
  });

  it("flags a direct legal advice request with no product framing", () => {
    expect(classifyRequestDomain("Should I sue my landlord over my deposit?").offDomain).toBe(
      true
    );
  });

  it("flags a direct financial advice request with no product framing", () => {
    expect(
      classifyRequestDomain("What stocks should I buy with my savings this year?").offDomain
    ).toBe(true);
  });

  it("flags general personal-advice chit-chat", () => {
    expect(classifyRequestDomain("Should I quit my job? I'm not sure what to do.").offDomain).toBe(
      true
    );
  });
});

describe("classifyOutputField", () => {
  it("does not flag ordinary PRD prose", () => {
    expect(
      classifyOutputField("The system must notify the user when a task is overdue.").offDomain
    ).toBe(false);
  });

  it("catches a leaked dosage instruction", () => {
    expect(
      classifyOutputField("Take 400mg of ibuprofen every 6 hours for pain relief.").offDomain
    ).toBe(true);
  });

  it("catches a leaked diagnosis statement", () => {
    expect(
      classifyOutputField("Based on your symptoms, you have been diagnosed with diabetes.")
        .offDomain
    ).toBe(true);
  });

  it("catches leaked legal advice phrased as a statement", () => {
    expect(
      classifyOutputField("You should sue your employer for wrongful termination.").offDomain
    ).toBe(true);
  });

  it("catches leaked investment advice phrased as a statement", () => {
    expect(classifyOutputField("You should invest in these stocks: AAPL, TSLA.").offDomain).toBe(
      true
    );
  });
});

describe("extractPlanTextFields", () => {
  it("flattens every free-text field, including nested story fields", () => {
    const fields = extractPlanTextFields(samplePlan());
    expect(fields).toContain("Student teams lose track of scope between planning sessions.");
    expect(fields).toContain("to see a prioritized backlog");
    expect(fields).toContain("The backlog is sorted by priority score.");
  });
});

describe("findOffDomainLeak", () => {
  it("returns offDomain: false for a clean, ordinary plan", () => {
    expect(findOffDomainLeak(samplePlan()).offDomain).toBe(false);
  });

  it("catches a leak buried in a single requirement, even though every other field is clean", () => {
    // This is the exact gap being closed: the model answers in otherwise
    // valid PRD shape, but one field carries real advice instead of a
    // requirement. Every sibling field here is a normal, product-shaped
    // sentence — the leak must be caught on its own.
    const plan = samplePlan({
      requirements: [
        "The app must let a user submit a one-paragraph idea.",
        "Take 400mg of ibuprofen every 6 hours for pain relief.",
      ],
    });
    const result = findOffDomainLeak(plan);
    expect(result.offDomain).toBe(true);
  });

  it("catches a leak buried inside a user story's acceptance criteria", () => {
    const plan = samplePlan({
      user_stories: [
        {
          as_a: "team lead",
          i_want: "to see a prioritized backlog",
          so_that: "the team knows what to build first",
          acceptance_criteria: [
            "The backlog is sorted by priority score.",
            "You have been diagnosed with a chronic disease.",
          ],
        },
      ],
    });
    expect(findOffDomainLeak(plan).offDomain).toBe(true);
  });
});
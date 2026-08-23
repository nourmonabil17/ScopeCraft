// tests/ui/StateTransitions.test.tsx
//
// All 7 mandatory UI states, driven end-to-end through the real page
// component (owner: Joe). Interaction goes through the actual InputForm —
// typing an idea and clicking Generate plan — rather than reaching into
// page.tsx's internals, so these tests exercise the same path a user does.
// `global.fetch` is mocked per scenario to return the exact response shape
// the backend contract promises for that state.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScopeCraftPage from "@/app/scopecraft/page";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";

const VALID_IDEA =
  "A collaborative tool that helps student teams turn a rough idea into a sprint-ready backlog.";

/**
 * A minimal stand-in for the fetch `Response` object, implementing only the
 * surface `page.tsx` actually calls: `.ok`, `.json()`, `.headers.get(name)`.
 *
 * jsdom's test environment runs in an isolated V8 context that does not carry
 * over Node's native `fetch`/`Response` globals — even though this same Node
 * process has them, they are not reachable from inside that context. Rather
 * than fight that isolation with a polyfill, this test targets exactly the
 * contract page.tsx depends on, which is both simpler and a more precise
 * description of what's actually under test: how the page handles a
 * fetch-shaped result, not whether the real Response class works.
 */
function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const status = init.status ?? 200;
  const headers = new Map(Object.entries(init.headers ?? {}));
  // Cast, not a structural match: `fetch`'s declared return type is the full
  // DOM `Response` interface, but page.tsx only ever calls the three members
  // implemented above. See the comment on this function for why a full
  // Response cannot be constructed in this test environment at all.
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers.get(name) ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const FIXTURE: ScopeCraftResponse = {
  problem: "Teams struggle to turn a rough idea into a sprint-ready backlog.",
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
      dependencies: [],
    },
  ],
  acceptance_criteria: ["Every story is testable"],
  risks: [
    { id: "R-1", description: "Scope may grow", impact: "medium", likelihood: "medium" },
  ],
  priority: { "US-1": 3.33, "US-2": 0.6 },
  effort: { "US-1": 3, "US-2": 5 },
  sprint: [
    { story_id: "US-1", priority_score: 3.33, effort: 3, sprint: 1 },
    { story_id: "US-2", priority_score: 0.6, effort: 5, sprint: 1 },
  ],
  sprint_plan: {
    capacity_points: 30,
    committed_points: 8,
    included: ["US-1", "US-2"],
    deferred: [],
  },
  moscow: { "US-1": "must", "US-2": "wont" },
};

async function submitValidIdea(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/product idea/i), VALID_IDEA);
  await user.click(screen.getByRole("button", { name: /generate plan/i }));
}

// ---------------------------------------------------------------------------
// State 1 — Idle
// ---------------------------------------------------------------------------

describe("State 1 · idle", () => {
  it("shows the discovery wizard with presets and no result state", () => {
    render(<ScopeCraftPage />);

    expect(screen.getByRole("heading", { name: /scopecraft/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /start from an example/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate plan/i })).toBeEnabled();

    for (const testId of [
      "loading-state",
      "result-view",
      "empty-state",
      "validation-error-state",
      "domain-refusal-state",
      "error-state",
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// State 2 — Loading
// ---------------------------------------------------------------------------

describe("State 2 · loading", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows a skeleton and announces progress via a polite live region", async () => {
    let resolveFetch: (value: Response) => void;
    jest.spyOn(global, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const loading = screen.getByTestId("loading-state");
    expect(loading).toBeInTheDocument();
    // Scoped to the loading card: InputForm has its own (currently empty)
    // status region for preset/clear announcements, so an unscoped query
    // would match two elements.
    const status = within(loading).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/validating your request/i);

    // The form is disabled while a request is in flight.
    expect(screen.getByRole("button", { name: /generating plan/i })).toBeDisabled();

    resolveFetch!(jsonResponse(FIXTURE, { headers: { "X-Provider-Used": "nvidia" } }));
    await screen.findByTestId("result-view");
  });

  it("advances the announced step over time without repeating the whole list", async () => {
    jest.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));

    // Real timers throughout: userEvent's own internals (typing delays, event
    // dispatch) depend on real timers to resolve their promises, and mixing
    // fake timers with userEvent reliably deadlocks or produces inconsistent
    // advancement — confirmed by hand here. `findByText` polls with real
    // waits, which is what actually verifies the step advanced.
    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const status = within(screen.getByTestId("loading-state")).getByRole("status");
    expect(status).toHaveTextContent(/validating your request/i);

    await within(screen.getByTestId("loading-state")).findByText(
      /contacting the ai provider/i,
      {},
      { timeout: 3000 }
    );
    // Exactly one line is live — not the whole step list.
    expect(status.textContent).not.toMatch(/validating.*contacting/i);
  });
});

// ---------------------------------------------------------------------------
// State 3 — Success
// ---------------------------------------------------------------------------

describe("State 3 · success", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the structured PRD, evidence panel, and export actions", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(FIXTURE, {
        headers: { "X-Provider-Used": "nvidia", "X-Prompt-Version": "v5" },
      })
    );

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const result = await screen.findByTestId("result-view");
    expect(within(result).getByText(FIXTURE.problem)).toBeInTheDocument();
    expect(within(result).getByTestId("board-badge-US-1")).toHaveTextContent(/must/i);
    expect(within(result).getByTestId("board-badge-US-2")).toHaveTextContent(/won.?t/i);

    expect(screen.getByRole("button", { name: /copy prd as markdown/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download backlog json/i })).toBeInTheDocument();

    expect(screen.getByText(/nvidia/i)).toBeInTheDocument();
    expect(screen.getByText("v5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /the 2020 scrum guide/i })).toHaveAttribute(
      "href",
      "https://scrumguides.org/scrum-guide.html"
    );
  });

  it("copies a structured Markdown PRD to the clipboard, not raw prose", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(FIXTURE));

    // userEvent.setup() installs its own clipboard stub as part of its
    // initialization, so a mock defined before it gets silently overwritten
    // — confirmed by hand (navigator.clipboard was still jsdom's real
    // Clipboard instance, not this mock, when checked right before the
    // click). Defining it after setup()/render() makes this mock the one
    // that actually wins.
    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: /copy prd as markdown/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const markdown = writeText.mock.calls[0][0] as string;
    expect(markdown).toContain("# Product Requirements Document");
    expect(markdown).toContain(FIXTURE.problem);
    expect(markdown).toContain("US-1");
    expect(markdown).toContain("Must"); // FIXTURE.moscow["US-1"]
    expect(markdown).toContain("belongs to the Product Owner");
    // Structured, not a dump: the field headings exist as real sections.
    expect(markdown).toContain("## Risks");
    expect(markdown).toContain("## Sprint plan");

    await screen.findByText(/copied to clipboard/i);
  });

  it("downloads backlog JSON reflecting the current board state", async () => {
    let capturedBlob: Blob | undefined;
    const createObjectURL = jest.fn().mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock-url";
    });
    const revokeObjectURL = jest.fn();
    Object.defineProperty(global.URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(global.URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    // Only the anchor's own click is stubbed — a jsdom anchor's real
    // click() would attempt navigation, which this test doesn't want. Spying
    // on the single prototype method needed, rather than intercepting every
    // document.createElement call React itself makes during render, avoids
    // interfering with React's own DOM construction (an earlier version of
    // this test wrapped createElement globally and hung indefinitely).
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(FIXTURE));

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    // FIXTURE seeds both stories as committed. Defer US-2 before exporting,
    // so the download is asserted to reflect the edited board, not just the
    // server's first plan.
    await user.click(screen.getByRole("button", { name: /move us-2 to the deferred backlog/i }));

    await user.click(screen.getByRole("button", { name: /download backlog json/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeDefined();
    // jsdom's Blob implementation doesn't expose `.text()`; FileReader is
    // fully implemented there and works everywhere else too.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(capturedBlob!);
    });
    const backlog = JSON.parse(text);

    expect(backlog.stories.find((s: { id: string }) => s.id === "US-2").column).toBe("deferred");
    expect(backlog.stories.find((s: { id: string }) => s.id === "US-1").column).toBe("included");
    expect(backlog.stories).toHaveLength(2);

    await screen.findByText(/backlog json downloaded/i);
    // The object URL is released at some point after use — exactly when is an
    // implementation detail (a deferred setTimeout(0) in ExportActions), not
    // a behavior worth pinning to a timing assertion.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

// ---------------------------------------------------------------------------
// State 4 — Empty (after clearing a result)
// ---------------------------------------------------------------------------

describe("State 4 · empty", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows the cleared placeholder after Clear results, not the wizard's own idle copy", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(FIXTURE));

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    await user.click(screen.getByRole("button", { name: /clear results/i }));

    expect(screen.queryByTestId("result-view")).not.toBeInTheDocument();
    const empty = screen.getByTestId("empty-state");
    expect(empty).toHaveTextContent(/results cleared/i);
    // The form itself is untouched by clearing — it still has what was typed.
    expect(screen.getByLabelText(/product idea/i)).toHaveValue(VALID_IDEA);
  });
});

// ---------------------------------------------------------------------------
// State 5 — Validation error (422 VALIDATION_ERROR)
// ---------------------------------------------------------------------------

describe("State 5 · validation error", () => {
  afterEach(() => jest.restoreAllMocks());

  it("maps the issues array into field-level alerts", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Some fields need attention before a plan can be generated.",
          issues: [
            { path: "team_capacity_points", message: "Too big: expected number to be <=500" },
          ],
        },
        { status: 422 }
      )
    );

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const alert = await screen.findByTestId("validation-error-state");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent(/team capacity/i);
    expect(alert).toHaveTextContent(/too big/i);
  });
});

// ---------------------------------------------------------------------------
// State 6 — Domain refusal (422 OUT_OF_DOMAIN)
// ---------------------------------------------------------------------------

describe("State 6 · domain refusal", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows a calm rejection card, not an alarming error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: true,
          code: "OUT_OF_DOMAIN",
          message: "ScopeCraft only plans software products.",
        },
        { status: 422 }
      )
    );

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const refusal = await screen.findByTestId("domain-refusal-state");
    // status, not alert — this is a correct refusal, not a failure.
    expect(refusal).toHaveAttribute("role", "status");
    expect(refusal).toHaveTextContent("ScopeCraft only plans software products.");
  });
});

// ---------------------------------------------------------------------------
// State 7 — Provider error & retry (502 / 504)
// ---------------------------------------------------------------------------

describe("State 7 · provider error and retry", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows a retry action and preserves the original form payload on retry", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { error: true, code: "PROVIDER_ERROR", message: "Both AI providers failed. Please try again shortly." },
          { status: 502 }
        )
      )
      .mockResolvedValueOnce(jsonResponse(FIXTURE, { headers: { "X-Provider-Used": "groq" } }));

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const error = await screen.findByTestId("error-state");
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent(/both ai providers failed/i);

    await user.click(screen.getByRole("button", { name: /retry generation/i }));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
    expect(firstBody).toEqual(secondBody);
    expect(firstBody.idea).toBe(VALID_IDEA);

    await screen.findByTestId("result-view");
  });

  it("also handles a 504 timeout with the same retry shape", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(
        { error: true, code: "TIMEOUT", message: "The AI provider timed out. Please try again shortly." },
        { status: 504 }
      )
    );

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const error = await screen.findByTestId("error-state");
    expect(error).toHaveTextContent(/timed out/i);
    expect(screen.getByRole("button", { name: /retry generation/i })).toBeInTheDocument();
  });

  it("routes CLARIFICATION_REQUIRED through the same actionable error shape", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: true,
          code: "CLARIFICATION_REQUIRED",
          message: "Please clarify the product idea before generating a plan.",
          questions: ["What problem should the product solve?", "Who is the intended user?"],
        },
        { status: 422 }
      )
    );

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const error = await screen.findByTestId("error-state");
    expect(error).toHaveTextContent(/what problem should the product solve/i);
    expect(error).toHaveTextContent(/who is the intended user/i);
  });

  it("treats a network failure the same as a provider error", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const user = userEvent.setup();
    render(<ScopeCraftPage />);
    await submitValidIdea(user);

    const error = await screen.findByTestId("error-state");
    expect(error).toHaveTextContent(/network error/i);
  });
});

// tests/ui/StateTransitions.test.tsx
//
// All 7 mandatory UI states, driven end-to-end through the real page
// component (owner: Joe). Interaction goes through the actual InputForm —
// typing an idea and clicking Generate plan — rather than reaching into
// page.tsx's internals, so these tests exercise the same path a user does.
// `global.fetch` is mocked per scenario to return the exact response shape
// the backend contract promises for that state.

import { readFileSync } from "node:fs";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import ScopeCraftPage from "@/app/scopecraft/page";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { TRANSLATIONS } from "@/lib/i18n/translations";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";
import { DEFAULT_TEAM_CAPACITY_POINTS } from "@/lib/scopecraft/schema";
import { DUPLICATE_PREFILL_STORAGE_KEY } from "@/components/scopecraft/presets";

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

/**
 * The result view is tabbed: PRD Overview is active on arrival, so the sprint
 * board and the export/evidence controls sit in `hidden` panels until their
 * tab is selected. Tests that drive those controls open the tab first, the
 * same way a user would.
 */
async function openTab(
  user: ReturnType<typeof userEvent.setup>,
  tab: "overview" | "backlog" | "evidence"
) {
  await user.click(screen.getByTestId(`result-tab-${tab}`));
}

// ---------------------------------------------------------------------------
// State 1 — Idle
// ---------------------------------------------------------------------------

describe("State 1 · idle", () => {
  it("shows the discovery wizard with presets and no result state", () => {
    renderWithProviders(<ScopeCraftPage />);

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
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);

    const loading = screen.getByTestId("loading-state");
    expect(loading).toBeInTheDocument();
    // Scoped to the loading card: InputForm has its own (currently empty)
    // status region for preset/clear announcements, so an unscoped query
    // would match two elements.
    const status = within(loading).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/validating your request/i);

    // Busy, not disabled: a disabled control would leave the tab order
    // mid-request and tell a screen-reader user nothing about why.
    const submit = screen.getByRole("button", { name: /generating plan/i });
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit).not.toBeDisabled();

    // Reachable by Tab is not the same as clickable: a second click here
    // must not start a second, paid generation while the first is in
    // flight. One fetch call, not two, is what actually proves that.
    await user.click(submit);
    expect(global.fetch).toHaveBeenCalledTimes(1);

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
    renderWithProviders(<ScopeCraftPage />);
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
// State 2 — Loading, in isolation
// ---------------------------------------------------------------------------
//
// Rendered directly rather than through the page. The page-flow tests above are
// locked to real timers because fake timers deadlock against userEvent — see
// the note on "advances the announced step over time". Nothing here touches
// userEvent, so fake timers are safe, and driving the clock directly is the
// only way to reach the 5.6 s mark without a six-second test.

describe("State 2 · loading timing", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("counts the wait up in m:ss without announcing it", () => {
    renderWithProviders(<LoadingState />);

    const elapsed = screen.getByTestId("elapsed-time");
    expect(elapsed).toHaveTextContent("0:00");
    // A per-second live region is the character-counter mistake in another
    // costume. The steps announce; the counter is for eyes only.
    expect(elapsed).toHaveAttribute("aria-hidden", "true");
    expect(within(screen.getByTestId("loading-state")).getByRole("status"))
      .not.toContainElement(elapsed);

    act(() => {
      jest.advanceTimersByTime(9_000);
    });
    expect(elapsed).toHaveTextContent("0:09");

    // Past a minute, because m:ss is the whole reason it is not a raw second
    // count — a 60 s ceiling means the user can see 1:00.
    act(() => {
      jest.advanceTimersByTime(52_000);
    });
    expect(elapsed).toHaveTextContent("1:01");

    // A backgrounded tab: the wall clock moves but the throttled interval
    // fires only once when the tab regains focus. Jumping Date.now() without
    // ticking, then letting exactly one interval fire, is the case the
    // timestamp read exists for — an accumulator that adds one second per
    // fire would report 1:02 here instead of the true 1:32.
    act(() => {
      jest.setSystemTime(Date.now() + 30_000);
      jest.advanceTimersByTime(1_000);
    });
    expect(elapsed).toHaveTextContent("1:32");
  });

  it("keeps announcing past the fourth step instead of falling silent", () => {
    renderWithProviders(<LoadingState />);

    const loading = screen.getByTestId("loading-state");
    const status = within(loading).getByRole("status");
    expect(status).toHaveTextContent(/validating your request/i);

    // Four transitions at 1400 ms lands on the fifth and final step at 5.6 s.
    // Ticked one interval per act() rather than a single 5_600 ms jump:
    // each step's setTimeout is only registered once React flushes the
    // effect after the previous one fires, and that flush happens when
    // act()'s callback returns — not mid-advance. A single big jump under
    // fake timers only ever fires the one timer that already existed when
    // it started, silently advancing one step instead of four (confirmed by
    // hand). Ticking per-interval lets each step's effect register the next
    // timer before the clock moves again.
    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(1_400);
      });
    }
    expect(status).toHaveTextContent(/still working/i);

    // Terminal, not looping: a 50 s wait must not cycle back to "Validating
    // your request", which would be an outright lie about what is happening.
    act(() => {
      jest.advanceTimersByTime(45_000);
    });
    expect(status).toHaveTextContent(/still working/i);

    // And exactly one line is live — not the accumulated list.
    expect(status.textContent).not.toMatch(/validating/i);
  });

  // The two tests above only ever render LTR. "Test both directions" means
  // this component has to be seen in Arabic by something, not just the
  // steps' English strings.
  it("announces the fifth step in Arabic too", () => {
    renderWithProviders(<LoadingState />, { locale: "ar" });

    const status = within(screen.getByTestId("loading-state")).getByRole("status");

    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(1_400);
      });
    }
    expect(status).toHaveTextContent(TRANSLATIONS.ar["state.loading.step5"]);
  });

  // The shimmer swept left-to-right in Arabic, against text that reads
  // right-to-left. `transform` is physical — there is no logical translate —
  // so translateX(100%) moves visually right whatever the direction is.
  //
  // Read from the stylesheet rather than from a render: jsdom resolves no CSS
  // and identity-obj-proxy hands back the class name, so a rendered assertion
  // here would pass whether the rule existed or not. This is the same reason
  // the header's target sizes are asserted from disk.
  it("reverses the skeleton shimmer under RTL", () => {
    const css = readFileSync("src/components/common/LoadingState.module.css", "utf8");

    expect(css).toMatch(/\[dir="rtl"\]\s+\.skeletonRow::after\s*\{[^}]*animation-direction:\s*reverse/);

    // The LTR keyframe is still the one being reversed; if it stops using a
    // physical translate the rule above is solving a problem that moved.
    expect(css).toMatch(/@keyframes shimmer\s*\{[^@]*translateX/);
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
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);

    const result = await screen.findByTestId("result-view");

    // Tab 1 — PRD overview, active on arrival.
    expect(within(result).getByText(FIXTURE.problem)).toBeInTheDocument();
    expect(within(result).getByTestId("story-card-US-1")).toBeInTheDocument();

    // Tab 2 — the interactive backlog.
    await openTab(user, "backlog");
    expect(within(result).getByTestId("board-badge-US-1")).toHaveTextContent(/must/i);
    expect(within(result).getByTestId("board-badge-US-2")).toHaveTextContent(/won.?t/i);

    // Tab 3 — traceability, exports, and provenance.
    await openTab(user, "evidence");
    expect(screen.getByRole("button", { name: /copy prd as markdown/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download backlog json/i })).toBeInTheDocument();
    expect(screen.getByText(/nvidia/i)).toBeInTheDocument();
    expect(screen.getByText("v5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /the 2020 scrum guide/i })).toHaveAttribute(
      "href",
      "https://scrumguides.org/scrum-guide.html"
    );
  });

  // Module A3's client half. The route has set X-Cache since A3 shipped and
  // nothing read it, so a cache hit — which returns in well under a second
  // because no provider is called — was indistinguishable on screen from a
  // model that had cut corners.
  //
  // Both directions are asserted. A chip that is simply always rendered would
  // pass the first test on its own while making the claim meaningless.
  it("labels a plan served from the cache", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(FIXTURE, { headers: { "X-Cache": "hit" } }));

    const user = userEvent.setup();
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    expect(screen.getByTestId("cache-chip")).toHaveTextContent(/reused from your earlier/i);
  });

  it("says nothing when the plan was actually generated", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(FIXTURE, { headers: { "X-Cache": "miss" } }));

    const user = userEvent.setup();
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    expect(screen.queryByTestId("cache-chip")).not.toBeInTheDocument();
  });

  // A proxy that strips the header, or a deployment predating A3, must read as
  // "not known to be cached" rather than as a cache hit. Asserted separately
  // from the miss case because the two arrive by different routes and only one
  // of them is the app's own doing.
  it("claims nothing when the header is absent entirely", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(FIXTURE));

    const user = userEvent.setup();
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    expect(screen.queryByTestId("cache-chip")).not.toBeInTheDocument();
  });

  it("exposes the three panels as a keyboard-operable tablist", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(FIXTURE));

    const user = userEvent.setup();
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    // Arrow keys move between tabs (WAI-ARIA APG), not just clicks.
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("result-tab-backlog")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("result-panel-overview")).toHaveAttribute("hidden");

    await user.keyboard("{End}");
    expect(screen.getByTestId("result-tab-evidence")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(screen.getByTestId("result-tab-overview")).toHaveAttribute("aria-selected", "true");
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
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");
    await openTab(user, "evidence");

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

    // Confirmed in two places by design: the inline status line beside the
    // buttons, and the global toast. Both carry identical text.
    const copyConfirmations = await screen.findAllByText(/copied to clipboard/i);
    expect(copyConfirmations.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("toast")).toHaveTextContent(/copied to clipboard/i);
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
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");

    // FIXTURE seeds both stories as committed. Defer US-2 on the backlog tab
    // before exporting, so the download is asserted to reflect the edited
    // board, not just the server's first plan. The two controls now live on
    // different tabs, which is also what proves the board's state survives a
    // tab switch rather than being unmounted.
    await openTab(user, "backlog");
    await user.click(screen.getByRole("button", { name: /move us-2 to the deferred backlog/i }));

    await openTab(user, "evidence");
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

    const downloadConfirmations = await screen.findAllByText(/exported successfully/i);
    expect(downloadConfirmations.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("toast")).toHaveTextContent(/exported successfully/i);
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
    renderWithProviders(<ScopeCraftPage />);
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
    renderWithProviders(<ScopeCraftPage />);
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
    renderWithProviders(<ScopeCraftPage />);
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
    renderWithProviders(<ScopeCraftPage />);
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
    renderWithProviders(<ScopeCraftPage />);
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
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);

    const error = await screen.findByTestId("error-state");
    expect(error).toHaveTextContent(/what problem should the product solve/i);
    expect(error).toHaveTextContent(/who is the intended user/i);
  });

  it("treats a network failure the same as a provider error", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const user = userEvent.setup();
    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);

    const error = await screen.findByTestId("error-state");
    expect(error).toHaveTextContent(/network error/i);
  });
});

// ---------------------------------------------------------------------------
// Duplicate prefill (Task 7) — see HistoryList's "Duplicate" action (Task 9),
// which writes to the same sessionStorage key this page reads on mount.
// ---------------------------------------------------------------------------

describe("ScopeCraftPage duplicate prefill", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("prefills the form from sessionStorage and clears the key", () => {
    sessionStorage.setItem(
      DUPLICATE_PREFILL_STORAGE_KEY,
      JSON.stringify({
        idea: "A duplicated idea",
        constraints: "Some constraints",
        team_capacity_points: "25",
        sprint_length_days: "7",
      })
    );

    renderWithProviders(<ScopeCraftPage />);

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("A duplicated idea");
    expect(sessionStorage.getItem(DUPLICATE_PREFILL_STORAGE_KEY)).toBeNull();
  });

  it("renders the normal empty form when there is nothing to prefill", () => {
    renderWithProviders(<ScopeCraftPage />);

    expect(screen.getByLabelText(/product idea/i)).toHaveValue("");
  });

  it("falls back to sensible defaults instead of crashing on a corrupted-shape payload", () => {
    // Valid JSON, wrong shape — e.g. a stale sessionStorage entry written
    // before a field rename, so none of today's `IntakeFormValues` keys are
    // present. The old `JSON.parse(...) as IntakeFormValues` cast would have
    // handed this straight to InputForm's state with `idea` missing (i.e.
    // `undefined`), and `values.idea.trim()` — called unconditionally during
    // render — would throw on the very first paint.
    sessionStorage.setItem(
      DUPLICATE_PREFILL_STORAGE_KEY,
      JSON.stringify({ productIdea: "stale field name", teamSize: 5 })
    );

    expect(() => renderWithProviders(<ScopeCraftPage />)).not.toThrow();

    // None of the corrupted payload's keys match IntakeFormValues, so every
    // field falls back to emptyFormValues()'s real defaults.
    expect(screen.getByLabelText(/product idea/i)).toHaveValue("");
    expect(screen.getByLabelText(/team capacity/i)).toHaveValue(DEFAULT_TEAM_CAPACITY_POINTS);
    expect(sessionStorage.getItem(DUPLICATE_PREFILL_STORAGE_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D9: the four state views take the Button primitive
// ---------------------------------------------------------------------------

describe("State views · primitives", () => {
  // D3 deliberately left .retryButton and .startOverButton hand-rolled rather
  // than porting work this point would throw away. Both classes are gone now;
  // nothing in StateViews.module.css styles a control.
  it("builds the error state's retry from Button", () => {
    renderWithProviders(<ErrorState message="Generation failed" onRetry={() => {}} />);
    const retry = screen.getByRole("button", { name: "Retry generation" });
    expect(retry).toHaveClass("button");
    expect(retry).toHaveClass("primary");
  });

  it("builds the empty state's start-over from Button", () => {
    renderWithProviders(<EmptyState onStartOver={() => {}} />);
    const startOver = screen.getByRole("button");
    expect(startOver).toHaveClass("button");
    expect(startOver).toHaveClass("secondary");
  });

  it("leaves no hand-rolled control classes in the stylesheet", () => {
    // Comments stripped first — this file's own header explains that those two
    // classes were removed, and matching the prose would fail for the opposite
    // of the reason this test exists.
    const css = readFileSync("src/components/common/StateViews.module.css", "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    expect(css).not.toMatch(/\.retryButton|\.startOverButton/);
    // And no legacy tokens, which is this point's actual target.
    expect(css).not.toContain("var(--sc-");
  });

  // The error card is danger text on the danger surface; the retry button sits
  // on top of it as an accent fill. Both pairs are asserted in
  // design-tokens.test.ts — the capture never renders this state.
  it("keeps the error state announced as an alert", () => {
    renderWithProviders(<ErrorState message="Generation failed" onRetry={() => {}} />);
    expect(screen.getByTestId("error-state")).toHaveAttribute("role", "alert");
  });
});
// The client half of "ask the same question again".
//
// The route is what actually skips the cache; the only thing the page can get
// wrong is failing to ask it to — which would silently return the first plan's
// bytes as if they were a second opinion, and the comparison would show two
// identical columns with no sign anything had gone wrong.
describe("State 3 · a second opinion", () => {
  const ALT = {
    ...FIXTURE,
    problem: "A different framing of the same problem",
  };

  async function generateThenAskAgain(user: ReturnType<typeof userEvent.setup>) {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(FIXTURE, { headers: { "X-Plan-Id": "plan-a" } }))
      .mockResolvedValueOnce(
        jsonResponse(ALT, { headers: { "X-Plan-Id": "plan-b", "X-Cache": "bypass" } })
      );

    renderWithProviders(<ScopeCraftPage />);
    await submitValidIdea(user);
    await screen.findByTestId("result-view");
    await user.click(screen.getByRole("button", { name: /second opinion/i }));
    await screen.findByTestId("plan-compare");
    return fetchMock;
  }

  it("asks the same question with the cache bypassed", async () => {
    const user = userEvent.setup();
    const fetchMock = await generateThenAskAgain(user);

    const first = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const second = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    // The same question, or it is not a second opinion about anything.
    expect(second.idea).toBe(first.idea);
    expect(second.team_capacity_points).toBe(first.team_capacity_points);
    // The one difference, and the whole point.
    expect(first.bypass_cache).toBeUndefined();
    expect(second.bypass_cache).toBe(true);
  });

  // The first plan is not replaced. Someone may already have been editing its
  // board, and a second opinion that overwrote it would discard that work.
  it("keeps the first plan on screen beside the second", async () => {
    const user = userEvent.setup();
    await generateThenAskAgain(user);

    expect(screen.getByTestId("result-view")).toBeInTheDocument();
    expect(screen.getByTestId("compare-side-original")).toBeInTheDocument();
    expect(screen.getByTestId("compare-side-alternative")).toBeInTheDocument();
  });

  it("records the kept plan against that plan's own id", async () => {
    const user = userEvent.setup();
    const fetchMock = await generateThenAskAgain(user);
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));

    await user.click(screen.getByRole("button", { name: /keep the second plan/i }));

    const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
    expect(url).toBe("/api/scopecraft/plan-b/choose");
    expect(init?.method).toBe("POST");
  });
});

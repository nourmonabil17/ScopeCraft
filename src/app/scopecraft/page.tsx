// src/app/scopecraft/page.tsx
//
// ScopeCraft workflow orchestration (owner: Joe) — Module 2.
//
// Implements all 7 mandatory UI states as a discriminated union, so a given
// render can only ever be exactly one of them — there is no code path where
// two states' markup can appear simultaneously by accident. The union also
// makes the error branching explicit: the server's `code` field (not just its
// HTTP status) decides which of the three error-shaped states — validation,
// domain refusal, or provider/timeout — a 4xx/5xx response becomes.
//
// Export actions and the evidence panel now live inside ResultView's tabs
// rather than being stacked below it, so this component's only remaining job
// is state orchestration.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InputForm, type IntakeSubmitPayload } from "@/components/scopecraft/InputForm";
import { WelcomeModal } from "@/components/scopecraft/WelcomeModal";
import { ResultView } from "@/components/scopecraft/ResultView";
import type { BoardSnapshot } from "@/components/scopecraft/InteractiveSprintBoard";
import { Header } from "@/components/common/Header";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ValidationErrorState } from "@/components/common/ValidationErrorState";
import { DomainRefusalState } from "@/components/common/DomainRefusalState";
import { useLanguage } from "@/context/LanguageContext";
import type { ScopeCraftResponse, ValidationIssue } from "@/lib/scopecraft/schema";
import {
  DUPLICATE_PREFILL_STORAGE_KEY,
  emptyFormValues,
  type IntakeFormValues,
} from "@/components/scopecraft/presets";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PlanCompare } from "@/components/scopecraft/PlanCompare";
import { useToast } from "@/context/ToastContext";
import styles from "./page.module.css";

/** Matches the X-Provider-Used header the API sets. NVIDIA is the primary
 *  tier; omitting it previously mislabelled every NVIDIA-served plan as
 *  Gemini. */
type ProviderUsed = "nvidia" | "groq" | "gemini";
const PROVIDERS: readonly ProviderUsed[] = ["nvidia", "groq", "gemini"];

function readProvider(header: string | null): ProviderUsed | "unknown" {
  return PROVIDERS.includes(header as ProviderUsed) ? (header as ProviderUsed) : "unknown";
}

type UiState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      resultId: number;
      data: ScopeCraftResponse;
      providerUsed: ProviderUsed | "unknown";
      promptVersion: string;
      /** X-Cache said "hit": this plan was served from the caller's own
       *  earlier identical request (Module A3) and no provider was called. */
      servedFromCache: boolean;
    }
  | { status: "empty" }
  | { status: "validation_error"; message: string; issues: ValidationIssue[] }
  | { status: "domain_refusal"; message: string }
  | { status: "provider_error"; message: string; questions?: string[] };

/** A response body from the API on any non-2xx status. `issues` and
 *  `questions` are only present for specific codes; both are optional here
 *  and narrowed per-branch below. */
type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * The board reports on every change, including every keystroke in a points
 * field. Long enough that typing "13" is one save rather than two, short enough
 * that a user who edits and immediately closes the tab still gets the write.
 */
const SAVE_DEBOUNCE_MS = 800;

interface ApiErrorBody {
  code?: string;
  message?: string;
  issues?: ValidationIssue[];
  questions?: string[];
}

export default function ScopeCraftPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [state, setState] = useState<UiState>({ status: "idle" });
  const [duplicateValues, setDuplicateValues] = useState<IntakeFormValues>(emptyFormValues());
  // Separate from `duplicateValues` itself: that state is always a fully-formed
  // `IntakeFormValues` (defaults merged in), so it can no longer double as the
  // "did a real duplicate payload arrive" signal the way `undefined` once did.
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const [lastRequest, setLastRequest] = useState<IntakeSubmitPayload | null>(null);
  const [board, setBoard] = useState<BoardSnapshot | undefined>(undefined);
  const [planId, setPlanId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // The second answer to the same question, and which of the two the user kept.
  //
  // Held beside `state` rather than inside its success branch on purpose: the
  // first plan is not replaced, and the board being edited belongs to it. A
  // second opinion that overwrote `state` would silently discard those edits,
  // which is the opposite of what asking for one is for.
  const [alternative, setAlternative] = useState<{
    data: ScopeCraftResponse;
    planId: string | null;
  } | null>(null);
  const [alternativePending, setAlternativePending] = useState(false);
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [choosePending, setChoosePending] = useState(false);
  const [rewritingStoryId, setRewritingStoryId] = useState<string | null>(null);
  // Re-keys the board alone when a story is rewritten, and names the card that
  // should reclaim focus once the new board exists.
  const [boardRevision, setBoardRevision] = useState(0);
  const [rewrittenStoryId, setRewrittenStoryId] = useState<string | null>(null);
  const resultCounter = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Saves the human's board edits, debounced.
   *
   * Debounced because the board fires on every keystroke of a points field, and
   * an unthrottled PATCH per keystroke would be both wasteful and racy — the
   * last response to arrive would win rather than the last edit made.
   *
   * Only `points` and `column` are sent. Score, MoSCoW and capacity are derived
   * and get recomputed on load; sending them would make a saved board a second
   * source of truth for numbers the code owns.
   */
  const scheduleSave = useCallback(
    (snapshot: BoardSnapshot) => {
      if (!planId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = setTimeout(() => {
        const edits = Object.fromEntries(
          snapshot.stories.map((story) => [
            story.storyId,
            { points: story.points, column: story.column },
          ])
        );
        setSaveState("saving");
        fetch(`/api/scopecraft/${planId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(edits),
        })
          .then((res) => setSaveState(res.ok ? "saved" : "failed"))
          .catch(() => setSaveState("failed"));
      }, SAVE_DEBOUNCE_MS);
    },
    [planId]
  );

  const handleBoardChange = useCallback(
    (snapshot: BoardSnapshot) => {
      setBoard(snapshot);
      scheduleSave(snapshot);
    },
    [scheduleSave]
  );

  // A pending save would otherwise fire against a plan the user has left.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Reads a prefill payload written by a history card's "Duplicate" button
  // (see HistoryList). This MUST run in an effect, not a lazy useState
  // initializer: sessionStorage does not exist during SSR, so a lazy
  // initializer would return `undefined` on the server and a real value on
  // the client's first (hydrating) render whenever a prefill genuinely
  // exists — a hydration mismatch identical in kind to the one already
  // tracked elsewhere in this project. Running it in an effect means both
  // the server render AND the client's hydrating render see the same
  // `undefined` state; the real value only appears in a later, ordinary
  // re-render, well after hydration has already succeeded.
  //
  // react-hooks/set-state-in-effect flags the setState call below as
  // "derived state that could be computed during render" — its usual,
  // correct heuristic. It does not apply here: the value cannot be computed
  // during render without the SSR/hydration mismatch above, and reading a
  // one-shot external source once on mount is exactly the "synchronizing
  // with an external system" case the rule's own message text carves out.
  useEffect(() => {
    const raw = sessionStorage.getItem(DUPLICATE_PREFILL_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(DUPLICATE_PREFILL_STORAGE_KEY);
    try {
      // Merged over the defaults rather than cast and trusted directly: `raw`
      // is untrusted sessionStorage content, not a value this code produced.
      // JSON.parse only guarantees valid JSON, not the right shape — a stale
      // key from a future field rename would otherwise flow straight into
      // InputForm's state as e.g. a missing string field, and a string
      // method called on it during render would crash the page.
      const parsed = JSON.parse(raw) as Partial<IntakeFormValues>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDuplicateValues({ ...emptyFormValues(), ...parsed });
      setHasDuplicate(true);
    } catch {
      // Corrupted value (bad JSON syntax) — treated exactly like "nothing to
      // prefill". A corrupted *shape* (valid JSON, wrong fields) is handled
      // above by merging over defaults instead of throwing here.
    }
  }, []);

  function scrollToForm() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Asks the same question again, past the cache.
   *
   * `bypass_cache` is the whole of it. Without the flag an identical request
   * hashes identically and A3 returns the stored plan verbatim, so the "second
   * opinion" would be the first one's bytes and the comparison would be empty.
   *
   * It costs a generation and is metered like any other, because the route
   * reads the flag after the daily budget has already been checked.
   *
   * Failure leaves the first plan exactly as it was. There is nothing to roll
   * back — nothing was replaced — so this reports and stops.
   */
  async function secondOpinion() {
    if (!lastRequest || alternativePending) return;
    setAlternativePending(true);
    try {
      const res = await fetch("/api/scopecraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lastRequest, bypass_cache: true }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const err: ApiErrorBody = await res.json().catch(() => ({}));
        showToast(err.message ?? t("result.alternative.failed"), "error");
        return;
      }
      setAlternative({
        data: await res.json(),
        planId: res.headers.get("X-Plan-Id"),
      });
    } catch {
      showToast(t("result.alternative.failed"), "error");
    } finally {
      setAlternativePending(false);
    }
  }

  /**
   * Records which plan the user kept.
   *
   * Marked optimistically: the request writes a preference, not data, and the
   * worst case of a failed write is that the older plan is served again the
   * next time this question is asked. Blocking the UI on it would cost more
   * than the mistake does.
   */
  async function choosePlan(id: string) {
    if (choosePending) return;
    const previous = chosenPlanId;
    setChoosePending(true);
    setChosenPlanId(id);
    try {
      const res = await fetch(`/api/scopecraft/${id}/choose`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setChosenPlanId(previous);
      // Its own message, not board.saveFailed. Nothing was being edited — the
      // user marked which plan to keep — and borrowing the board's wording
      // reports the wrong feature as broken.
      showToast(t("compare.keepFailed"), "error");
    } finally {
      setChoosePending(false);
    }
  }

  /**
   * Rewrites one story and swaps in the plan that comes back.
   *
   * The WHOLE plan is replaced, not the one story, because the server re-ran the
   * sprint arithmetic over the entire backlog — a rewritten story usually
   * changes its points, and points decide what fits. Splicing one story into the
   * old plan here would leave the board's totals describing a backlog that no
   * longer exists.
   *
   * The board snapshot and any second opinion are dropped with it: both belong
   * to the plan being replaced, and the new plan has its own id, its own row and
   * its own packing.
   */
  async function rewriteStory(storyId: string) {
    if (!planId || rewritingStoryId) return;
    setRewritingStoryId(storyId);
    try {
      // Encoded: a story id is model output, validated only as a non-empty
      // string, so a slash or a question mark in one would build a different
      // URL than the one intended.
      const res = await fetch(
        `/api/scopecraft/${planId}/story/${encodeURIComponent(storyId)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const err: ApiErrorBody = await res.json().catch(() => ({}));
        showToast(err.message ?? t("board.rewrite.failed"), "error");
        return;
      }

      const data: ScopeCraftResponse = await res.json();
      // NOT resultCounter. Bumping it re-keys ResultView, which throws the
      // reader back to the Overview tab — away from the board they pressed the
      // control on, and away from the recalculated plan they were just told
      // about. Only the board holds state derived from the stories, so only the
      // board is re-keyed.
      setBoardRevision((n) => n + 1);
      setRewrittenStoryId(storyId);
      setBoard(undefined);
      setAlternative(null);
      setChosenPlanId(null);
      setPlanId(res.headers.get("X-Plan-Id"));
      setSaveState("idle");
      setState((current) =>
        current.status === "success" ? { ...current, data, servedFromCache: false } : current
      );
      showToast(t("board.rewrite.done", { id: storyId }), "success");
    } catch {
      showToast(t("board.rewrite.failed"), "error");
    } finally {
      setRewritingStoryId(null);
    }
  }

  async function submit(payload: IntakeSubmitPayload) {
    setLastRequest(payload);
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/scopecraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err: ApiErrorBody = await res.json().catch(() => ({}));
        const message = err.message ?? t("state.error.generic");

        if (err.code === "VALIDATION_ERROR") {
          setState({ status: "validation_error", message, issues: err.issues ?? [] });
          return;
        }
        if (err.code === "OUT_OF_DOMAIN") {
          setState({ status: "domain_refusal", message });
          return;
        }
        // A session that expired while the page was open. There is nothing the
        // user can act on from here, so this is a redirect rather than an error
        // card — the layout gate would have done the same on a fresh load.
        if (err.code === "UNAUTHORIZED") {
          window.location.href = "/login";
          return;
        }
        // Every other code — PAYLOAD_TOO_LARGE, INVALID_JSON, CLARIFICATION_REQUIRED,
        // PLANNING_ERROR, SCHEMA_VIOLATION, PROVIDER_ERROR, TIMEOUT — shares the
        // same "explain and offer retry" shape.
        setState({
          status: "provider_error",
          message,
          questions: Array.isArray(err.questions) ? err.questions : undefined,
        });
        return;
      }

      const data: ScopeCraftResponse = await res.json();
      const providerUsed = readProvider(res.headers.get("X-Provider-Used"));
      const promptVersion = res.headers.get("X-Prompt-Version") ?? "unknown";
      resultCounter.current += 1;
      setBoard(undefined); // fresh board state for a fresh generation
      // A new question; the previous pair and its choice no longer relate to
      // anything on screen.
      setAlternative(null);
      setChosenPlanId(null);
      // Absent when the persistence write failed. The board still works; it
      // just cannot be saved, and `saveState` says so rather than failing
      // silently on the first edit.
      setPlanId(res.headers.get("X-Plan-Id"));
      setSaveState("idle");
      setState({
        status: "success",
        resultId: resultCounter.current,
        data,
        providerUsed,
        promptVersion,
        // Only "hit" is a claim worth making. Anything else — "miss", a header
        // stripped by a proxy, an older deployment that never set it — means
        // "not known to be cached", and the chip stays off. Read this way round
        // so a missing header can never assert something that did not happen.
        servedFromCache: res.headers.get("X-Cache") === "hit",
      });
    } catch {
      setState({
        status: "provider_error",
        message: t("state.error.network"),
      });
    }
  }

  function handleClear() {
    setBoard(undefined);
    setState({ status: "empty" });
  }

  // The header's reset is only meaningful once there is something on screen to
  // clear; on first load it would be a no-op control.
  const canReset = state.status !== "idle" && state.status !== "loading";

  return (
    <>
      <WelcomeModal />

      <Header
        onReset={
          canReset
            ? () => {
                handleClear();
                scrollToForm();
              }
            : undefined
        }
      />

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div>
          <h1 className={styles.title}>{t("app.name")}</h1>
          <p className={styles.subtitle}>{t("app.tagline")}</p>
        </div>

        {/* `key` forces a remount when duplicateValues arrives after the
            initial render — InputForm's lazy useState initializer only runs
            once per mount, so a plain prop change would be silently
            ignored. `hasDuplicate` (not `duplicateValues` itself) is the
            remount signal: duplicateValues is always fully-formed now, so it
            can't double as "was a real duplicate payload found". */}
        <InputForm
          key={hasDuplicate ? "duplicate" : "empty"}
          initialValues={duplicateValues}
          onSubmit={submit}
          isLoading={state.status === "loading"}
        />

        {state.status === "loading" && <LoadingState />}

        {state.status === "empty" && <EmptyState onStartOver={scrollToForm} />}

        {state.status === "validation_error" && (
          <ValidationErrorState
            message={state.message}
            issues={state.issues}
            onDismiss={scrollToForm}
          />
        )}

        {state.status === "domain_refusal" && (
          <DomainRefusalState message={state.message} onEditIdea={scrollToForm} />
        )}

        {state.status === "provider_error" && (
          <ErrorState
            message={state.message}
            questions={state.questions}
            onRetry={lastRequest ? () => submit(lastRequest) : undefined}
          />
        )}

        {state.status === "success" && (
          <>
            <div className={styles.resultsToolbar}>
              {/* Only on a hit, and only as a label — no aria-live. It arrives
                  in the same render as the plan itself, so the result is
                  already the announcement; a live region here would speak over
                  it to say something less important.

                  This is the client half of Module A3. The route has set
                  X-Cache since A3 shipped and nothing read it, which made a
                  0.6-second answer indistinguishable from a suspiciously fast
                  model rather than an explained one. */}
              {state.servedFromCache && <Chip testId="cache-chip">{t("result.cache.hit")}</Chip>}
              {/* Save state is announced politely rather than assertively: it
                  changes on a debounce timer, and an assertive region would
                  interrupt a screen-reader user mid-sentence while they edit. */}
              <p className={styles.saveState} role="status" aria-live="polite">
                {saveState === "saving" && t("board.saving")}
                {saveState === "saved" && t("board.saved")}
                {saveState === "failed" && t("board.saveFailed")}
                {saveState === "idle" && planId === null && t("board.saveUnavailable")}
              </p>
              {/* Disabled rather than hidden while in flight: the control's
                  absence would reflow the toolbar under the pointer. */}
              {/* `busy`, not `disabled`, for the pending half — Button draws
                  that distinction on purpose: a disabled control leaves the tab
                  order, so a keyboard or screen-reader user standing on it when
                  the request starts loses their place and is told nothing. Only
                  the "no request to repeat" case is a true disable. */}
              <Button
                variant="secondary"
                onClick={secondOpinion}
                busy={alternativePending}
                disabled={lastRequest === null}
              >
                {alternativePending
                  ? t("result.alternative.generating")
                  : t("result.alternative.generate")}
              </Button>
              <Button variant="secondary" onClick={handleClear}>
                {t("result.clear")}
              </Button>
            </div>

            {alternative && (
              <PlanCompare
                original={{ planId, data: state.data }}
                alternative={alternative}
                chosenPlanId={chosenPlanId}
                onChoose={choosePlan}
                busy={choosePending}
              />
            )}

            <ResultView
              key={state.resultId}
              data={state.data}
              onBoardChange={handleBoardChange}
              providerUsed={state.providerUsed}
              promptVersion={state.promptVersion}
              board={board}
              onRewriteStory={planId ? rewriteStory : undefined}
              rewritingStoryId={rewritingStoryId}
              boardKey={boardRevision}
              focusStoryId={rewrittenStoryId}
            />
          </>
        )}
      </main>
    </>
  );
}

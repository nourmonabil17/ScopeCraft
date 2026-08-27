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
  const [state, setState] = useState<UiState>({ status: "idle" });
  const [lastRequest, setLastRequest] = useState<IntakeSubmitPayload | null>(null);
  const [board, setBoard] = useState<BoardSnapshot | undefined>(undefined);
  const [planId, setPlanId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
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

  function scrollToForm() {
    window.scrollTo({ top: 0, behavior: "smooth" });
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

        <InputForm onSubmit={submit} isLoading={state.status === "loading"} />

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
              {/* Save state is announced politely rather than assertively: it
                  changes on a debounce timer, and an assertive region would
                  interrupt a screen-reader user mid-sentence while they edit. */}
              <p className={styles.saveState} role="status" aria-live="polite">
                {saveState === "saving" && t("board.saving")}
                {saveState === "saved" && t("board.saved")}
                {saveState === "failed" && t("board.saveFailed")}
                {saveState === "idle" && planId === null && t("board.saveUnavailable")}
              </p>
              <button type="button" className={styles.clearButton} onClick={handleClear}>
                {t("result.clear")}
              </button>
            </div>

            <ResultView
              key={state.resultId}
              data={state.data}
              onBoardChange={handleBoardChange}
              providerUsed={state.providerUsed}
              promptVersion={state.promptVersion}
              board={board}
            />
          </>
        )}
      </main>
    </>
  );
}

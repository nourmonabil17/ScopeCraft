// src/app/scopecraft/history/[id]/SavedPlanView.tsx
//
// The client half of a reopened plan (owner: Yousef).
//
// Reuses ResultView wholesale rather than building a read-only variant. A saved
// plan and a fresh one are the same thing — a PRD, a board, an evidence panel —
// and a second renderer would be a second place for them to drift apart. The
// only difference is where the board's starting state comes from.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResultView } from "@/components/scopecraft/ResultView";
import type { BoardSnapshot } from "@/components/scopecraft/InteractiveSprintBoard";
import { useLanguage } from "@/context/LanguageContext";
import type { BoardEdits, ScopeCraftResponse } from "@/lib/scopecraft/schema";
import styles from "./SavedPlanView.module.css";

/** Matches the debounce on the live page, for the same reason: the board
 *  reports on every keystroke of a points field. */
const SAVE_DEBOUNCE_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "failed";

export interface SavedPlanViewProps {
  planId: string;
  idea: string;
  data: ScopeCraftResponse;
  savedEdits?: BoardEdits;
  providerUsed: string | null;
  promptVersion: string | null;
  createdAt: string;
}

export function SavedPlanView({
  planId,
  idea,
  data,
  savedEdits,
  providerUsed,
  promptVersion,
  createdAt,
}: SavedPlanViewProps) {
  const { t, locale } = useLanguage();
  const [board, setBoard] = useState<BoardSnapshot | undefined>(undefined);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoardChange = useCallback(
    (snapshot: BoardSnapshot) => {
      setBoard(snapshot);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const edits = Object.fromEntries(
          snapshot.stories.map((s) => [s.storyId, { points: s.points, column: s.column }])
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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <>
      <header className={styles.head}>
        {/* dir="auto": the idea is the user's own text and may be in either
            language regardless of the interface language. */}
        <h1 className={styles.idea} dir="auto">
          {idea}
        </h1>
        <p className={styles.meta}>
          <time dateTime={createdAt}>
            {new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(createdAt))}
          </time>
          <span className={styles.saveState} role="status" aria-live="polite">
            {saveState === "saving" && t("board.saving")}
            {saveState === "saved" && t("board.saved")}
            {saveState === "failed" && t("board.saveFailed")}
          </span>
        </p>
      </header>

      <ResultView
        data={data}
        board={board}
        savedEdits={savedEdits}
        onBoardChange={handleBoardChange}
        providerUsed={readProvider(providerUsed)}
        promptVersion={promptVersion ?? "unknown"}
      />
    </>
  );
}

/** The column is free text in the schema; the prop is a union. Anything the
 *  database holds that is not one of the three reads as "unknown" rather than
 *  being cast through. */
function readProvider(value: string | null): "nvidia" | "groq" | "gemini" | "unknown" {
  return value === "nvidia" || value === "groq" || value === "gemini" ? value : "unknown";
}

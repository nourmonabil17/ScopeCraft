// src/components/scopecraft/ExportActions.tsx
//
// One-click PRD/backlog export (owner: Joe) — Module 2.
//
// Both actions are pure client-side formatting over data already on the page;
// neither calls the network. `toMarkdown` / `toBacklogJson` (export-format.ts)
// take an optional live board snapshot so a Download reflects what the
// Product Owner actually decided on the interactive board, not just the
// server's first proposal — but Copy/Download themselves stay dumb: this
// component only turns formatted strings into a clipboard write or a file.
//
// Feedback goes through the global toast system. The inline `role="status"`
// line is kept as well, and deliberately: the toast is fixed-position and can
// sit outside the reading order a keyboard user is currently in, so the inline
// line remains the reliable in-context confirmation. Both carry the same text,
// so nothing is announced twice with different wording.

"use client";

import { useEffect, useRef, useState } from "react";
import type { ScopeCraftResponse } from "@/lib/scopecraft/schema";
import { toBacklogJson, toMarkdown, type BoardOverride } from "@/lib/scopecraft/export-format";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import type { BoardSnapshot } from "./InteractiveSprintBoard";
import { Button } from "@/components/ui/Button";
import styles from "./ExportActions.module.css";

export interface ExportActionsProps {
  data: ScopeCraftResponse;
  /** The board's current state, if the interactive board has reported one.
   *  Undefined until the first render of InteractiveSprintBoard commits. */
  board?: BoardSnapshot;
}

type StatusKind = "idle" | "ok" | "error";

function boardOverrideFrom(board: BoardSnapshot | undefined): BoardOverride | undefined {
  if (!board) return undefined;
  return {
    stories: board.stories,
    capacityPoints: board.capacity.capacityPoints,
    committedPoints: board.capacity.committedPoints,
  };
}

/** Copies text without assuming a modern, secure-context clipboard API is
 *  available — the async Clipboard API is undefined in some embedded/older
 *  browser contexts, and failing loudly there would break the button for no
 *  real reason when a working fallback exists. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path — some browsers reject clipboard
      // writes outside a user gesture even though this call originates
      // directly from a click handler.
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Deferred, not immediate: revoking synchronously can race the browser's
  // own handling of the click in some engines and silently break the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportActions({ data, board }: ExportActionsProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<{ kind: StatusKind; message: string }>({
    kind: "idle",
    message: "",
  });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(clearTimer.current);
  }, []);

  function announce(kind: StatusKind, message: string) {
    setStatus({ kind, message });
    showToast(message, kind === "error" ? "error" : "success");
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setStatus({ kind: "idle", message: "" }), 4000);
  }

  async function handleCopyMarkdown() {
    const markdown = toMarkdown(data, boardOverrideFrom(board));
    const ok = await copyText(markdown);
    announce(ok ? "ok" : "error", ok ? t("export.copied") : t("export.copyFailed"));
  }

  function handleDownloadJson() {
    try {
      const backlog = toBacklogJson(
        data,
        board ? { ...boardOverrideFrom(board)!, liveScores: board.liveScores } : undefined
      );
      downloadJson("scopecraft-backlog.json", backlog);
      announce("ok", t("export.downloaded"));
    } catch {
      announce("error", t("export.downloadFailed"));
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <Button variant="secondary" className={styles.button} onClick={handleCopyMarkdown}>
          <span aria-hidden="true">📋</span>
          {t("export.copyMarkdown")}
        </Button>
        <Button variant="secondary" className={styles.button} onClick={handleDownloadJson}>
          <span aria-hidden="true">⬇</span>
          {t("export.downloadJson")}
        </Button>
      </div>
      <p
        className={`${styles.status} ${status.kind === "error" ? styles.statusError : ""}`}
        role="status"
        aria-live="polite"
      >
        {status.message}
      </p>
    </div>
  );
}

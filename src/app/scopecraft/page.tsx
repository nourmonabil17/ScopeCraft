"use client";

import { useState } from "react";
import { InputForm } from "@/components/scopecraft/InputForm";
import { ResultView } from "@/components/scopecraft/ResultView";
import { EvidencePanel } from "@/components/scopecraft/EvidencePanel";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ScopeCraftResponse } from "@/lib/scopecraft/schema";

type UiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ScopeCraftResponse; providerUsed: "gemini" | "groq" }
  | { status: "error"; message: string };

export default function ScopeCraftPage() {
  const [state, setState] = useState<UiState>({ status: "idle" });
  const [lastRequest, setLastRequest] = useState<{ idea: string; constraints: string } | null>(null);

  async function submit(idea: string, constraints: string) {
    setLastRequest({ idea, constraints });
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/scopecraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, constraints }),
      });
      if (!res.ok) {
        const err = await res.json();
        setState({ status: "error", message: err.message ?? "Something went wrong." });
        return;
      }
      const data: ScopeCraftResponse = await res.json();
      const providerUsed = (res.headers.get("X-Provider-Used") as "gemini" | "groq") ?? "gemini";
      setState({ status: "success", data, providerUsed });
    } catch {
      setState({ status: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>ScopeCraft</h1>
      <p>Turn a product idea into a structured PRD, user stories, risks, and sprint plan.</p>

      <InputForm onSubmit={submit} disabled={state.status === "loading"} />

      {state.status === "loading" && <LoadingState />}

      {state.status === "error" && (
        <ErrorState
          message={state.message}
          onRetry={lastRequest ? () => submit(lastRequest.idea, lastRequest.constraints) : undefined}
        />
      )}

      {state.status === "success" && (
        <>
          <ResultView data={state.data} />
          <EvidencePanel providerUsed={state.providerUsed} />
        </>
      )}
    </main>
  );
}

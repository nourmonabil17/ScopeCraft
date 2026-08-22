"use client";

import { useState, useEffect } from "react";
import { InputForm } from "@/components/scopecraft/InputForm";
import { ResultView } from "@/components/scopecraft/ResultView";
import { EvidencePanel } from "@/components/scopecraft/EvidencePanel";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ScopeCraftResponse } from "@/lib/scopecraft/schema";

type UiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ScopeCraftResponse; providerUsed: "gemini" | "groq"; promptVersion: string }
  | { status: "error"; message: string; questions?: string[] };

export default function ScopeCraftPage() {
  const [state, setState] = useState<UiState>({ status: "idle" });
  const [lastRequest, setLastRequest] = useState<{ idea: string; constraints: string; capacityPerSprint: number } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("sc-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sc-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  async function submit(idea: string, constraints: string, capacityPerSprint: number) {
    setLastRequest({ idea, constraints, capacityPerSprint });
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/scopecraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, constraints, capacity_per_sprint: capacityPerSprint }),
      });
      if (!res.ok) {
        const err = await res.json();
        setState({ status: "error", message: err.message ?? "Something went wrong.", questions: Array.isArray(err.questions) ? err.questions : undefined });
        return;
      }
      const data: ScopeCraftResponse = await res.json();
      const providerUsed = (res.headers.get("X-Provider-Used") as "gemini" | "groq") ?? "gemini";
      const promptVersion = res.headers.get("X-Prompt-Version") ?? "unknown";
      setState({ status: "success", data, providerUsed, promptVersion });
    } catch {
      setState({ status: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  const handleEdit = () => setState({ status: "idle" });
  const handleRegenerate = () => {
    if (lastRequest) submit(lastRequest.idea, lastRequest.constraints, lastRequest.capacityPerSprint);
  };

  const s = {
    page: { minHeight: "100vh", display: "flex", flexDirection: "column" as const },
    header: { position: "sticky" as const, top: 0, zIndex: 50, background: "var(--header-bg)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" },
    headerInner: { maxWidth: 880, margin: "0 auto", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { display: "flex", alignItems: "center", gap: 10 },
    logoMark: { fontSize: 22, color: "var(--cyan)", filter: "drop-shadow(0 0 8px var(--cyan))" },
    logoText: { fontFamily: "'Space Grotesk','Inter',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", background: "linear-gradient(135deg,var(--text) 40%,var(--primary-bright))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    nav: { display: "flex", alignItems: "center", gap: 12 },
    badge: { fontSize: 11, letterSpacing: "0.06em", color: "var(--text-dim)", background: "var(--bg-card)", border: "1px solid var(--border)", padding: "3px 10px", borderRadius: 20 },
    themeBtn: { width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" },
    main: { flex: 1, maxWidth: 880, margin: "0 auto", padding: "0 24px 80px", width: "100%" },
    hero: { padding: "60px 0 40px", textAlign: "center" as const },
    eyebrow: { display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--cyan)", background: "var(--cyan-dim)", border: "1px solid rgba(34,211,238,0.2)", padding: "4px 14px", borderRadius: 20, marginBottom: 20 },
    h1: { fontFamily: "'Space Grotesk','Inter',sans-serif", fontSize: "clamp(32px,5.5vw,52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.07, marginBottom: 16, color: "var(--text)" },
    accent: { background: "linear-gradient(120deg,var(--primary-bright) 0%,var(--cyan) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    sub: { fontSize: 16, lineHeight: 1.65, color: "var(--text-muted)", maxWidth: 500, margin: "0 auto" },
    inputCard: { background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 28px 24px", marginBottom: 32, transition: "background 0.25s,border-color 0.25s" },
    successBar: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" as const },
    successLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--success)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 },
    dot: { width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block", boxShadow: "0 0 8px var(--success)" },
    h2: { fontFamily: "'Space Grotesk','Inter',sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" },
    btnRow: { display: "flex", gap: 8 },
    editBtn: { fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 16px", cursor: "pointer", transition: "all 0.15s" },
    regenBtn: { fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "white", background: "linear-gradient(135deg,var(--primary),#4f46e5)", border: "none", borderRadius: "var(--radius-sm)", padding: "8px 16px", cursor: "pointer", boxShadow: "0 4px 14px var(--primary-glow)" },
    footer: { borderTop: "1px solid var(--border)", padding: "16px 24px", textAlign: "center" as const, fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.03em" },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logo}>
            <span style={s.logoMark}>◈</span>
            <span style={s.logoText}>ScopeCraft</span>
          </div>
          <div style={s.nav}>
            <span style={s.badge}>v0.1 · Team 10</span>
            <button style={s.themeBtn} onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main style={s.main}>
        {/* Hero */}
        <section style={s.hero}>
          <div style={s.eyebrow}>AI-powered product planning</div>
          <h1 style={s.h1}>
            From rough idea<br />
            <span style={s.accent}>to ready-to-build</span>
          </h1>
          <p style={s.sub}>Describe your product concept. ScopeCraft generates a full PRD, user stories, risk register, and sprint plan — in seconds.</p>
        </section>

        {/* Input form */}
        {(state.status === "idle" || state.status === "error") && (
          <div style={s.inputCard}>
            <InputForm onSubmit={submit} disabled={state.status === "loading"} />
          </div>
        )}

        {state.status === "loading" && <LoadingState />}

        {state.status === "error" && (
          <ErrorState
            message={state.message}
            questions={state.questions}
            onRetry={lastRequest ? () => submit(lastRequest.idea, lastRequest.constraints, lastRequest.capacityPerSprint) : undefined}
          />
        )}

        {state.status === "success" && (
          <>
            {/* ✏️ Edit + Regenerate bar */}
            <div style={s.successBar}>
              <div>
                <div style={s.successLabel}><span style={s.dot} />Scope generated</div>
                <h2 style={s.h2}>Your product blueprint</h2>
              </div>
              <div style={s.btnRow}>
                <button style={s.editBtn} onClick={handleEdit}>✏️ Edit idea</button>
                <button style={s.regenBtn} onClick={handleRegenerate}>↻ Regenerate</button>
              </div>
            </div>

            <ResultView data={state.data} />
            <EvidencePanel providerUsed={state.providerUsed} promptVersion={state.promptVersion} />
          </>
        )}
      </main>

      <footer style={s.footer}>ScopeCraft · Team 10 · Nour · Youssef · Joe · Yasmin</footer>
    </div>
  );
}

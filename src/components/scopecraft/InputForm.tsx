"use client";

import { useState } from "react";
import { MAX_CONSTRAINTS_LENGTH, MAX_IDEA_LENGTH } from "@/lib/scopecraft/schema";

export interface InputFormProps {
  onSubmit: (idea: string, constraints: string, capacityPerSprint: number) => void;
  disabled?: boolean;
}

const EXAMPLES = [
  "An app that helps remote teams run async standups using short voice clips instead of written updates.",
  "A browser extension that summarises any research paper into a 5-bullet abstract on hover.",
  "A marketplace for local freelance chefs to offer meal-prep services to busy households.",
];

export function InputForm({ onSubmit, disabled }: InputFormProps) {
  const [idea, setIdea] = useState("");
  const [constraints, setConstraints] = useState("");
  const [capacityPerSprint, setCapacityPerSprint] = useState(10);
  const [touched, setTouched] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const ideaError = touched && idea.trim().length < 5
    ? `${5 - idea.trim().length} more characters needed`
    : null;
  const charPct = idea.length / MAX_IDEA_LENGTH;
  const readyToSubmit = !disabled && idea.trim().length >= 5 && Number.isInteger(capacityPerSprint) && capacityPerSprint >= 1 && capacityPerSprint <= 100;

  const fieldStyle = (name: string, error?: boolean) => ({
    width: "100%", background: "var(--bg)", color: "var(--text)",
    border: `1.5px solid ${error ? "var(--error)" : focusedField === name ? "var(--primary)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)", padding: "10px 14px",
    fontFamily: "inherit", fontSize: 14, lineHeight: 1.6, outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: focusedField === name ? "0 0 0 3px var(--primary-glow)" : "none",
    resize: "vertical" as const,
  });

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 600 as const,
    letterSpacing: "0.08em", textTransform: "uppercase" as const,
    color: "var(--text-dim)", marginBottom: 8,
  };

  return (
    <div>
      {/* Example chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)", flexShrink: 0 }}>Try an example:</span>
        {EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => { setIdea(ex); setTouched(false); }} style={{
            fontFamily: "inherit", fontSize: 12, color: "var(--text-muted)",
            background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "4px 12px", cursor: "pointer", transition: "all 0.15s",
          }}>
            {ex.slice(0, 48)}…
          </button>
        ))}
      </div>

      {/* Idea */}
      <label style={labelStyle} htmlFor="idea">Product idea</label>
      <textarea
        id="idea"
        value={idea}
        onChange={e => setIdea(e.target.value.slice(0, MAX_IDEA_LENGTH))}
        onBlur={() => { setTouched(true); setFocusedField(null); }}
        onFocus={() => setFocusedField("idea")}
        maxLength={MAX_IDEA_LENGTH}
        rows={4}
        disabled={disabled}
        placeholder="Describe your product idea in detail…"
        aria-invalid={!!ideaError}
        aria-describedby={ideaError ? "idea-error" : undefined}
        style={fieldStyle("idea", !!ideaError)}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, marginTop: 4 }}>
        {ideaError
          ? <p id="idea-error" style={{ fontSize: 12, color: "var(--error)", margin: 0 }}>{ideaError}</p>
          : <span />}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 80, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(charPct * 100, 100)}%`, background: charPct > 0.85 ? "var(--risk-amber)" : "var(--primary)", borderRadius: 2, transition: "width 0.2s" }} />
          </div>
          <span style={{ fontSize: 11, color: charPct > 0.85 ? "var(--risk-amber)" : "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
            {idea.length} / {MAX_IDEA_LENGTH}
          </span>
        </div>
      </div>

      {/* Constraints */}
      <label style={labelStyle} htmlFor="constraints">
        Constraints <span style={{ textTransform: "none", fontWeight: 400, opacity: 0.6 }}>(optional)</span>
      </label>
      <textarea
        id="constraints"
        value={constraints}
        onChange={e => setConstraints(e.target.value.slice(0, MAX_CONSTRAINTS_LENGTH))}
        onFocus={() => setFocusedField("constraints")}
        onBlur={() => setFocusedField(null)}
        maxLength={MAX_CONSTRAINTS_LENGTH}
        rows={2}
        disabled={disabled}
        placeholder="e.g. Team of 4, 6-week timeline, no paid APIs…"
        style={{ ...fieldStyle("constraints"), marginBottom: 16 }}
      />

      {/* Sprint capacity */}
      <label style={labelStyle} htmlFor="capacity">Sprint capacity (story points)</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <input
          id="capacity"
          type="number"
          min={1} max={100} step={1}
          value={capacityPerSprint}
          onChange={e => setCapacityPerSprint(Number(e.target.value))}
          onFocus={() => setFocusedField("capacity")}
          onBlur={() => setFocusedField(null)}
          disabled={disabled}
          style={{ ...fieldStyle("capacity"), width: 100, resize: undefined, marginBottom: 0 }}
        />
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>points per sprint</span>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => { setTouched(true); if (readyToSubmit) onSubmit(idea, constraints, capacityPerSprint); }}
          disabled={!readyToSubmit}
          style={{
            fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            padding: "11px 28px", borderRadius: "var(--radius-sm)", border: "none",
            background: readyToSubmit ? "linear-gradient(135deg,var(--primary) 0%,#4f46e5 100%)" : "var(--surface)",
            color: readyToSubmit ? "white" : "var(--text-dim)",
            cursor: readyToSubmit ? "pointer" : "not-allowed",
            boxShadow: readyToSubmit ? "0 4px 16px var(--primary-glow)" : "none",
            transition: "all 0.2s",
          }}
        >
          {disabled ? "⏳ Generating…" : "Generate scope →"}
        </button>
        {idea.trim().length > 0 && !disabled && (
          <button onClick={() => { setIdea(""); setConstraints(""); setTouched(false); }} style={{
            fontFamily: "inherit", fontSize: 13, color: "var(--text-dim)",
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "9px 14px", cursor: "pointer", transition: "all 0.15s",
          }}>✕ Clear</button>
        )}
      </div>
    </div>
  );
}

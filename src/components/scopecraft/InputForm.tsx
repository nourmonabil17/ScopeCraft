// src/components/scopecraft/InputForm.tsx
"use client";

import { useState } from "react";

export interface InputFormProps {
  onSubmit: (idea: string, constraints: string) => void;
  disabled?: boolean;
}

export function InputForm({ onSubmit, disabled }: InputFormProps) {
  const [idea, setIdea] = useState("");
  const [constraints, setConstraints] = useState("");
  const [touched, setTouched] = useState(false);

  const ideaError = touched && idea.trim().length < 5
    ? "Please describe your idea in at least 5 characters."
    : null;

  return (
    <div>
      <label htmlFor="idea">Product idea</label>
      <textarea
        id="idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onBlur={() => setTouched(true)}
        rows={3}
        aria-invalid={!!ideaError}
        aria-describedby={ideaError ? "idea-error" : undefined}
        style={{ width: "100%", marginBottom: 4 }}
      />
      {ideaError && (
        <p id="idea-error" style={{ color: "#a00", fontSize: 14 }}>
          {ideaError}
        </p>
      )}

      <label htmlFor="constraints">Constraints (optional)</label>
      <textarea
        id="constraints"
        value={constraints}
        onChange={(e) => setConstraints(e.target.value)}
        rows={2}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <button
        onClick={() => {
          setTouched(true);
          if (idea.trim().length >= 5) onSubmit(idea, constraints);
        }}
        disabled={disabled}
      >
        {disabled ? "Generating..." : "Generate Plan"}
      </button>
    </div>
  );
}

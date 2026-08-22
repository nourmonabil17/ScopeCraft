"use client";

import { useState } from "react";
import { ScopeCraftResponse } from "@/lib/scopecraft/schema";

const TABS = ["📊 Summary", "PRD", "User Stories", "📋 Backlog", "Risks", "Sprint Plan"] as const;
type Tab = typeof TABS[number];

const pill = (color: string, bg: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color, background: bg,
  padding: "2px 8px", borderRadius: 10, display: "inline-block", whiteSpace: "nowrap",
});

function riskColor(level: string) {
  if (level === "high")   return { color: "#f87171", bg: "rgba(248,113,113,0.12)" };
  if (level === "medium") return { color: "var(--risk-amber)", bg: "var(--risk-bg)" };
  return { color: "var(--success)", bg: "rgba(52,211,153,0.1)" };
}

export function ResultView({ data }: { data: ScopeCraftResponse }) {
  const [activeTab, setActiveTab] = useState<Tab>("📊 Summary");
  const [copied, setCopied] = useState(false);

  const copyCurrentTab = () => {
    let text = "";
    if (activeTab === "📊 Summary")  text = `Problem: ${data.problem}\nTarget: ${data.target_user}\nGoals:\n${data.goals.map(g=>`- ${g}`).join("\n")}`;
    if (activeTab === "PRD")         text = `Requirements:\n${data.requirements.map(r=>`- ${r}`).join("\n")}\n\nAcceptance Criteria:\n${data.acceptance_criteria.map(a=>`- ${a}`).join("\n")}`;
    if (activeTab === "User Stories") text = data.user_stories.map(s=>`As a ${s.as_a}, I want ${s.i_want}, so that ${s.so_that}`).join("\n\n");
    if (activeTab === "📋 Backlog")  text = data.user_stories.map((s,i)=>`${i+1}. [${s.id}] As a ${s.as_a}, I want ${s.i_want} | Value: ${s.value}/10 | Effort: ${s.effort}pts`).join("\n");
    if (activeTab === "Risks")       text = data.risks.map(r=>`${r.id}: ${r.description} (impact: ${r.impact}, likelihood: ${r.likelihood})`).join("\n");
    if (activeTab === "Sprint Plan") text = data.sprint.map(s=>`Sprint ${s.sprint} | ${s.story_id} | Priority: ${s.priority_score} | Effort: ${s.effort}pts`).join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  };

  const exportMD = () => {
    const md = `# Product Scope\n\n## Problem\n${data.problem}\n\n**Target user:** ${data.target_user}\n\n## Goals\n${data.goals.map(g=>`- ${g}`).join("\n")}\n\n## Non-Goals\n${data.non_goals.map(g=>`- ${g}`).join("\n")}\n\n## Requirements\n${data.requirements.map(r=>`- ${r}`).join("\n")}\n\n## User Stories\n${data.user_stories.map(s=>`- As a ${s.as_a}, I want ${s.i_want}, so that ${s.so_that}`).join("\n")}\n\n## Risks\n${data.risks.map(r=>`- ${r.description} (impact: ${r.impact})`).join("\n")}\n\n## Sprint Plan\n${data.sprint.map(s=>`- Sprint ${s.sprint}: ${s.story_id} (effort: ${s.effort}pts)`).join("\n")}`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md],{type:"text/markdown"})); a.download="scope.md"; a.click();
  };

  const exportJSON = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})); a.download="scope.json"; a.click();
  };

  const tabBar: React.CSSProperties = { display:"flex", alignItems:"flex-end", justifyContent:"space-between", borderBottom:"1px solid var(--border)", gap:8 };
  const tabContent: React.CSSProperties = { background:"var(--bg-card)", border:"1px solid var(--border)", borderTop:"none", borderRadius:"0 0 var(--radius) var(--radius)", padding:24, minHeight:200, transition:"background 0.25s" };
  const cardBase: React.CSSProperties = { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"14px 18px", marginBottom:10 };

  return (
    <div>
      {/* Tab bar */}
      <div style={tabBar}>
        <div style={{ display:"flex", overflowX:"auto", scrollbarWidth:"none" }}>
          {TABS.map(tab => (
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{
              fontFamily:"inherit", fontSize:13, fontWeight:500,
              color: activeTab===tab ? "var(--primary-bright)" : "var(--text-dim)",
              background: activeTab===tab ? "rgba(99,102,241,0.06)" : "transparent",
              border:"none", padding:"10px 16px", cursor:"pointer", whiteSpace:"nowrap",
              borderBottom: activeTab===tab ? "2px solid var(--primary)" : "2px solid transparent",
              transition:"all 0.15s",
            }}>{tab}</button>
          ))}
        </div>
        <button onClick={copyCurrentTab} style={{
          fontFamily:"inherit", fontSize:12, fontWeight:500,
          color: copied ? "var(--success)" : "var(--text-dim)",
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:"var(--radius-sm)", padding:"5px 12px", cursor:"pointer",
          marginBottom:4, whiteSpace:"nowrap", transition:"all 0.15s",
        }}>{copied ? "✓ Copied!" : "Copy"}</button>
      </div>

      {/* Content */}
      <div style={tabContent}>

        {/* 📊 Summary */}
        {activeTab === "📊 Summary" && (
          <div>
            {/* Stat cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
              {[
                { label:"User Stories", value: data.user_stories.length, color:"var(--primary)" },
                { label:"Sprints",      value: Math.max(...data.sprint.map(s=>s.sprint),0), color:"var(--cyan)" },
                { label:"Risks",        value: data.risks.length, color:"var(--risk-amber)" },
                { label:"Total Effort", value: `${data.sprint.reduce((a,s)=>a+s.effort,0)} pts`, color:"var(--success)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:16 }}>
                  <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color, marginBottom:6 }}>{label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:"var(--text)", fontFamily:"'Space Grotesk',sans-serif" }}>{value}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Problem</h3>
            <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.7, marginBottom:16 }}>{data.problem}</p>
            <h3 style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Target User</h3>
            <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.7, marginBottom:16 }}>{data.target_user}</p>
            <h3 style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Goals</h3>
            <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:6 }}>
              {data.goals.map((g,i)=>(
                <li key={i} style={{ fontSize:14, color:"var(--text-muted)", display:"flex", gap:10 }}>
                  <span style={{ color:"var(--primary)", flexShrink:0 }}>✓</span>{g}
                </li>
              ))}
            </ul>
            {data.non_goals.length > 0 && <>
              <h3 style={{ fontSize:12, fontWeight:600, color:"var(--text)", margin:"16px 0 8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Non-Goals</h3>
              <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:6 }}>
                {data.non_goals.map((g,i)=>(
                  <li key={i} style={{ fontSize:14, color:"var(--text-muted)", display:"flex", gap:10 }}>
                    <span style={{ color:"var(--text-dim)", flexShrink:0 }}>✕</span>{g}
                  </li>
                ))}
              </ul>
            </>}
          </div>
        )}

        {/* PRD */}
        {activeTab === "PRD" && (
          <div>
            <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--primary-bright)", marginBottom:12 }}>Requirements</p>
            <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
              {data.requirements.map((r,i)=>(
                <li key={i} style={{ ...cardBase, display:"flex", gap:12, alignItems:"flex-start", fontSize:14, color:"var(--text-muted)", lineHeight:1.6 }}>
                  <span style={{ color:"var(--primary)", fontWeight:700, fontSize:11, flexShrink:0, marginTop:2 }}>{String(i+1).padStart(2,"0")}</span>{r}
                </li>
              ))}
            </ul>
            <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--primary-bright)", marginBottom:12 }}>Acceptance Criteria</p>
            <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:8 }}>
              {data.acceptance_criteria.map((a,i)=>(
                <li key={i} style={{ fontSize:14, color:"var(--text-muted)", display:"flex", gap:10, lineHeight:1.6 }}>
                  <span style={{ color:"var(--success)", flexShrink:0 }}>✓</span>{a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* User Stories */}
        {activeTab === "User Stories" && (
          <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:12 }}>
            {data.user_stories.map(s=>(
              <li key={s.id} style={cardBase}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--primary)", opacity:0.7, letterSpacing:"0.05em" }}>{s.id}</span>
                  <span style={pill("var(--success)","rgba(52,211,153,0.1)")}>Value {s.value}/10</span>
                  <span style={pill("var(--risk-amber)","var(--risk-bg)")}>Risk {s.risk}/10</span>
                  <span style={pill("var(--primary-bright)","var(--primary-glow)")}>Effort {s.effort}pts</span>
                </div>
                <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.65, marginBottom:8 }}>
                  As a <strong style={{ color:"var(--text)" }}>{s.as_a}</strong>, I want <strong style={{ color:"var(--text)" }}>{s.i_want}</strong>, so that {s.so_that}
                </p>
                <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:4 }}>
                  {s.acceptance_criteria.map((ac,i)=>(
                    <li key={i} style={{ fontSize:12, color:"var(--text-dim)", display:"flex", gap:8 }}>
                      <span style={{ color:"var(--success)" }}>✓</span>{ac}
                    </li>
                  ))}
                </ul>
                {s.dependencies && s.dependencies.length > 0 && (
                  <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:8 }}>Depends on: {s.dependencies.join(", ")}</div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* 📋 Backlog */}
        {activeTab === "📋 Backlog" && (
          <div>
            <p style={{ fontSize:12, color:"var(--text-dim)", marginBottom:16 }}>All stories sorted by priority score — ready to copy into Jira, Linear, or Notion.</p>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--border)" }}>
                    {["ID","Story","Value","Risk","Effort","Priority"].map(h=>(
                      <th key={h} style={{ textAlign:"left", padding:"8px 12px", fontSize:10, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--text-dim)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.user_stories]
                    .sort((a,b)=>(data.priority[b.id]??0)-(data.priority[a.id]??0))
                    .map(s=>{
                      const rc = riskColor(s.risk > 6 ? "high" : s.risk > 3 ? "medium" : "low");
                      return (
                        <tr key={s.id} style={{ borderBottom:"1px solid var(--border)" }}>
                          <td style={{ padding:"10px 12px", color:"var(--primary)", fontWeight:600, fontSize:11, whiteSpace:"nowrap" }}>{s.id}</td>
                          <td style={{ padding:"10px 12px", color:"var(--text-muted)", maxWidth:280 }}>As a {s.as_a}, I want {s.i_want}</td>
                          <td style={{ padding:"10px 12px" }}><span style={pill("var(--success)","rgba(52,211,153,0.1)")}>{s.value}/10</span></td>
                          <td style={{ padding:"10px 12px" }}><span style={pill(rc.color,rc.bg)}>{s.risk}/10</span></td>
                          <td style={{ padding:"10px 12px", color:"var(--text-muted)", whiteSpace:"nowrap" }}>{s.effort}pts</td>
                          <td style={{ padding:"10px 12px", color:"var(--text)", fontWeight:600 }}>{(data.priority[s.id]??0).toFixed(1)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Risks */}
        {activeTab === "Risks" && (
          <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:10 }}>
            {data.risks.map(r=>{
              const ic = riskColor(r.impact);
              const lc = riskColor(r.likelihood);
              return (
                <li key={r.id} style={{ background:"var(--risk-bg)", border:"1px solid var(--risk-border)", borderRadius:"var(--radius-sm)", padding:"14px 18px" }}>
                  <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--risk-amber)", opacity:0.7 }}>{r.id}</span>
                    <span style={pill(ic.color,ic.bg)}>Impact: {r.impact}</span>
                    <span style={pill(lc.color,lc.bg)}>Likelihood: {r.likelihood}</span>
                  </div>
                  <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.65 }}>⚠ {r.description}</p>
                </li>
              );
            })}
          </ul>
        )}

        {/* Sprint Plan */}
        {activeTab === "Sprint Plan" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
            {data.sprint.map((s,i)=>(
              <div key={i} style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:16, display:"flex", flexDirection:"column", gap:8 }}>
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--primary)", background:"var(--primary-glow)", padding:"2px 8px", borderRadius:10, alignSelf:"flex-start" }}>Sprint {s.sprint}</span>
                <span style={{ fontSize:11, fontWeight:600, color:"var(--text)", letterSpacing:"0.03em" }}>{s.story_id}</span>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <span style={pill("var(--success)","rgba(52,211,153,0.1)")}>Priority {s.priority_score}</span>
                  <span style={pill("var(--primary-bright)","var(--primary-glow)")}>{s.effort}pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export row */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
        <span style={{ fontSize:12, color:"var(--text-dim)" }}>Export as</span>
        {[["JSON", exportJSON], ["Markdown", exportMD]].map(([label, fn]) => (
          <button key={label as string} onClick={fn as ()=>void} style={{
            fontFamily:"inherit", fontSize:12, fontWeight:500, color:"var(--text-muted)",
            background:"var(--bg-card)", border:"1px solid var(--border)",
            borderRadius:"var(--radius-sm)", padding:"5px 12px", cursor:"pointer", transition:"all 0.15s",
          }}>{label as string}</button>
        ))}
      </div>
    </div>
  );
}

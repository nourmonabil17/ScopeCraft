// src/lib/scopecraft/taxonomy.ts
//
// Domain taxonomy — the controlled vocabulary used across generated content.
// Owned jointly: Yasmin defines the domain rules, Youssef wires them into the
// deterministic pipeline. Nothing here calls an AI provider.

import { MOSCOW_BUCKETS, type MoscowBucket } from "./schema";
import { normalizeForMatching } from "./prompt-guard";

export const IMPACT_LEVELS = ["low", "medium", "high"] as const;
export const LIKELIHOOD_LEVELS = ["low", "medium", "high"] as const;

export type ImpactLevel = (typeof IMPACT_LEVELS)[number];
export type LikelihoodLevel = (typeof LIKELIHOOD_LEVELS)[number];

export { MOSCOW_BUCKETS };
export type { MoscowBucket };

/**
 * MoSCoW bands, calibrated for priorityScore = (value + risk) / points where
 * value and risk are 1..5 and points are 1..13.
 *
 * That gives a theoretical range of 10/1 = 10.0 at the top and 2/13 = 0.15 at
 * the bottom, with a typical mid-sized story — value 3, risk 3, 5 points —
 * landing at 1.2. The thresholds below place that typical story in "should",
 * which is the intended centre of the distribution.
 *
 * These constants and the estimation ranges in schema.ts are a single unit:
 * widening `value`/`risk`/`points` without re-deriving these bands silently
 * collapses every story into one bucket.
 */
export const MOSCOW_THRESHOLDS = {
  must: 2.2,
  should: 1.3,
  could: 0.7,
} as const;

export function toMoscow(score: number): MoscowBucket {
  if (!Number.isFinite(score)) {
    throw new Error("moscow classification requires a finite score");
  }
  if (score >= MOSCOW_THRESHOLDS.must) return "must";
  if (score >= MOSCOW_THRESHOLDS.should) return "should";
  if (score >= MOSCOW_THRESHOLDS.could) return "could";
  return "wont";
}

/** Required PRD sections — every generated PRD must include these. */
export const REQUIRED_PRD_SECTIONS = [
  "problem",
  "target_user",
  "goals",
  "non_goals",
  "requirements",
] as const;

export type RequiredPrdSection = (typeof REQUIRED_PRD_SECTIONS)[number];

// ---------- Domain guardrail (deterministic, server-side) ----------
//
// Rule 4 in service.ts's SYSTEM_RULES asks the model to self-report a request
// that isn't software product planning, returning an {"out_of_domain": true}
// envelope. That is a prompt instruction, not a guarantee: a model that
// ignores it and answers directly — in otherwise valid PRD shape — passes
// every check upstream of this file, because ModelReplySchema only checks
// shape, not content. Recorded as an open gap in docs/decision-log.md, row 30:
// "A server-side domain classifier would close this and is not built."
//
// This is that classifier. It is a small, deterministic keyword heuristic and
// deliberately NOT a second model call: the rule this codebase follows
// everywhere else is that the model's judgement is advisory and the code is
// authoritative (see applyDeterministicTools in service.ts) — a classifier
// that itself depends on an LLM would just move the same trust problem down
// one level instead of closing it.
//
// Two call sites, both wired in service.ts:
//   - classifyRequestDomain — on the raw idea + constraints, before any
//     provider is called. Mirrors getClarification in schema.ts: reject for
//     free before spending a generation.
//   - findOffDomainLeak — on every free-text field of a SUCCESSFUL
//     generation. This is the one that actually closes the gap above, because
//     it does not depend on the model choosing to cooperate with Rule 4.

/**
 * Off-domain requests share a shape regardless of topic: a question directed
 * AT the assistant, asking for a personal judgement or a literal answer,
 * rather than a description of a product to build. These patterns match that
 * shape for the three domains Rule 4 names explicitly (medical, legal,
 * financial) plus general personal-advice chat.
 */
const ADVICE_SEEKING_PATTERNS: readonly RegExp[] = [
  // Medical
  /\b(diagnos(e|is|ed)|prescri(be|ption)|dosage|what (medication|medicine|drug)s? (should|do) i|symptoms? of my|do i have (cancer|diabetes|covid))\b/i,
  // Legal
  /\b(should i sue|can i sue|is it legal for me to|am i liable|do i need a lawyer|will i (go to jail|be arrested|be sued))\b/i,
  // Financial / investment / tax
  /\b(what stocks? should i (buy|sell)|should i invest (in|my)|how much (tax )?do i owe|is .{0,40} a good investment)\b/i,
  // General personal-advice chit-chat, no product framing at all
  /\b(what should i do about my (relationship|marriage|life)|should i (quit my job|break up|get a divorce))\b/i,
];

/**
 * Content markers that indicate a field is carrying literal advice rather
 * than a product requirement — phrasing that ANSWERS a question rather than
 * describing what software should do. Distinct from ADVICE_SEEKING_PATTERNS
 * (which matches a user's question) because model output is written as
 * statements, not questions: "Take 400mg every 6 hours" never matches "what
 * medication should i take", but is exactly the leak this exists to catch.
 */
const LEAKED_ADVICE_PATTERNS: readonly RegExp[] = [
  /\b\d+\s?(mg|ml|mcg)\b.{0,30}\b(every|per|once|twice)\b/i, // dosing instructions
  /\byou (have been diagnosed|are diagnosed|have)( with)?\s+[a-z\s]{0,30}?(cancer|diabetes|disease|syndrome)\b/i,
  /\byou (should|are advised to) (sue|file (a|for)|consult a lawyer)\b/i,
  /\byou are (legally )?liable for\b/i,
  /\b(invest|buy) (in )?(these|the following) stocks?\b/i,
  /\byour (tax liability|estimated tax) is\b/i,
];

/**
 * Words that mark text as describing a PRODUCT rather than answering a
 * personal question. Presence of any of these is a strong enough signal that
 * the classifier stands down — a "medication reminder app" or a "tax-filing
 * platform" are legitimate software ideas that happen to mention medicine or
 * tax, and must not be punished for it.
 *
 * Used ONLY on the request-side check. The output-side check runs per field
 * (see findOffDomainLeak) precisely so a single leaked-advice sentence inside
 * an otherwise product-shaped plan is not shielded by its neighbours.
 */
const PRODUCT_SIGNAL_PATTERN =
  /\b(app|platform|system|tool|software|product|feature|dashboard|website|api|users?|build (a|an|me)|mvp|prototype)\b/i;

export interface DomainCheckResult {
  readonly offDomain: boolean;
  readonly matchedPattern?: string;
}

/**
 * REQUEST-side check. Run once, on the raw idea + constraints, before any
 * provider is called. Biased toward NOT rejecting: any product-shaped
 * language stands the check down, so this only fires on requests that read as
 * pure personal advice-seeking with no software framing anywhere.
 */
export function classifyRequestDomain(text: string): DomainCheckResult {
  const normalized = normalizeForMatching(text);
  if (PRODUCT_SIGNAL_PATTERN.test(normalized)) {
    return { offDomain: false };
  }
  for (const pattern of ADVICE_SEEKING_PATTERNS) {
    if (pattern.test(normalized)) {
      return { offDomain: true, matchedPattern: pattern.source };
    }
  }
  return { offDomain: false };
}

/**
 * OUTPUT-side check. Run per field, on every free-text string in a generated
 * plan. No product-signal bypass: a plan that is mostly legitimate but leaks
 * one sentence of real advice into one field is still a leak, and the point
 * of this check is specifically to catch that regardless of its siblings.
 */
export function classifyOutputField(text: string): DomainCheckResult {
  const normalized = normalizeForMatching(text);
  for (const pattern of LEAKED_ADVICE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { offDomain: true, matchedPattern: pattern.source };
    }
  }
  return { offDomain: false };
}

/** The shape findOffDomainLeak and extractPlanTextFields need from a plan. */
export interface PlanTextSource {
  problem: string;
  target_user: string;
  goals: readonly string[];
  non_goals: readonly string[];
  requirements: readonly string[];
  acceptance_criteria: readonly string[];
  user_stories: readonly {
    as_a: string;
    i_want: string;
    so_that: string;
    acceptance_criteria: readonly string[];
  }[];
}

/**
 * Every free-text field a generated plan can carry, flattened — the list
 * classifyOutputField is run over. Story-level fields are included because a
 * leak is exactly as likely inside "acceptance_criteria" as inside
 * "requirements".
 */
export function extractPlanTextFields(result: PlanTextSource): string[] {
  return [
    result.problem,
    result.target_user,
    ...result.goals,
    ...result.non_goals,
    ...result.requirements,
    ...result.acceptance_criteria,
    ...result.user_stories.flatMap((story) => [
      story.as_a,
      story.i_want,
      story.so_that,
      ...story.acceptance_criteria,
    ]),
  ];
}

/**
 * Runs the OUTPUT check over an entire generated plan. Returns the first
 * match found — one leak is enough to reject the whole response, the same
 * way a single OWASP LLM01 fence bypass would be treated as a failure of the
 * whole request rather than patched around.
 */
export function findOffDomainLeak(result: PlanTextSource): DomainCheckResult {
  for (const field of extractPlanTextFields(result)) {
    const check = classifyOutputField(field);
    if (check.offDomain) return check;
  }
  return { offDomain: false };
}
// tests/api/env-documentation.test.ts
//
// Every environment variable the shipped application reads must appear in
// .env.example (owner: Yousef).
//
// NOT A STYLE CHECK. `DAILY_PLAN_LIMIT` was read by src/lib/quota.ts, absent
// from the template, and asserted as present by two separate documents —
// docs/project-plan.md item 3.4.3, ticked, with the note "Add to .env.example";
// and docs/release-checklist.md, which claims the template is "up to date with
// all required variable names". Someone who configured a deployment from the
// template got a green build and a quota that did not work.
//
// Fixing the one variable would have left the next one free to repeat it, so
// the guard is on the class rather than the instance. It lives in the node Jest
// project, which CI already runs, so it needs no workflow change.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

/**
 * Auth.js reads these by its own AUTH_<PROVIDER>_ID/SECRET convention, so they
 * never appear as a `process.env` expression in src/ and cannot be discovered
 * by scanning for one. src/auth.ts:41-48 explains the convention.
 *
 * An explicit list rather than a pattern: a name has to be typed in here on
 * purpose, which is the point. A regex would quietly absorb the next variable
 * someone forgets to document.
 */
const CONVENTION_ONLY = [
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
];

/**
 * Set by the build, never by a person deploying this. `NODE_ENV` is the
 * framework's; `DOCKER_BUILD` is set at Dockerfile:42 to switch on standalone
 * output. Documenting either in .env.example would invite someone to set it.
 */
const BUILD_ONLY = ["NODE_ENV", "DOCKER_BUILD"];

/**
 * Every `process.env.NAME` in the given files.
 *
 * A grep, not a parser, so it also matches names written inside comments and
 * strings. That is the right size for the job — a TypeScript AST walk to avoid
 * a false positive that shows up as a failing test with the name printed is a
 * worse trade — but it means prose in a comment should name a real variable
 * rather than a placeholder like `process.env.EXAMPLE`.
 */
function readVarsFrom(files: string[]): Set<string> {
  const found = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      found.add(match[1]);
    }
  }
  return found;
}

it("documents every variable the application reads in .env.example", () => {
  // readdirSync recursive rather than a glob dependency: stable since Node 20.1,
  // already present, and this is the only place in the repository that walks a
  // tree. next.config.js is appended because it reads NODE_ENV and DOCKER_BUILD
  // and is shipped configuration, not a script.
  const sources = readdirSync(join(ROOT, "src"), { recursive: true, encoding: "utf8" })
    .filter((relative) => /\.tsx?$/.test(relative))
    .map((relative) => join(ROOT, "src", relative))
    .concat(join(ROOT, "next.config.js"));

  const template = readFileSync(join(ROOT, ".env.example"), "utf8");

  const undocumented = [...readVarsFrom(sources)]
    .filter((name) => !CONVENTION_ONLY.includes(name))
    .filter((name) => !BUILD_ONLY.includes(name))
    // A commented-out row still counts as documented — .env.example deliberately
    // ships AUTH_URL commented, because setting it locally breaks the callback.
    .filter((name) => !new RegExp(`^#?\\s*${name}=`, "m").test(template))
    .sort();

  expect(undocumented).toEqual([]);
});

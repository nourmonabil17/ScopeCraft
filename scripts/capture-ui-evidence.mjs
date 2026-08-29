// scripts/capture-ui-evidence.mjs
//
// UI, responsive and accessibility evidence capture (owner: Joe; automated by Yousef).
//
//   npm run build && npm run capture:ui
//
// WHY THIS EXISTS
// The Product UI acceptance row requires "screen recording or screenshots",
// "responsive views" and "loading/error demonstrations". None existed: a repo-wide
// search for *.png / *.gif / *.mp4 / *.mov returned nothing. This script produces
// them from the real production build, by driving a real browser.
//
// HOW
// Headless Chrome over the DevTools Protocol, using Node 22's global WebSocket.
// No Playwright, no Puppeteer, no new dependency — the whole driver is below.
// Screens are captured by actually filling the form and submitting it, so the
// loading and success shots are of real states, not of components rendered in
// isolation with fake props.
//
// The success and loading captures make one real provider call each.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { mintCaptureSession } from "./mint-session.mjs";

// /scopecraft requires a session (src/app/scopecraft/layout.tsx). Rather than
// bypassing that with a flag the app would have to carry into production, the
// capture mints a real Auth.js session cookie with the same AUTH_SECRET the
// server was started with — so what gets screenshotted is the authenticated
// app, reached the way a signed-in visitor reaches it.
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  console.error(
    "FATAL: AUTH_SECRET is not set. Export the same value the server under " +
      "capture was started with, or every page will redirect to /login."
  );
  process.exit(1);
}

const BASE = process.env.UI_BASE_URL ?? "http://127.0.0.1:3200";
const BAD_BASE = process.env.UI_BAD_BASE_URL ?? "http://127.0.0.1:3201";
const OUT = "docs/evidence/ui/shots";
const PORT = 9333;

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error("FATAL: no Chrome/Chromium found. Install Google Chrome and retry.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- CDP ------

let ws;
let nextId = 1;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function connect(wsUrl) {
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
}

/** Chrome needs a moment before its debugging endpoint answers. */
async function chromeEndpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never became ready");
}

let session;

async function evaluate(expression, awaitPromise = false) {
  const { result, exceptionDetails } = await send(
    "Runtime.evaluate",
    { expression, awaitPromise, returnByValue: true },
    session
  );
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? "evaluate failed");
  return result.value;
}

async function viewport({ width, height, mobile = false }) {
  await send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: 2, mobile },
    session
  );
}

async function colorScheme(value) {
  await send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value }] },
    session
  );
}

/**
 * Installs a session cookie so the gated pages render instead of redirecting.
 *
 * Both capture servers are on 127.0.0.1, differing only by port, and cookies
 * ignore ports — so one call covers BASE and BAD_BASE. The cookie name has no
 * `__Secure-` prefix because the capture runs over plain http; Auth.js picks
 * the same unprefixed name under those conditions.
 */
async function signInAsCaptureUser() {
  // Minting moved to scripts/mint-session.mjs when the API route started
  // requiring a session (Module 3). It is shared with capture-evidence.sh,
  // which cannot call encode() from bash, and it upserts a real users row —
  // the token carries that row's id as `uid`, which is what plans.user_id
  // references. A cookie with no uid passes nothing: every generation would
  // return 401 and the whole capture would record the login redirect.
  const { cookie, name } = await mintCaptureSession({ secret: AUTH_SECRET });

  await send("Network.enable", {}, session);
  await send(
    "Network.setCookie",
    {
      name,
      value: cookie,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    session
  );
}

/**
 * `readySelector` is what "mounted" means for this page. It defaults to the
 * intake form because almost every capture is of /scopecraft; /login has no
 * form at all, so waiting for one there would time out on a page that rendered
 * perfectly.
 */
async function goto(url, readySelector = "form") {
  await send("Page.navigate", { url }, session);
  // Poll for React to have mounted rather than guessing at a fixed delay.
  for (let i = 0; i < 80; i += 1) {
    try {
      const ready = await evaluate(
        `document.readyState === 'complete' && ` +
          `!!document.querySelector(${JSON.stringify(readySelector)})`
      );
      if (ready) {
        await sleep(400); // let fonts settle so text is not captured mid-swap
        return;
      }
    } catch {
      /* navigating */
    }
    await sleep(150);
  }
  // The most likely reason a page with a form never shows one is that the
  // session cookie was rejected and the gate bounced us. Say so, rather than
  // leaving a bare timeout to be misread as a slow build.
  const landed = await evaluate(`location.pathname`).catch(() => "?");
  if (landed === "/login" && !url.endsWith("/login")) {
    throw new Error(
      `redirected to /login while loading ${url} — AUTH_SECRET does not match ` +
        `the server's, so the minted session cookie was rejected`
    );
  }
  throw new Error(`page never became ready: ${url}`);
}

/** Seed theme/locale before first paint, the same way a returning visitor would. */
async function seed({ theme = "system", locale = "en" } = {}) {
  await goto(`${BASE}/scopecraft`);
  await evaluate(`
    localStorage.setItem('scopecraft.theme', ${JSON.stringify(theme)});
    localStorage.setItem('scopecraft.locale', ${JSON.stringify(locale)});
    // Otherwise the very first navigation below opens WelcomeModal, which
    // this script never dismisses — every subsequent screenshot would carry
    // an unrelated popup on top of the state it's actually trying to show.
    // The modal has its own dedicated coverage in WelcomeModal.test.tsx.
    localStorage.setItem('scopecraft.welcomeSeen', '1');
    true
  `);
}

let shotCount = 0;
let generationAttempts = 0;
let capacityReadout = '';
async function shot(name, note) {
  const { data } = await send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false },
    session
  );
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  shotCount += 1;
  console.log(`  ✓ ${name}.png — ${note}`);
}

const VALID_IDEA =
  "A web app that helps university students form study groups by matching them on course, availability and preferred study style.";

async function fillForm() {
  // Set values through the native setter so React's onChange actually fires;
  // assigning .value directly updates the DOM but not React state.
  await evaluate(`
    (() => {
      const set = (el, v) => {
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(document.querySelector('textarea[name="idea"]'), ${JSON.stringify(VALID_IDEA)});
      set(document.querySelector('textarea[name="constraints"]'), 'Team of four, five weeks, no paid APIs.');
      return true;
    })()
  `);
  await sleep(200);
}

const submit = () =>
  evaluate(`document.querySelector('form button[type="submit"]').click(), true`);

/** Wait until the page shows one of the terminal states. */
async function waitForResult(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await evaluate(`
      (() => {
        if (document.querySelector('[data-testid="error-state"]')) return 'error';
        if (document.querySelector('[data-testid="validation-error-state"]')) return 'validation';
        if (document.querySelector('[data-testid="domain-refusal-state"]')) return 'refusal';
        if (document.querySelector('[data-testid="result-view"]')) return 'success';
        return null;
      })()
    `);
    if (state) return state;
    await sleep(500);
  }
  return "timeout";
}

// ---------------------------------------------------------------- audit ----

/** Runs entirely in the page. Returns measured facts, not opinions. */
const AUDIT_EXPRESSION = `
(() => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = (rgb) => 0.2126*srgb(rgb[0]) + 0.7152*srgb(rgb[1]) + 0.0722*srgb(rgb[2]);
  const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0,3).map(Number);
  const ratio = (fg, bg) => {
    const a = lum(parse(fg)), b = lum(parse(bg));
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)')) return bg;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };

  // --- contrast on real rendered text ---
  const samples = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('label,p,h1,h2,h3,button,a,span,input,textarea')) {
    const text = (el.textContent || '').trim();
    if (!text || text.length > 60) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const key = cs.color + '|' + bgOf(el) + '|' + cs.fontSize + '|' + cs.fontWeight;
    if (seen.has(key)) continue;
    seen.add(key);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const r = ratio(cs.color, bgOf(el));
    samples.push({ text: text.slice(0, 34), tag: el.tagName.toLowerCase(),
                   size: cs.fontSize, ratio: r, need: large ? 3 : 4.5,
                   pass: r >= (large ? 3 : 4.5) });
  }

  // --- accessible names on controls ---
  const named = (el) => !!(
    el.getAttribute('aria-label') ||
    el.getAttribute('aria-labelledby') ||
    (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
    el.closest('label') ||
    ((el.tagName === 'BUTTON' || el.tagName === 'A') && (el.textContent || '').trim())
  );
  const controls = [...document.querySelectorAll('input,textarea,select,button,a[href]')]
    .filter((el) => el.getAttribute('aria-hidden') !== 'true');
  const unnamed = controls.filter((el) => !named(el))
    .map((el) => el.tagName.toLowerCase() + (el.name ? '[name=' + el.name + ']' : ''));

  // --- images ---
  const imgs = [...document.querySelectorAll('img')];
  const imgNoAlt = imgs.filter((i) => i.getAttribute('alt') === null).length;
  const imgNoDims = imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length;

  // --- heading order ---
  const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .map((h) => Number(h.tagName[1]));
  let skips = 0;
  for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i-1] > 1) skips += 1;

  // --- landmarks ---
  const landmarks = {
    banner: !!document.querySelector('header, [role=banner]'),
    main: !!document.querySelector('main, [role=main]'),
    h1: document.querySelectorAll('h1').length
  };

  // --- keyboard reachability ---
  const focusable = [...document.querySelectorAll(
    'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]'
  )].filter((el) => el.getAttribute('aria-hidden') !== 'true' && el.tabIndex >= 0);

  return JSON.stringify({
    theme: document.documentElement.className || 'light',
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    contrast: samples,
    worst: samples.filter(s => !s.pass),
    controls: controls.length,
    unnamed,
    imgs: imgs.length, imgNoAlt, imgNoDims,
    headingSkips: skips, headingLevels: levels,
    landmarks,
    focusableCount: focusable.length
  });
})()
`;

// ------------------------------------------------------------------ run ----

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--user-data-dir=/tmp/scopecraft-ui-capture",
]);
chrome.on("error", (e) => {
  console.error("FATAL: could not launch Chrome:", e.message);
  process.exit(1);
});

let failed = false;

try {
  await connect(await chromeEndpoint());
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  ({ sessionId: session } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  }));
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);

  console.log("\n[0/5] Sign-in — the gate every other screen is behind");
  // Chrome runs against a persistent --user-data-dir, so without this the
  // session minted by the *previous* run is still installed and /login
  // redirects straight past the screen we came to photograph.
  await send("Network.enable", {}, session);
  await send("Network.clearBrowserCookies", {}, session);
  await colorScheme("light");
  await viewport({ width: 1280, height: 900 });
  // Captured *before* the session cookie is installed, so this is the genuine
  // signed-out screen rather than a page rendered with auth quietly bypassed.
  await goto(`${BASE}/login`, '[data-testid="login-card"]');
  await shot("00-login", "signed out — GitHub is the only credential path");
  await signInAsCaptureUser();

  console.log("\n[1/5] Responsive views — the same idle screen at three widths");
  await seed({ theme: "light" });

  await viewport({ width: 1280, height: 900 });
  await goto(`${BASE}/scopecraft`);
  await shot("01-idle-desktop-light", "1280×900, light");

  await viewport({ width: 768, height: 1024 });
  await goto(`${BASE}/scopecraft`);
  await shot("02-idle-tablet", "768×1024");

  await viewport({ width: 390, height: 844, mobile: true });
  await goto(`${BASE}/scopecraft`);
  await shot("03-idle-mobile", "390×844, mobile emulation");

  console.log("\n[2/5] Theme and direction");
  await colorScheme("dark");
  await seed({ theme: "dark" });
  await viewport({ width: 1280, height: 900 });
  await goto(`${BASE}/scopecraft`);
  await shot("04-idle-desktop-dark", "dark theme, explicit choice");

  await colorScheme("light");
  await seed({ theme: "light", locale: "ar" });
  await goto(`${BASE}/scopecraft`);
  const dir = await evaluate(`document.documentElement.dir`);
  await shot("05-arabic-rtl", `Arabic, dir=${dir}`);

  // Accessibility: the skip link is invisible until focused. One Tab from a
  // fresh load must reveal it, or it is not doing its job.
  await seed({ theme: "light", locale: "en" });
  await goto(`${BASE}/scopecraft`);
  await evaluate(`document.body.focus(), true`);
  await send("Input.dispatchKeyEvent",
    { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }, session);
  await send("Input.dispatchKeyEvent",
    { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }, session);
  await sleep(300);
  const focused = await evaluate(
    `(document.activeElement && document.activeElement.textContent || '').trim()`
  );
  await shot("06-skip-link-focused", `first Tab focuses: "${focused}"`);
  if (!/skip/i.test(focused)) {
    console.error(`  ✗ expected the skip link to take first focus, got "${focused}"`);
    failed = true;
  }

  // Following the link must actually reveal content. With a sticky header and
  // no scroll-margin-top, the target lands *underneath* the header and the skip
  // link silently does nothing useful.
  await evaluate(`document.querySelector('.sc-skip-link').click(), true`);
  await sleep(600);
  const clearance = await evaluate(`
    (() => {
      const main = document.getElementById('main-content');
      const header = document.querySelector('header');
      return JSON.stringify({
        mainTop: Math.round(main.getBoundingClientRect().top),
        headerBottom: Math.round(header.getBoundingClientRect().bottom),
        focused: (document.activeElement && document.activeElement.id) || ''
      });
    })()
  `);
  const c = JSON.parse(clearance);
  if (c.mainTop >= c.headerBottom) {
    console.log(`  ✓ skip target clears the sticky header (main ${c.mainTop}px, header ends ${c.headerBottom}px)`);
  } else {
    console.error(`  ✗ sticky header covers the skip target: main ${c.mainTop}px vs header ${c.headerBottom}px`);
    failed = true;
  }

  console.log("\n[3/5] Workflow states — driven through the real form");
  await goto(`${BASE}/scopecraft`);
  await submit();
  await sleep(600);
  await evaluate(`
    (() => {
      const el = document.querySelector('[data-testid="error-banner"]');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
      return true;
    })()
  `);
  await sleep(200);
  await shot("07-validation-error", "empty submit — inline errors + focused summary");

  await goto(`${BASE}/scopecraft`);
  await fillForm();
  await shot("08-form-filled", "valid input, submit enabled");

  await submit();
  await sleep(900);
  await evaluate(`
    (() => {
      const el = document.querySelector('[data-testid="loading-state"]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    })()
  `);
  await sleep(200);
  await shot("09-loading", "loading state with live progress steps");

  // The generation is genuinely intermittent: the model sometimes returns
  // estimates the deterministic planner rejects (PLANNING_ERROR — a dependency
  // on a story it never emitted, most often). Retrying is what a user does, so
  // the script does it too, and reports how many attempts it took rather than
  // quietly presenting the successful one as typical.
  let outcome = await waitForResult();
  let attempts = 1;
  while (outcome !== "success" && attempts < 4) {
    console.log(`  · attempt ${attempts} returned "${outcome}" — retrying`);
    await goto(`${BASE}/scopecraft`);
    await fillForm();
    await submit();
    outcome = await waitForResult();
    attempts += 1;
  }
  console.log(`  · provider returned: ${outcome} (after ${attempts} attempt(s))`);
  generationAttempts = attempts;
  if (outcome === "success") {
    // The result renders *below* the intake form, so every result capture has to
    // scroll to it first. Scrolling to the top of the document just re-shoots
    // the form — which is exactly what the first run of this script did.
    const showResult = async () => {
      await evaluate(`
        (() => {
          const el = document.querySelector('[data-testid="result-view"]');
          if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
          return true;
        })()
      `);
      await sleep(400);
    };

    await showResult();
    await shot("10-success-desktop", "structured PRD result — Overview tab");

    // The result is a real ARIA tablist, so each panel is a separate capture.
    const openTab = async (id) => {
      await evaluate(
        `document.querySelector('[data-testid="result-tab-${id}"]').click(), true`
      );
      await sleep(500);
      await showResult();
    };

    await openTab("backlog");
    capacityReadout = await evaluate(`
      (() => {
        const nums = document.querySelector('[data-testid="capacity-meter-numbers"]');
        const pct = document.querySelector('[data-testid="capacity-meter-percent"]');
        const cards = document.querySelectorAll('[data-testid^="sprint-card"], article').length;
        return ((nums && nums.textContent) || '').trim() + ' · ' +
               ((pct && pct.textContent) || '').trim();
      })()
    `);
    await shot("11-sprint-board", `Backlog tab — capacity ${capacityReadout}`);

    await openTab("evidence");
    await shot("12-evidence-panel", "Evidence tab — provider and prompt version, kept distinct from model prose");

    await openTab("overview");

    await viewport({ width: 390, height: 844, mobile: true });
    await sleep(500);
    await showResult();
    await shot("13-success-mobile", "same result at 390px");

    // State 4 — empty. Reached by clearing a result, which must show the
    // "cleared" placeholder rather than the wizard's own idle copy.
    await viewport({ width: 1280, height: 900 });
    await sleep(300);
    const cleared = await evaluate(`
      (() => {
        const btn = [...document.querySelectorAll('button')]
          .find((b) => /clear results/i.test(b.textContent || ''));
        if (!btn) return false;
        btn.click();
        return true;
      })()
    `);
    if (cleared) {
      await sleep(500);
      await evaluate(`
        (() => {
          const el = document.querySelector('[data-testid="empty-state"]');
          if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
          return true;
        })()
      `);
      await sleep(300);
      await shot("15-empty-cleared", "results cleared — form input preserved");
    } else {
      console.error('  ✗ could not find the "Clear results" control');
      failed = true;
    }
  } else {
    console.error(`  ✗ expected a success state, got "${outcome}"`);
    failed = true;
  }

  console.log("\n[3b/5] Safe refusal — an out-of-domain request");
  await goto(`${BASE}/scopecraft`);
  await evaluate(`
    (() => {
      const el = document.querySelector('textarea[name="idea"]');
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, 'Diagnose my chest pain and prescribe a treatment plan for me this week.');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `);
  await sleep(200);
  await submit();
  const refusal = await waitForResult(60_000);
  if (refusal === "refusal") {
    await evaluate(`
      (() => {
        const el = document.querySelector('[data-testid="domain-refusal-state"]');
        if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
        return true;
      })()
    `);
    await sleep(300);
    await shot("16-domain-refusal", "422 OUT_OF_DOMAIN — refuses instead of inventing a plan");
  } else {
    // Honest outcome: the refusal depends on the model emitting the envelope.
    console.error(`  ✗ expected a domain refusal, got "${refusal}" (model-dependent)`);
    failed = true;
  }

  console.log("\n[4/5] Provider failure — served by an instance with dead credentials");
  await viewport({ width: 1280, height: 900 });
  try {
    const probe = await fetch(`${BAD_BASE}/scopecraft`, { method: "GET" });
    if (!probe.ok) throw new Error(String(probe.status));
    await goto(`${BAD_BASE}/scopecraft`);
    await fillForm();
    await submit();
    const bad = await waitForResult(60_000);
    if (bad === "error") {
      await evaluate(`
        (() => {
          const el = document.querySelector('[data-testid="error-state"]');
          if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
          return true;
        })()
      `);
      await sleep(300);
      await shot("14-provider-error", "502 from every provider — safe message + retry");
    } else {
      console.error(`  ✗ expected the error state, got "${bad}"`);
      failed = true;
    }
  } catch (e) {
    console.error(`  ✗ no failing instance on ${BAD_BASE} (${e.message}); skipping`);
    failed = true;
  }

  // ---- measured accessibility audit, light and dark ----
  console.log("\n[5/5] Accessibility audit — measured from the live DOM");
  await viewport({ width: 1280, height: 900 });
  const report = [];
  report.push("ScopeCraft — measured accessibility audit");
  report.push(`Captured at : ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`);
  report.push(`Page        : ${BASE}/scopecraft (production build)`);
  report.push("Generated by: scripts/capture-ui-evidence.mjs — do not hand-edit.");
  report.push(`Note        : the success screenshots took ${generationAttempts} generation attempt(s);`);
  report.push("              see the PLANNING_ERROR note in ui-evidence.md.");
  report.push("");
  report.push("Contrast is computed with the WCAG 2.1 relative-luminance formula against");
  report.push("each element's nearest opaque ancestor background. Thresholds: 4.5:1 for");
  report.push("body text, 3:1 for large text (>=24px, or >=18.66px bold).");

  for (const [theme, scheme] of [["light", "light"], ["dark", "dark"]]) {
    await colorScheme(scheme);
    await seed({ theme });
    await goto(`${BASE}/scopecraft`);
    const audit = JSON.parse(await evaluate(AUDIT_EXPRESSION));

    report.push("");
    report.push("=".repeat(72));
    report.push(`THEME: ${theme}   (html class="${audit.theme}", lang=${audit.lang}, dir=${audit.dir})`);
    report.push("=".repeat(72));
    report.push("");
    report.push(`Landmarks          : banner=${audit.landmarks.banner}  main=${audit.landmarks.main}  <h1> count=${audit.landmarks.h1}`);
    report.push(`Heading levels     : ${audit.headingLevels.join(", ")}  (skipped levels: ${audit.headingSkips})`);
    report.push(`Interactive controls: ${audit.controls}  without an accessible name: ${audit.unnamed.length}`);
    if (audit.unnamed.length) report.push(`  UNNAMED: ${audit.unnamed.join(", ")}`);
    report.push(`Images             : ${audit.imgs}  missing alt: ${audit.imgNoAlt}  missing dimensions: ${audit.imgNoDims}`);
    report.push(`Keyboard-reachable : ${audit.focusableCount} elements in tab order`);
    report.push("");
    report.push(`Text/background contrast — ${audit.contrast.length} distinct combinations measured:`);
    report.push("");
    report.push("  ratio   need   size     element  sample text");
    report.push("  " + "-".repeat(66));
    for (const c of audit.contrast.sort((a, b) => a.ratio - b.ratio)) {
      report.push(
        `  ${String(c.ratio).padStart(5)}${c.pass ? "  " : " !"} ${String(c.need).padStart(4)}   ` +
        `${c.size.padStart(6)}   ${c.tag.padEnd(8)} ${c.text}`
      );
    }
    const fails = audit.worst.length;
    report.push("");
    report.push(fails === 0
      ? `  RESULT: PASS — every measured combination meets its WCAG AA threshold.`
      : `  RESULT: ${fails} combination(s) BELOW threshold (marked !).`);

    console.log(`  ${fails === 0 ? "✓" : "✗"} ${theme}: ${audit.contrast.length} contrast pairs, ` +
                `${fails} below AA · ${audit.unnamed.length} unnamed controls · ` +
                `${audit.headingSkips} heading skips`);
    if (fails > 0 || audit.unnamed.length > 0 || audit.headingSkips > 0) failed = true;
  }

  // Horizontal overflow is the single most common responsive defect, and
  // "no horizontal scrolling" is a claim worth measuring rather than asserting.
  report.push("");
  report.push("=".repeat(72));
  report.push("HORIZONTAL OVERFLOW");
  report.push("=".repeat(72));
  report.push("");
  await colorScheme("light");
  // Measured in both directions. It used to be LTR only, which is how a skip
  // link parked at `left: -9999px` went unnoticed: that offset is unscrollable
  // under LTR but scrollable under RTL, and every Arabic page was ~10000px
  // wide. An RTL-blind overflow check is an overflow check with a hole in it.
  for (const locale of ["en", "ar"]) {
    await seed({ theme: "light", locale });
    for (const [label, w, h, mobile] of [
      ["desktop", 1280, 900, false],
      ["tablet", 768, 1024, false],
      ["mobile", 390, 844, true],
    ]) {
      await viewport({ width: w, height: h, mobile });
      await goto(`${BASE}/scopecraft`);
      const o = JSON.parse(await evaluate(`
        (() => {
          const d = document.documentElement;
          // Both edges: under RTL an element escapes past the *left* edge, so
          // a right-only test reports clean while the page scrolls sideways.
          const wide = [...document.querySelectorAll('*')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.right > d.clientWidth + 1 || r.left < -1;
            })
            .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
              ? '.' + el.className.split(' ')[0] : ''));
          return JSON.stringify({
            dir: d.dir,
            scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
            overflowing: [...new Set(wide)].slice(0, 5)
          });
        })()
      `));
      const clean = o.scrollWidth <= o.clientWidth;
      const tag = `${label} (${locale}/${o.dir})`;
      report.push(
        `  ${tag.padEnd(20)} ${String(w).padStart(4)}px : scrollWidth ${o.scrollWidth} vs viewport ` +
        `${o.clientWidth} — ${clean ? "no horizontal scroll" : "OVERFLOW: " + o.overflowing.join(", ")}`
      );
      console.log(`  ${clean ? "✓" : "✗"} ${tag}: ${clean ? "no horizontal overflow" : "OVERFLOWS"}`);
      if (!clean) failed = true;
    }
  }
  report.push("");
  report.push(`Sprint board capacity readout in the committed screenshot: ${capacityReadout}`);

  writeFileSync("docs/evidence/ui/accessibility-audit.txt", report.join("\n") + "\n");
  console.log("  · report written to docs/evidence/ui/accessibility-audit.txt");

  console.log(`\n${shotCount} screenshots written to ${OUT}/`);
} catch (error) {
  console.error("FATAL:", error.message);
  failed = true;
} finally {
  try { ws?.close(); } catch { /* already closed */ }
  chrome.kill();
}

process.exit(failed ? 1 : 0);

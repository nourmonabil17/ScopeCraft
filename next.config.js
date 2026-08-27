/** @type {import('next').NextConfig} */
//
// Security headers and framework hardening (owner: Youssef).
//
// WHY THESE LIVE HERE AND NOT IN vercel.json
// They used to live in vercel.json, which applies them only when deployed to
// Vercel. Moving them into the framework config means they also apply to
// `next start`, to any self-hosted deployment, and — the practical benefit —
// they can be verified locally before a deploy rather than discovered broken
// in production. Defining them in both places is not an option: Vercel would
// emit each header twice, and a duplicated X-Frame-Options is ignored by some
// browsers, which would leave the site less protected than before.

// ---------------------------------------------------------------------------
// Content-Security-Policy
//
// Read the script-src line before changing anything here.
//
// `script-src` carries 'unsafe-inline' and that is a real, conscious weakness.
// It is not laziness: the App Router streams its RSC hydration payload as ~10
// inline `self.__next_f.push(...)` scripts whose contents change on every build,
// so a hash allow-list is unmaintainable, and a nonce has to be minted per
// request — which would force `/scopecraft` from static prerendering into
// dynamic rendering and lose its edge caching. For a page with no third-party
// scripts, no user-supplied HTML and no `dangerouslySetInnerHTML` carrying user
// data, that trade is worth making explicitly rather than pretending the policy
// is stricter than it is.
//
// What the rest of the policy still buys, even with that hole:
//   connect-src 'self'   an injected script cannot POST the user's data to an
//                        attacker-controlled host — the exfiltration step of
//                        most real XSS chains
//   base-uri 'none'      blocks <base href> injection, a common way to turn a
//                        single injection point into full script hijacking
//   object-src 'none'    no Flash/plugin vectors
//   form-action 'self'   a planted form cannot post credentials off-site
//   frame-ancestors      clickjacking, belt-and-braces with X-Frame-Options
//
// `style-src` needs 'unsafe-inline' because the theme tokens ship as an inline
// <style> in the root layout, and it must stay inline: it has to apply before
// first paint or the page flashes the wrong theme.
//
// `blob:` appears in img-src and connect-src for the JSON/Markdown export,
// which builds a Blob and hands it to a download link.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No camera, mic or geolocation is used anywhere; deny them outright so a
  // future dependency cannot quietly start asking.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig = {
  // Emits a self-contained server bundle at `.next/standalone`, so the Docker
  // image copies one traced directory instead of all 505 MB of `node_modules`.
  //
  // CONDITIONAL, AND THAT IS THE POINT. It was unconditional first, which broke
  // something quietly: Next warns that `next start` "does not work with output:
  // standalone", and `next start` is exactly how both evidence capture scripts
  // run the app. Responses were still correct — the warning was the only symptom
  // — but shipping a configuration the framework says is unsupported, on the
  // path that produces graded artifacts, is not a trade worth making for an
  // image size.
  //
  // Vercel does not need it either: it does its own output tracing and treats
  // `standalone` as a no-op. So the flag now exists only where it earns its
  // keep — the Docker builder stage sets DOCKER_BUILD=1. Vercel and local
  // development get the ordinary build, and `next start` stops warning.
  ...(process.env.DOCKER_BUILD ? { output: "standalone" } : {}),

  // Next advertises itself with `X-Powered-By: Next.js` by default. Vercel
  // happens to strip it, but `next start` and any self-hosted deployment do
  // not — and naming your framework and stack to every caller is free
  // reconnaissance. Turning it off costs nothing.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;

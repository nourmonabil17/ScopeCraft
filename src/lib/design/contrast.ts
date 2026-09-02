// src/lib/design/contrast.ts
//
// WCAG 2.2 relative luminance and contrast ratio, from the spec's own
// formulae (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
//
// Hand-written rather than pulled from a package: it is nine lines of
// arithmetic defined by a public standard that has not changed since 2008,
// and it is the only thing that makes "contrast is measured, not assumed"
// an executable claim rather than a promise.

/** Accepts "#rgb" or "#rrggbb". Throws on anything else — a malformed token
 *  should fail loudly at test time, not silently score 21:1. */
function toRgb(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, "");

  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Per WCAG: linearise each channel, then weight for human luminance response. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

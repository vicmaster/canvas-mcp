// Phase 25 slice C (FR-C1/C2) — the OKLCH color engine: one seed color →
// perceptual ramps, a matched neutral, status colors, and a dual-theme
// semantic mapping. Hand-rolled conversions (Björn Ottosson's OKLab math,
// zero dependencies — validated against Chrome's own oklch() parsing in
// test-color-system-readback.ts). Pure: token WRITING is the tool's job.
//
// Gamut policy (spec ANALYZE): out-of-gamut colors clip toward LOWER CHROMA
// at fixed lightness and hue — never hue-shift, never lightness-shift.

import { contrastRatio, parseColor } from './evaluate.js';

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.37
  h: number; // degrees 0..360
}

// ── conversions ─────────────────────────────────────────────────────────────

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function rgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb(L: number, a: number, bb: number): [number, number, number] {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * bb, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * bb, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * bb, 3);
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function hexToOklch(hex: string): Oklch {
  const rgb = parseColor(hex);
  if (!rgb) throw new Error(`"${hex}" is not a parseable color (expected #RGB / #RRGGBB / rgb())`);
  const { L, a, b } = rgbToOklab(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-5 ? 0 : h };
}

/** In-gamut check + raw conversion; NaN-safe (negative cube inputs are fine —
 * Math.pow of a negative base with integer exponent 3 via manual cube). */
function oklchToRgbRaw(o: Oklch): [number, number, number] {
  const hr = (o.h * Math.PI) / 180;
  return oklabToRgb(o.l, o.c * Math.cos(hr), o.c * Math.sin(hr));
}

const inGamut = (rgb: [number, number, number]): boolean => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** OKLCH → hex, clipping toward lower chroma (fixed L and H) when the color
 * falls outside sRGB. Binary search converges well inside 1/255. */
export function oklchToHex(o: Oklch): string {
  let rgb = oklchToRgbRaw(o);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = o.c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToRgbRaw({ ...o, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToRgbRaw({ ...o, c: lo });
  }
  const to255 = (c: number): number => Math.max(0, Math.min(255, Math.round(c * 255)));
  return '#' + rgb.map((c) => to255(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ── ramps ───────────────────────────────────────────────────────────────────

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/** OKLab lightness targets: a wash at 50, then perceptually EVEN steps from
 * 100 → 900 (Δ0.075 — asserted in tests). */
const L_TARGETS = [0.975, 0.95, 0.875, 0.8, 0.725, 0.65, 0.575, 0.5, 0.425, 0.35];

/** Chroma envelope relative to the seed's chroma — tapered at the light end
 * (washes stay washes), full through the middle, gently reduced in the
 * shadows (dark steps go muddy at full chroma). */
const C_CURVE = [0.12, 0.25, 0.5, 0.75, 0.92, 1, 1, 0.92, 0.82, 0.72];

export type Ramp = Record<(typeof RAMP_STEPS)[number], string>;

export function generateRamp(seedHex: string): Ramp {
  const seed = hexToOklch(seedHex);
  const c = Math.max(seed.c, 0.03); // a near-grey seed still deserves a usable ramp
  const out = {} as Ramp;
  RAMP_STEPS.forEach((step, i) => {
    out[step] = oklchToHex({ l: L_TARGETS[i], c: c * C_CURVE[i], h: seed.h });
  });
  return out;
}

/** Neutral ramp with a whisper of the seed's hue — never a dead grey, never
 * visibly tinted. */
export function matchedNeutral(seedHex: string): Ramp {
  const seed = hexToOklch(seedHex);
  const out = {} as Ramp;
  RAMP_STEPS.forEach((step, i) => {
    out[step] = oklchToHex({ l: L_TARGETS[i], c: 0.01, h: seed.h });
  });
  return out;
}

/** Status colors at ONE consistent lightness/chroma band (per-hue gamut
 * clipping may reduce chroma, never lightness or hue). */
export const STATUS_HUES = { success: 150, warning: 75, danger: 27 } as const;
const STATUS_L = 0.62;
const STATUS_C = 0.15;

export function statusColors(): Record<keyof typeof STATUS_HUES, string> {
  return {
    success: oklchToHex({ l: STATUS_L, c: STATUS_C, h: STATUS_HUES.success }),
    warning: oklchToHex({ l: STATUS_L, c: STATUS_C, h: STATUS_HUES.warning }),
    danger: oklchToHex({ l: STATUS_L, c: STATUS_C, h: STATUS_HUES.danger }),
  };
}

// ── semantic mapping ────────────────────────────────────────────────────────

const rgbOf = (hex: string): [number, number, number] => parseColor(hex)!;

/** First ramp step (searching dark→light for dark themes, light→dark for
 * light themes) whose contrast against `bg` clears `min` — AA by
 * construction instead of by hope. */
function pickStep(ramp: Ramp, bg: string, min: number, direction: 'darker' | 'lighter'): string {
  const steps = direction === 'darker' ? [...RAMP_STEPS] : [...RAMP_STEPS].reverse();
  for (const s of steps) {
    if (contrastRatio(rgbOf(ramp[s]), rgbOf(bg)) >= min) return ramp[s];
  }
  return direction === 'darker' ? ramp[900] : ramp[50];
}

export interface SemanticTheme {
  'bg-primary': string;
  'bg-surface': string;
  'bg-elevated': string;
  'text-primary': string;
  'text-secondary': string;
  border: string;
  accent: string;
}

/** Light + dark mappings from the same ramps — the Radix pattern: dark is a
 * REVERSED walk of the lightness ladder, not inverted hex. Text and accent
 * steps are chosen by measured contrast (AA on their surfaces by
 * construction). */
export function semanticMapping(primary: Ramp, neutral: Ramp): { light: SemanticTheme; dark: SemanticTheme } {
  const light: SemanticTheme = {
    'bg-primary': neutral[50],
    'bg-surface': '#FFFFFF',
    'bg-elevated': neutral[50],
    'text-primary': neutral[900],
    'text-secondary': pickStep(neutral, '#FFFFFF', 4.6, 'darker'),
    border: neutral[200],
    accent: pickStep(primary, '#FFFFFF', 4.6, 'darker'),
  };
  const dark: SemanticTheme = {
    'bg-primary': neutral[900],
    'bg-surface': oklchToHex({ ...hexToOklch(neutral[900]), l: 0.31 }), // one step past 900 — cards sit above the page
    'bg-elevated': oklchToHex({ ...hexToOklch(neutral[900]), l: 0.35 }),
    'text-primary': neutral[50],
    'text-secondary': pickStep(neutral, neutral[900], 4.6, 'lighter'),
    border: neutral[700],
    accent: pickStep(primary, neutral[900], 4.6, 'lighter'),
  };
  // dark surfaces are darker than 900's L target on purpose; recompute the
  // surface-dependent picks against the ACTUAL surface.
  dark['text-secondary'] = pickStep(neutral, dark['bg-surface'], 4.6, 'lighter');
  dark.accent = pickStep(primary, dark['bg-surface'], 4.6, 'lighter');
  return { light, dark };
}

/** Raise a color's lightness (hue and chroma held) until it clears `min`
 * contrast against `bg` — status colors tuned for light surfaces go muddy on
 * dark ones, and a $danger message must read in BOTH themes. */
function raiseForContrast(hex: string, bgHex: string, min = 4.5): string {
  let o = hexToOklch(hex);
  for (let i = 0; i < 30 && contrastRatio(rgbOf(oklchToHex(o)), rgbOf(bgHex)) < min; i++) {
    o = { ...o, l: Math.min(0.95, o.l + 0.02) };
  }
  return oklchToHex(o);
}

export type StatusColors = Record<'success' | 'warning' | 'danger', string>;

/** The full system from one seed — what generate_color_system writes/reports.
 * The dark layer includes STATUS overrides (dogfood fix): the light-tuned
 * status colors are re-lit for AA against the dark surface. */
export function generateColorSystem(seedHex: string): {
  seed: { hex: string; oklch: Oklch };
  primary: Ramp;
  neutral: Ramp;
  status: StatusColors;
  light: SemanticTheme;
  dark: SemanticTheme & StatusColors;
} {
  const primary = generateRamp(seedHex);
  const neutral = matchedNeutral(seedHex);
  const status = statusColors();
  const { light, dark } = semanticMapping(primary, neutral);
  const darkStatus = Object.fromEntries(
    Object.entries(status).map(([k, hex]) => [k, raiseForContrast(hex, dark['bg-surface'])]),
  ) as StatusColors;
  return { seed: { hex: seedHex, oklch: hexToOklch(seedHex) }, primary, neutral, status, light, dark: { ...dark, ...darkStatus } };
}

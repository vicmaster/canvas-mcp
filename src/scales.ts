// Phase 25 slice B (FR-B1) — modular scale generation: the mathematically
// boring part of a type system, produced instead of hand-picked. A named
// ratio + a base size yield a full type scale (with the slice-A craft
// defaults baked in: line-height bands, display tracking) and a paired space
// scale. Fluid mode emits Utopia-style clamp() strings that interpolate
// between viewport extremes. Pure — token WRITING is the tool's job.

export const RATIOS = {
  'minor-second': 1.125,
  'major-second': 1.2,
  'minor-third': 1.25,
  'major-third': 1.333,
  'perfect-fourth': 1.5,
  'golden': 1.618,
} as const;

export type RatioName = keyof typeof RATIOS;
export const RATIO_NAMES = Object.keys(RATIOS) as RatioName[];

export interface TypeStep {
  fontSize: number | string;
  lineHeight: number;
  letterSpacing?: number;
}

export interface ScaleOptions {
  ratio: RatioName | number;
  /** Body size the scale pivots on (text-base). Default 16. */
  baseSize?: number;
  /** Steps below/above base. Default 2 down (sm, xs), 4 up (lg…3xl). */
  stepsDown?: number;
  stepsUp?: number;
  /** Utopia-style fluid type: each step becomes a clamp() interpolating from
   * ~85% of its size at minViewport up to full size at maxViewport. Spacing
   * stays static (spacing tokens are numbers by design). */
  fluid?: { minViewport?: number; maxViewport?: number };
}

export function resolveRatio(ratio: RatioName | number): number {
  if (typeof ratio === 'number') {
    if (!(ratio > 1 && ratio <= 2.2)) throw new Error(`ratio must be in (1, 2.2] — got ${ratio}`);
    return ratio;
  }
  const r = RATIOS[ratio];
  if (!r) throw new Error(`Unknown ratio "${ratio}". Named ratios: ${RATIO_NAMES.join(', ')} — or pass a number.`);
  return r;
}

/** text-… name for a step index relative to base (0). */
function stepName(k: number): string {
  if (k === 0) return 'text-base';
  if (k === -1) return 'text-sm';
  if (k === -2) return 'text-xs';
  if (k < -2) return `text-${-k - 1}xs`;
  if (k === 1) return 'text-lg';
  if (k === 2) return 'text-xl';
  return `text-${k - 1}xl`;
}

/** Craft defaults per rendered size — the same bands the slice-A advisories
 * check, baked in so a generated scale never gets nagged. */
function craftDefaults(size: number): { lineHeight: number; letterSpacing?: number } {
  if (size >= 28) return { lineHeight: 1.2, letterSpacing: size > 40 ? -1 : -0.5 };
  if (size >= 20) return { lineHeight: 1.35 };
  return { lineHeight: 1.5 };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** clamp() interpolating min→max px across the viewport range. */
export function fluidClamp(minPx: number, maxPx: number, minVw: number, maxVw: number): string {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  return `clamp(${minPx}px, ${round2(intercept)}px + ${round2(slope * 100)}vw, ${maxPx}px)`;
}

export function generateTypeScale(opts: ScaleOptions): Record<string, TypeStep> {
  const ratio = resolveRatio(opts.ratio);
  const base = opts.baseSize ?? 16;
  if (!(base >= 10 && base <= 24)) throw new Error(`baseSize must be 10–24px — got ${base}`);
  const down = opts.stepsDown ?? 2;
  const up = opts.stepsUp ?? 4;
  const minVw = opts.fluid?.minViewport ?? 390;
  const maxVw = opts.fluid?.maxViewport ?? 1440;
  if (opts.fluid && !(maxVw > minVw)) throw new Error('fluid.maxViewport must exceed fluid.minViewport');

  const out: Record<string, TypeStep> = {};
  let prev = 0;
  for (let k = -down; k <= up; k++) {
    let size = Math.round(base * Math.pow(ratio, k));
    if (size <= prev) size = prev + 1; // rounding can collide at tight ratios — keep strictly increasing
    prev = size;
    const defaults = craftDefaults(size);
    const fontSize = opts.fluid
      ? fluidClamp(Math.max(12, Math.round(size * 0.85)), size, minVw, maxVw)
      : size;
    out[stepName(k)] = { fontSize, ...defaults };
  }
  return out;
}

/** Space scale paired to the base size — md = 1× base, halving/growing along
 * the familiar t-shirt ladder. Always static numbers (evaluator spacing
 * checks and the `spacing` token type are number-based by design). */
const SPACE_LADDER: Array<[string, number]> = [
  ['space-3xs', 0.125],
  ['space-2xs', 0.25],
  ['space-xs', 0.5],
  ['space-sm', 0.75],
  ['space-md', 1],
  ['space-lg', 1.5],
  ['space-xl', 2],
  ['space-2xl', 3],
  ['space-3xl', 4],
];

export function generateSpaceScale(baseSize = 16): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, mult] of SPACE_LADDER) out[name] = Math.max(1, Math.round(baseSize * mult));
  return out;
}

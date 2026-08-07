// Phase 25 slice C — the OKLCH color engine, pure: conversion round-trips,
// ramp evenness, gamut policy (chroma clips, hue never shifts), the matched
// neutral, status lightness consistency, and the AA-by-construction semantic
// mapping in BOTH themes.
//
// Usage: npx tsx test-color-system.ts

import './test-env.js';
import { hexToOklch, oklchToHex, generateRamp, matchedNeutral, statusColors, semanticMapping, generateColorSystem, RAMP_STEPS } from './src/color-system.js';
import { contrastRatio, parseColor } from './src/evaluate.js';

let allPass = true;
function check(name: string, cond: boolean, extra?: string) {
  if (!cond) allPass = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

const rgb = (hex: string) => parseColor(hex)!;
const aa = (fg: string, bg: string) => contrastRatio(rgb(fg), rgb(bg)) >= 4.5;

// ── conversion round-trips ──────────────────────────────────────────────────
{
  const samples = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#0E7490', '#F59E0B', '#6366F1', '#123456', '#FEDCBA'];
  const maxDelta = Math.max(...samples.map((hex) => {
    const back = rgb(oklchToHex(hexToOklch(hex)));
    const orig = rgb(hex);
    return Math.max(...back.map((c, i) => Math.abs(c - orig[i])));
  }));
  check('hex → oklch → hex round-trips within 1/255', maxDelta <= 1, `max Δ ${maxDelta}`);
  check('white is L≈1 C≈0', Math.abs(hexToOklch('#FFFFFF').l - 1) < 0.01 && hexToOklch('#FFFFFF').c < 0.01);
}

// ── ramps ───────────────────────────────────────────────────────────────────
{
  const ramp = generateRamp('#0E7490'); // teal seed
  check('ten steps', Object.keys(ramp).length === 10);
  const Ls = RAMP_STEPS.map((s) => hexToOklch(ramp[s]).l);
  check('lightness strictly decreasing', Ls.every((l, i) => i === 0 || l < Ls[i - 1]), Ls.map((l) => l.toFixed(3)).join(','));
  const deltas = [];
  for (let i = 2; i < Ls.length; i++) deltas.push(Ls[i - 1] - Ls[i]); // 100→900 gaps
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  check('100→900 steps perceptually even (±0.02 L)', deltas.every((d) => Math.abs(d - mean) < 0.02), deltas.map((d) => d.toFixed(3)).join(','));
  const seedH = hexToOklch('#0E7490').h;
  // Hue is barely defined at wash-level chroma (8-bit quantization wobbles
  // it) — measure drift where chroma is perceptually meaningful.
  const chromaticSteps = RAMP_STEPS.filter((s) => hexToOklch(ramp[s]).c >= 0.04);
  const hueDrift = Math.max(...chromaticSteps.map((s) => Math.abs(hexToOklch(ramp[s]).h - seedH)));
  check('hue stays put across chromatic steps (<3°)', chromaticSteps.length >= 7 && hueDrift < 3, `${hueDrift.toFixed(2)}° over ${chromaticSteps.length} steps`);

  // Gamut policy: a screaming out-of-gamut request keeps L and H, loses only C.
  const clipped = hexToOklch(oklchToHex({ l: 0.5, c: 0.4, h: 150 }));
  check('gamut clip: lightness held', Math.abs(clipped.l - 0.5) < 0.01, clipped.l.toFixed(3));
  check('gamut clip: hue held (<1.5°)', Math.abs(clipped.h - 150) < 1.5, clipped.h.toFixed(2));
  check('gamut clip: only chroma reduced', clipped.c < 0.4);

  // A near-grey seed still yields a usable (not flat) ramp.
  const grey = generateRamp('#888888');
  check('near-grey seed → still a ramp', hexToOklch(grey[500]).c > 0.01);
}

// ── neutral + status ────────────────────────────────────────────────────────
{
  const neutral = matchedNeutral('#0E7490');
  const cs = RAMP_STEPS.map((s) => hexToOklch(neutral[s]).c);
  check('neutral chroma is a whisper (≤0.012 everywhere)', cs.every((c) => c <= 0.012), cs.map((c) => c.toFixed(3)).join(','));
  check('neutral carries the seed hue', Math.abs(hexToOklch(neutral[500]).h - hexToOklch('#0E7490').h) < 5);

  const status = statusColors();
  const Ls = Object.values(status).map((hex) => hexToOklch(hex).l);
  check('status colors share one lightness band (±0.01)', Math.max(...Ls) - Math.min(...Ls) < 0.01, Ls.map((l) => l.toFixed(3)).join(','));
}

// ── semantic mapping: AA by construction, both themes ───────────────────────
{
  for (const seed of ['#0E7490', '#DC2626', '#16A34A', '#6366F1', '#F59E0B']) {
    const { light, dark } = semanticMapping(generateRamp(seed), matchedNeutral(seed));
    const pairs: Array<[string, string, string]> = [
      ['text-primary/bg-primary L', light['text-primary'], light['bg-primary']],
      ['text-primary/bg-surface L', light['text-primary'], light['bg-surface']],
      ['text-secondary/bg-surface L', light['text-secondary'], light['bg-surface']],
      ['accent/bg-surface L', light.accent, light['bg-surface']],
      ['text-primary/bg-primary D', dark['text-primary'], dark['bg-primary']],
      ['text-primary/bg-surface D', dark['text-primary'], dark['bg-surface']],
      ['text-secondary/bg-surface D', dark['text-secondary'], dark['bg-surface']],
      ['accent/bg-surface D', dark.accent, dark['bg-surface']],
    ];
    const failing = pairs.filter(([, fg, bg]) => !aa(fg, bg));
    check(`AA in both themes for seed ${seed}`, failing.length === 0, failing.map(([n, fg, bg]) => `${n}: ${fg}/${bg} = ${contrastRatio(rgb(fg), rgb(bg)).toFixed(2)}`).join('; '));
  }
  const { light, dark } = semanticMapping(generateRamp('#0E7490'), matchedNeutral('#0E7490'));
  check('light page is off-white, not #FFFFFF', light['bg-primary'].toUpperCase() !== '#FFFFFF');
  check('dark surfaces sit above the page', hexToOklch(dark['bg-surface']).l < hexToOklch(dark['bg-elevated']).l);
}

// ── the full system ─────────────────────────────────────────────────────────
{
  const sys = generateColorSystem('#0E7490');
  check('system carries all parts', !!sys.primary[500] && !!sys.neutral[900] && !!sys.status.danger && !!sys.light.accent && !!sys.dark.accent);
  check('seed reported with its oklch', sys.seed.hex === '#0E7490' && sys.seed.oklch.l > 0 && sys.seed.oklch.c > 0);
  let err = '';
  try { generateColorSystem('not-a-color'); } catch (e) { err = (e as Error).message; }
  check('unparseable seed errors clearly', err.includes('not a parseable color'), err);
}

console.log(allPass ? '\nAll color-system tests passed.' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

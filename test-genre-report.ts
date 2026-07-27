// Issue #152 — canvas_evaluate reports the active genre and which rules it
// relaxed. Genre choice is consequential (the relaxation table decides whether
// a canvas can score at all) but was invisible: you inferred it from the score
// moving. The result's `genre` field now carries { active, source, relaxed,
// notRelaxed } whenever the cliche category runs.
//
// Usage: npx tsx test-genre-report.ts

import './test-env.js';
import { createCanvas } from './src/scene-graph.js';
import { parseAndExecute } from './src/operations.js';
import { evaluateCanvas } from './src/evaluate.js';

let allPass = true;
function check(name: string, cond: boolean, extra?: string) {
  if (!cond) allPass = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

function makeCanvas() {
  const canvas = createCanvas('Genre Report Test');
  parseAndExecute(canvas.root, `
card=I("document", { type: "frame", layout: "vertical", gap: 16, padding: 24, fill: "#F8FAFC" })
t=I(card, { type: "text", content: "Revenue targets", fontSize: 20, fontWeight: 600, color: "#1E293B" })
`, canvas);
  return canvas;
}

// No genre anywhere → active null, source null, nothing relaxed, the whole
// table shows up as notRelaxed.
{
  const r = await evaluateCanvas(makeCanvas(), { mode: 'fast' });
  check('genre field present when cliche ran', r.genre !== undefined);
  check('no genre → active null / source null', r.genre!.active === null && r.genre!.source === null);
  check('no genre → nothing relaxed', r.genre!.relaxed.length === 0);
  const tells = r.genre!.notRelaxed.map((n) => n.tell).sort().join(',');
  check('no genre → full table in notRelaxed', tells === 'accent-hue,honest-content,pure-black-white', tells);
}

// Explicit genre wins and is labeled as such; the OTHER genre's tells land in
// notRelaxed with the genre that would relax them.
{
  const r = await evaluateCanvas(makeCanvas(), { mode: 'fast', genre: 'dashboard' });
  check('explicit dashboard → active/source', r.genre!.active === 'dashboard' && r.genre!.source === 'explicit');
  check('dashboard relaxes honest-content', r.genre!.relaxed.join(',') === 'honest-content');
  const byTell = Object.fromEntries(r.genre!.notRelaxed.map((n) => [n.tell, n.relaxedBy]));
  check('accent-hue not relaxed, material would', (byTell['accent-hue'] ?? []).join(',') === 'material');
  check('pure-black-white not relaxed, material would', (byTell['pure-black-white'] ?? []).join(',') === 'material');
  check('relaxed tells absent from notRelaxed', !('honest-content' in byTell));
  check('alias "data" not offered as a separate genre', JSON.stringify(r.genre!.notRelaxed).indexOf('"data"') === -1);
}

// Provenance stamp drives the genre when no explicit option is passed.
{
  const canvas = makeCanvas();
  canvas.metadata = { ...canvas.metadata, provenance: { preset: 'material', at: new Date().toISOString() } };
  const r = await evaluateCanvas(canvas, { mode: 'fast' });
  check('provenance material → active/source', r.genre!.active === 'material' && r.genre!.source === 'provenance');
  check('material relaxes accent-hue + pure-black-white', r.genre!.relaxed.sort().join(',') === 'accent-hue,pure-black-white');
  const byTell = Object.fromEntries(r.genre!.notRelaxed.map((n) => [n.tell, n.relaxedBy]));
  check('honest-content not relaxed, dashboard would', (byTell['honest-content'] ?? []).join(',') === 'dashboard');
}

// An explicit genre overrides the stamp.
{
  const canvas = makeCanvas();
  canvas.metadata = { ...canvas.metadata, provenance: { preset: 'material', at: new Date().toISOString() } };
  const r = await evaluateCanvas(canvas, { mode: 'fast', genre: 'dashboard' });
  check('explicit beats provenance', r.genre!.active === 'dashboard' && r.genre!.source === 'explicit');
}

// A genre the relaxation table doesn't know → active is reported but relaxes
// nothing — the signal that the stamp isn't doing what the author thinks.
{
  const r = await evaluateCanvas(makeCanvas(), { mode: 'fast', genre: 'minimal' });
  check('unknown genre → active reported, nothing relaxed', r.genre!.active === 'minimal' && r.genre!.relaxed.length === 0);
  check('unknown genre → full table in notRelaxed', r.genre!.notRelaxed.length === 3);
}

// Cliche not in the category list → no genre field at all.
{
  const r = await evaluateCanvas(makeCanvas(), { mode: 'fast', categories: ['spacing', 'color'] });
  check('no cliche category → no genre field', r.genre === undefined);
}

console.log(allPass ? '\nAll genre-report tests passed.' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

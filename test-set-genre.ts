// Issue #162 — canvas_set_genre: stamp (or clear) the evaluation genre
// durably without apply_preset's token churn. The stamp drives provenance-
// sourced evaluation, survives alongside other provenance facts, bumps
// lastModified (so caches invalidate), and NEVER moves the versionHash
// (so recorded approvals stay valid).
//
// Usage: npx tsx test-set-genre.ts

import './test-env.js';
import { createCanvas, setCanvasGenre, getCanvas } from './src/scene-graph.js';
import { applyStructure } from './src/structures.js';
import { parseAndExecute } from './src/operations.js';
import { canvasVersionHash } from './src/version.js';
import { evaluateCanvas, relaxedByGenre, knownGenres } from './src/evaluate.js';

let allPass = true;
function check(name: string, cond: boolean, extra?: string) {
  if (!cond) allPass = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

const canvas = createCanvas('Set Genre Test');
parseAndExecute(canvas.root, `
f=I("document", { type: "frame", layout: "vertical", gap: 16, padding: 24 })
I(f, { type: "text", content: "Revenue targets", fontSize: 20 })
`, canvas);

// Stamp on a canvas with no provenance at all.
const h0 = canvasVersionHash(canvas);
const lm0 = canvas.lastModified;
const r1 = setCanvasGenre(canvas.id, 'dashboard');
check('stamp returns previous null', r1?.previous === null);
check('provenance.preset written', canvas.metadata?.provenance?.preset === 'dashboard');
check('provenance.at stamped', typeof canvas.metadata?.provenance?.at === 'string');
check('lastModified bumped', canvas.lastModified !== lm0);
check('versionHash NOT moved by the stamp', canvasVersionHash(canvas) === h0);

// Evaluation picks the stamp up as provenance-sourced.
const ev = await evaluateCanvas(canvas, { mode: 'fast' });
check('evaluate reads the stamp', ev.genre?.active === 'dashboard' && ev.genre?.source === 'provenance', JSON.stringify(ev.genre));

// Restamp preserves other provenance facts.
canvas.metadata!.provenance = { ...canvas.metadata!.provenance!, structure: 'dashboard-scaffold', importedFrom: 'https://x.test' };
const r2 = setCanvasGenre(canvas.id, 'material');
check('restamp returns prior genre', r2?.previous === 'dashboard');
check('other provenance facts preserved', canvas.metadata?.provenance?.structure === 'dashboard-scaffold' && canvas.metadata?.provenance?.importedFrom === 'https://x.test');

// Clear removes only the preset.
const r3 = setCanvasGenre(canvas.id, null);
check('clear returns prior genre', r3?.previous === 'material');
check('preset removed, rest intact', canvas.metadata?.provenance?.preset === undefined && canvas.metadata?.provenance?.structure === 'dashboard-scaffold');
const evCleared = await evaluateCanvas(canvas, { mode: 'fast' });
check('cleared stamp → evaluate sees no genre', evCleared.genre?.active === null && evCleared.genre?.source === null);

// Clearing an already-clear canvas is a no-op that doesn't dirty the file.
const lm1 = canvas.lastModified;
const r4 = setCanvasGenre(canvas.id, null);
check('double clear → previous null, lastModified untouched', r4?.previous === null && canvas.lastModified === lm1);

// Unknown genre: stored, relaxes nothing (the tool surfaces a note from this).
setCanvasGenre(canvas.id, 'brutalist');
check('unknown genre stored', getCanvas(canvas.id)?.metadata?.provenance?.preset === 'brutalist');
check('relaxedByGenre: unknown → []', relaxedByGenre('brutalist').length === 0);
check('relaxedByGenre: material → accent-hue + pure-black-white', relaxedByGenre('material').sort().join(',') === 'accent-hue,pure-black-white');
// Pinned on purpose: adding a relax-genre is a deliberate act (it opens a hole
// in a guardrail), so it should have to be written down here too.
check('knownGenres lists the relax table', knownGenres().sort().join(',') === 'checkout,commerce,dashboard,data,material', knownGenres().join(','));
check('relaxedByGenre: commerce → honest-content', relaxedByGenre('commerce').join(',') === 'honest-content');
check('relaxedByGenre: checkout aliases commerce', relaxedByGenre('checkout').join(',') === 'honest-content');

// Missing canvas → undefined.
check('unknown canvas → undefined', setCanvasGenre('nope', 'dashboard') === undefined);

// ── stamping a page structure must not erase the genre ───────────────────────
{
  // Found by building the v2.1.0 checkout example. `canvas_set_genre` writes
  // metadata.provenance.preset; `applyStructure` then recorded its own
  // provenance by REPLACING the object, so declaring a genre and then stamping
  // a layout — the order the docs encourage — silently dropped the genre and
  // the screen's prices went back to being flagged as fabricated. It failed
  // silently: nothing errored, the evaluation just reported genre.active null.
  const canvas = createCanvas('genre-then-structure');
  setCanvasGenre(canvas.id, 'commerce');
  applyStructure(canvas, 'settings');
  const after = getCanvas(canvas.id)!;
  const prov = after.metadata?.provenance as { preset?: string; structure?: string } | undefined;

  check('the genre survives a page-structure stamp', prov?.preset === 'commerce', `preset=${prov?.preset}`);
  check('...and the structure is recorded alongside it', prov?.structure === 'settings', `structure=${prov?.structure}`);

  // The evaluator is what actually consumes it — assert the end effect, not
  // just the metadata shape.
  const r = await evaluateCanvas(after, { mode: 'fast', categories: ['cliche'] });
  check('...so the evaluator still sees the genre', r.genre?.active === 'commerce', JSON.stringify(r.genre?.active));
}

console.log(allPass ? '\nAll set-genre tests passed.' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

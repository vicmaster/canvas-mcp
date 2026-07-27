// Phase 23 slice A (#149) — a stable content hash per canvas so approvals are
// falsifiable. The hash covers design content ONLY (root tree, canvas tokens,
// components, fonts); metadata (feedback, critique, provenance), timestamps,
// and store identity never move it.
//
// Usage: npx tsx test-version-hash.ts

import './test-env.js';
import { createCanvas } from './src/scene-graph.js';
import { parseAndExecute } from './src/operations.js';
import { canonicalSerialize, canvasVersionHash } from './src/version.js';

let allPass = true;
function check(name: string, cond: boolean, extra?: string) {
  if (!cond) allPass = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

// ── canonicalSerialize ──────────────────────────────────────────────────────
check('key order does not matter', canonicalSerialize({ b: 1, a: 2 }) === canonicalSerialize({ a: 2, b: 1 }));
check('array order DOES matter', canonicalSerialize([1, 2]) !== canonicalSerialize([2, 1]));
check('nested objects sorted', canonicalSerialize({ x: { b: 1, a: [{ d: 1, c: 2 }] } }) === '{"x":{"a":[{"c":2,"d":1}],"b":1}}');
check('undefined members dropped like JSON.stringify', canonicalSerialize({ a: 1, b: undefined }) === '{"a":1}');
check('undefined in arrays → null like JSON.stringify', canonicalSerialize([1, undefined, 2]) === '[1,null,2]');
check('primitives/null', canonicalSerialize('a') === '"a"' && canonicalSerialize(3) === '3' && canonicalSerialize(null) === 'null' && canonicalSerialize(true) === 'true');

// ── canvasVersionHash ───────────────────────────────────────────────────────
function makeCanvas() {
  const canvas = createCanvas('Version Hash Test');
  parseAndExecute(canvas.root, `
card=I("document", { type: "frame", layout: "vertical", gap: 16, padding: 24, fill: "$surface" })
t=I(card, { type: "text", content: "Revenue targets", fontSize: 20 })
`, canvas);
  return canvas;
}

const canvas = makeCanvas();
const h0 = canvasVersionHash(canvas);
check('format sha256:<16 hex>', /^sha256:[0-9a-f]{16}$/.test(h0), h0);
check('deterministic', canvasVersionHash(canvas) === h0);

// Metadata must never move the hash — the #149 contract: an approval survives
// feedback arriving/resolving, critique stamps, and provenance changes.
canvas.metadata = {
  ...canvas.metadata,
  provenance: { preset: 'dashboard', at: new Date().toISOString() },
  feedback: [{ id: 'fb-1', note: 'nudge left', createdAt: 'x' }],
  critique: { overall: 88 },
} as typeof canvas.metadata;
canvas.lastModified = new Date(Date.now() + 60_000).toISOString();
check('metadata + lastModified changes → hash unchanged', canvasVersionHash(canvas) === h0);

// Identity fields don't participate — the same design in another store slot
// hashes identically (process/machine independence).
const twin = makeCanvas();
twin.root = structuredClone(canvas.root);
twin.variables = structuredClone(canvas.variables);
twin.components = structuredClone(canvas.components);
check('same content, different canvas id/name → same hash', canvasVersionHash(twin) === h0, `${canvasVersionHash(twin)} vs ${h0}`);

// Design edits move it.
const c2 = makeCanvas();
const base = canvasVersionHash(c2);
parseAndExecute(c2.root, `U("${c2.root.children![0].id}", { fill: "#0F172A" })`, c2);
const afterTree = canvasVersionHash(c2);
check('tree edit → new hash', afterTree !== base);

c2.variables = { ...c2.variables, colors: { surface: '#F8FAFC' } };
const afterTokens = canvasVersionHash(c2);
check('token edit → new hash', afterTokens !== afterTree);

c2.components['cmp-x'] = { id: 'cmp-x', type: 'frame' } as (typeof c2.components)[string];
const afterComponents = canvasVersionHash(c2);
check('component registry edit → new hash', afterComponents !== afterTokens);

c2.fonts = [{ family: 'Inter', css: '' } as NonNullable<typeof c2.fonts>[number]];
check('fonts edit → new hash', canvasVersionHash(c2) !== afterComponents);

// fonts absent vs [] is normalized — a canvas that never touched fonts hashes
// the same before/after the field first appears empty.
const c3 = makeCanvas();
const noFonts = canvasVersionHash(c3);
c3.fonts = [];
check('fonts undefined vs [] → same hash', canvasVersionHash(c3) === noFonts);

console.log(allPass ? '\nAll version-hash tests passed.' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

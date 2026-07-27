// Issue #150 — the viewer cached evaluations by `${id}:${lastModified}`, so
// any edit that doesn't bump lastModified (stamping metadata.provenance.preset
// by hand, hand-editing a repo-bound JSON) kept serving the stale score — a
// correct fix looked broken from the user's side. evalCacheKey hashes what the
// evaluation actually reads: the tree, the merged tokens, the genre, and the
// component registry.
//
// Usage: npx tsx test-eval-cache-key.ts

import './test-env.js';
import { createCanvas } from './src/scene-graph.js';
import { evalCacheKey } from './src/viewer.js';
import { parseAndExecute } from './src/operations.js';

let allPass = true;
function check(name: string, cond: boolean, extra?: string) {
  if (!cond) allPass = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

const canvas = createCanvas('Cache Key Test');
parseAndExecute(canvas.root, `
card=I("document", { type: "frame", fill: "#F8FAFC", padding: 24 })
t=I(card, { type: "text", content: "Revenue", fontSize: 14 })
`, canvas);

const k0 = evalCacheKey(canvas);
check('deterministic — same content, same key', evalCacheKey(canvas) === k0);
check('key is namespaced by canvas id', k0.startsWith(`${canvas.id}:`), k0);

// lastModified alone must NOT move the key — it's a content hash now.
canvas.lastModified = new Date(Date.now() + 60_000).toISOString();
check('lastModified change alone → same key', evalCacheKey(canvas) === k0);

// The #150 incident: stamping the provenance preset (genre) must move the key,
// because genre changes which cliché tells are relaxed.
canvas.metadata = { ...canvas.metadata, provenance: { preset: 'dashboard', at: new Date().toISOString() } };
const k1 = evalCacheKey(canvas);
check('stamping provenance.preset → new key', k1 !== k0);

// Unrelated metadata (feedback) doesn't feed the evaluation → same key.
canvas.metadata = { ...canvas.metadata, feedback: [{ id: 'fb-1', note: 'nudge left', createdAt: 'x' }] } as typeof canvas.metadata;
check('unrelated metadata (feedback) → key unchanged', evalCacheKey(canvas) === k1);

// Tree edits move the key.
parseAndExecute(canvas.root, `U(${JSON.stringify(canvas.root.children![0].id)}, { fill: "#0F172A" })`, canvas);
const k2 = evalCacheKey(canvas);
check('tree edit → new key', k2 !== k1);

// Canvas-level token edits move the key (tokens feed contrast/cliché checks).
canvas.variables = { ...canvas.variables, colors: { accent: '#2563EB' } };
check('token edit → new key', evalCacheKey(canvas) !== k2);

console.log(allPass ? '\nAll eval-cache-key tests passed.' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

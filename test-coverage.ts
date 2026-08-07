// Phase 24 slice C — the coverage category: data-bearing screens DEMAND
// designed state variants (warning severity, directive-blocking). Tables →
// empty + loading; forms (3+ controls) → error. Variant canvases and
// non-data screens are silent. Detection reuses the drift inventory.
//
// Usage: npx tsx test-coverage.ts

import './test-env.js';
import { createCanvas, addVariant } from './src/scene-graph.js';
import { parseAndExecute } from './src/operations.js';
import { evaluateCanvas } from './src/evaluate.js';
import { listCanvases } from './src/scene-graph.js';

let allPass = true;
function check(name: string, cond: boolean, extra?: string) {
  if (!cond) allPass = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

/** A canvas containing a detectable table (header row + data rows). */
function tableCanvas(name: string) {
  const c = createCanvas(name);
  parseAndExecute(c.root, `
t=I("document", { type: "frame", layout: "vertical", gap: 0 })
h=I(t, { type: "frame", layout: "horizontal", gap: 16 })
I(h, { type: "frame", children: [] })
hc1=I(h, { type: "frame" })
I(hc1, { type: "text", content: "NAME" })
hc2=I(h, { type: "frame" })
I(hc2, { type: "text", content: "STATUS" })
r1=I(t, { type: "frame", layout: "horizontal", gap: 16 })
c1=I(r1, { type: "frame" })
I(c1, { type: "text", content: "Live" })
c2=I(r1, { type: "frame" })
I(c2, { type: "text", content: "active" })
r2=I(t, { type: "frame", layout: "horizontal", gap: 16 })
c3=I(r2, { type: "frame" })
I(c3, { type: "text", content: "VOD" })
c4=I(r2, { type: "frame" })
I(c4, { type: "text", content: "paused" })
`, c);
  return c;
}

const states = (id: string) => listCanvases().find((r) => r.id === id)?.variants?.map((v) => v.state) ?? [];

// ── table, no variants → two blocking warnings ──────────────────────────────
{
  const c = tableCanvas('Orders');
  const r = await evaluateCanvas(c, { mode: 'fast', designedStates: states(c.id) });
  const cov = r.issues.filter((i) => i.category === 'coverage');
  check('table w/o variants → 2 coverage warnings', cov.length === 2 && cov.every((i) => i.severity === 'warning'), JSON.stringify(cov.map((i) => i.message)));
  check('warnings name the missing states', cov.some((i) => i.message.includes('"empty"')) && cov.some((i) => i.message.includes('"loading"')));
  check('suggestions name the variant + scaffold path', cov.every((i) => i.suggestion?.includes('canvas_add_variant')));
  check('coverage report shape', r.coverage?.dataBearing === true && r.coverage.missing.sort().join(',') === 'empty,loading' && r.coverage.states.length === 0, JSON.stringify(r.coverage));
  check('coverage category scored', r.categories.some((cat) => cat.name === 'coverage' && cat.score === 30));
}

// ── designing the states clears the warnings ────────────────────────────────
{
  const c = tableCanvas('Orders Covered');
  addVariant(c.id, 'empty');
  addVariant(c.id, 'loading');
  const r = await evaluateCanvas(c, { mode: 'fast', designedStates: states(c.id) });
  check('designed states → zero coverage issues', r.issues.filter((i) => i.category === 'coverage').length === 0);
  check('report reflects designed states', r.coverage?.missing.length === 0 && r.coverage.states.sort().join(',') === 'empty,loading', JSON.stringify(r.coverage));

  // Partial: only empty designed → only loading missing.
  const p = tableCanvas('Orders Partial');
  addVariant(p.id, 'empty');
  const rp = await evaluateCanvas(p, { mode: 'fast', designedStates: states(p.id) });
  check('partial coverage → only the gap warns', rp.coverage?.missing.join(',') === 'loading', JSON.stringify(rp.coverage));
}

// ── forms demand an error state ─────────────────────────────────────────────
{
  const c = createCanvas('Settings Form');
  parseAndExecute(c.root, `
f=I("document", { type: "frame", layout: "vertical", gap: 12 })
I(f, { type: "text", content: "Notifications" })
I(f, { type: "toggle", checked: true })
I(f, { type: "checkbox" })
I(f, { type: "select", value: "Daily" })
`, c);
  const r = await evaluateCanvas(c, { mode: 'fast', designedStates: [] });
  const cov = r.issues.filter((i) => i.category === 'coverage');
  check('form (3 controls) → error state demanded', cov.length === 1 && cov[0].message.includes('"error"'), JSON.stringify(cov));
}

// ── silent cases ────────────────────────────────────────────────────────────
{
  const marketing = createCanvas('Marquee');
  parseAndExecute(marketing.root, `
h=I("document", { type: "frame", layout: "vertical", gap: 16 })
I(h, { type: "text", content: "Ship designs your users can feel" })
I(h, { type: "text", content: "A visual canvas for AI assistants" })
`, marketing);
  const r = await evaluateCanvas(marketing, { mode: 'fast', designedStates: [] });
  check('non-data screen → no coverage findings', r.issues.filter((i) => i.category === 'coverage').length === 0);
  check('non-data report: dataBearing false', r.coverage?.dataBearing === false && r.coverage.missing.length === 0, JSON.stringify(r.coverage));

  // A variant canvas is itself a designed state — no recursion.
  const base = tableCanvas('Streams');
  const { canvas: variant } = addVariant(base.id, 'empty');
  const rv = await evaluateCanvas(variant, { mode: 'fast', designedStates: [] });
  check('variant canvas → no coverage findings', rv.issues.filter((i) => i.category === 'coverage').length === 0);
  check('variant canvas → no coverage report', rv.coverage === undefined);

  // Category filter excludes it entirely.
  const rf = await evaluateCanvas(tableCanvas('Filtered'), { mode: 'fast', categories: ['spacing', 'color'], designedStates: [] });
  check('categories filter excludes coverage', rf.coverage === undefined && !rf.categories.some((c2) => c2.name === 'coverage'));

  // Two controls only — not a form yet.
  const duo = createCanvas('Two Controls');
  parseAndExecute(duo.root, `
f=I("document", { type: "frame", layout: "vertical" })
I(f, { type: "toggle" })
I(f, { type: "checkbox" })
`, duo);
  const rd = await evaluateCanvas(duo, { mode: 'fast', designedStates: [] });
  check('2 controls → below the form threshold, silent', rd.issues.filter((i) => i.category === 'coverage').length === 0);
}

// ── table inside a stamped component still detected ─────────────────────────
{
  const c = createCanvas('Shell Instance');
  const inner = tableCanvas('donor');
  c.components['cmp-table'] = structuredClone(inner.root.children![0]);
  parseAndExecute(c.root, `I("document", { type: "instance", componentId: "cmp-table" })`, c);
  const r = await evaluateCanvas(c, { mode: 'fast', designedStates: [] });
  check('table inside an instance → still demands states', (r.coverage?.missing ?? []).length === 2, JSON.stringify(r.coverage));
}

console.log(allPass ? '\nAll coverage tests passed.' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

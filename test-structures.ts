// T2a runtime smoke test: registry behavior + structure invariants.
// Run: npx tsx test-structures.ts
import { listStructures, getStructure, registerStructure } from './src/structures.js';
import type { SceneNode, Structure } from './src/types.js';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) { console.log(`  ✓ ${msg}`); } else { console.error(`  ✗ ${msg}`); failures++; };
};

const AXES = {
  heroTreatment: ['none', 'marquee', 'split', 'stat-led', 'editorial'],
  density: ['airy', 'balanced', 'dense'],
  rhythm: ['uniform', 'alternating', 'asymmetric'],
  alignment: ['centered', 'left', 'split'],
} as const;

// Only these fields may carry a `$token` ref; everything else must be literal
// (the A-P4 theming split — geometry stays crash-safe on unthemed canvases).
const COLOR_FIELDS = new Set(['fill', 'color', 'stroke', 'iconColor']);
// Phase 27 slice B — density/depth/type live on tokens too. These fields may
// carry $refs ('$space-*', '$radius-*', '$elevation.*', '$title'); anything
// else stringly-$ is still a violation.
const TOKEN_FIELDS = new Set(['gap', 'rowGap', 'padding', 'cornerRadius', 'shadow', 'fontSize']);

function walk(node: SceneNode, visit: (n: SceneNode) => void): void {
  visit(node);
  node.children?.forEach((c) => walk(c, visit));
}

// Count-independent: the live catalogue is the source of truth (the roster
// grew far past the Phase 11 six this file used to hard-code).
const PAGES = listStructures().filter((s) => s.kind === 'page').map((s) => s.name);
const NAMES = PAGES;

console.log('listStructures()');
const list = listStructures();
check(list.length >= 12, `catalogue holds pages + components (got ${list.length})`);
check(PAGES.length >= 6, `at least the original six page structures (got ${PAGES.length})`);
check(list.filter((s) => s.kind === 'page').every((s) => !!s.name && !!s.description && !!s.axes), 'each page entry has name + description + axes');

console.log('getStructure()');
for (const name of NAMES) check(!!getStructure(name), `resolves '${name}'`);
check(getStructure('does-not-exist') === undefined, 'unknown name → undefined');

console.log('taxonomy — every structure tagged on all 4 axes with valid values');
for (const name of NAMES) {
  const s = getStructure(name)!;
  for (const axis of Object.keys(AXES) as (keyof typeof AXES)[]) {
    const v = s.axes[axis];
    check((AXES[axis] as readonly string[]).includes(v), `${name}.${axis} = '${v}' is valid`);
  }
}

console.log('structure has placeholder nodes');
for (const name of NAMES) {
  const s = getStructure(name)!;
  check(Array.isArray(s.nodes) && s.nodes.length > 0, `${name} has nodes`);
}

console.log('theming split — $tokens only in color or token-bearing fields (A-P4 + Phase 27B)');
for (const name of NAMES) {
  const s = getStructure(name)!;
  const violations: string[] = [];
  s.nodes.forEach((root) => walk(root, (n) => {
    for (const [k, val] of Object.entries(n)) {
      const holds = (v: unknown): boolean => typeof v === 'string' && v.startsWith('$');
      if ((holds(val) || (Array.isArray(val) && val.some(holds))) && !COLOR_FIELDS.has(k) && !TOKEN_FIELDS.has(k)) {
        violations.push(`${n.id}.${k}=${JSON.stringify(val)}`);
      }
    }
  }));
  check(violations.length === 0, `${name} keeps $tokens in sanctioned fields${violations.length ? ` (offenders: ${violations.join(', ')})` : ''}`);
}

console.log('all node ids are unique within a structure');
for (const name of NAMES) {
  const s = getStructure(name)!;
  const ids: string[] = [];
  s.nodes.forEach((root) => walk(root, (n) => ids.push(n.id)));
  check(new Set(ids).size === ids.length, `${name} has ${ids.length} unique ids`);
}

console.log('registerStructure() adds a new entry');
const stub: Structure = {
  name: 'test-stub', description: 'temp', axes: { heroTreatment: 'none', density: 'balanced', rhythm: 'uniform', alignment: 'left' }, nodes: [{ id: 't', type: 'frame' }],
};
registerStructure(stub);
check(getStructure('test-stub')?.description === 'temp', 'registered stub is retrievable');
check(listStructures().length === list.length + 1, `list grows by one after registration`);

console.log(failures === 0 ? '\nT2a SMOKE TEST PASSED ✅' : `\nT2a SMOKE TEST FAILED ✗ (${failures})`);
process.exit(failures === 0 ? 0 : 1);

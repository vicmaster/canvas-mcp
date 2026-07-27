// Phase 23 slice A (#149) — a stable content hash per canvas, so "approved"
// can be falsifiable: a gate records the hash at approval time and can later
// verify the approved canvas is still the current design. The hash covers the
// DESIGN CONTENT only (root tree, canvas tokens, component registry, fonts) —
// never metadata (feedback arriving/resolving, critique stamps, provenance),
// timestamps, or store identity — so an approval survives everything except an
// actual design change, and the same design hashes identically in every
// process and on every machine.

import { createHash } from 'node:crypto';
import type { Canvas } from './types.js';

/**
 * Deterministic JSON: object keys recursively sorted, arrays kept in order,
 * `undefined` object members dropped (mirroring JSON.stringify), no
 * whitespace. Never injects defaults — absent and present-but-empty are
 * different inputs and the CALLER decides any normalization.
 */
export function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalSerialize(v))).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalSerialize(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * `sha256:<first 16 hex>` over the canvas's design content. Node IDs in the
 * tree ARE included — an ID rewrite is a real change to the checked-in JSON,
 * and a false "changed" is the safe direction for a gate. `fonts` is
 * normalized to [] so a canvas that never touched fonts hashes the same
 * before and after the field first appears.
 */
export function canvasVersionHash(canvas: Canvas): string {
  const payload = canonicalSerialize({
    root: canvas.root,
    variables: canvas.variables,
    components: canvas.components,
    fonts: canvas.fonts ?? [],
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex').slice(0, 16)}`;
}

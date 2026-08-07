# Phase 24 — Every State, Every String (v1.11)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-08-07.
> Source: the design-quality cluster brainstorm (2026-08-07) — the "states + stress testing" head of it. No single triggering issue; the evidence is every dogfooding session designing only the happy path.

---

## 1. SPECIFY

### Problem

framesmith designs **the happy path of a single static frame with ideal data**. Two failure modes follow:

1. **The states nobody designed.** Real UX quality lives in what happens when the table is empty, the data is loading, the form errors. "The three states AI almost never builds correctly" is a recognized industry failure meme — and framesmith currently *reinforces* it: the evaluator can pass a data screen at 98/100 without anyone ever asking "what does this look like empty?" A designer reviewing the mockup asks that first.
2. **Mockups that break under real content.** A design that's beautiful with "Jane Chen · $1.52M" clips with "Dr. Alexandria Konstantinopoulos-Whitfield · $1,520,847.33", wraps ugly in German, and blows the badge layout at "999+". Nothing renders these cases until the shipped app does — and then the shipped app looks worse than its approved canvas through no drift of its own.

Both are the same disease: **the design contract covers one point in a space of states and contents, and everything off that point is undesigned.** framesmith's moat is turning taste rules into enforcement — this phase does it for state coverage and content robustness.

Market context (2026 reviews): first-draft quality across AI UI tools has converged; the differentiator is post-generation depth. "Every state designed, verified against hostile content" is a story none of them tell.

### Goals

- **States are first-class**: one call clones a screen into a linked `empty` / `loading` / `error` variant; the viewer shows a screen as one card with state chips; scaffolds make the empty/skeleton patterns one stamp, not hand-built.
- **The evaluator demands coverage**: a data-bearing screen with no empty/loading variant is NOT READY — the same teeth contrast and cliché tells already have.
- **Content robustness is mechanical**: `canvas_stress` re-renders the design under hostile-but-realistic content perturbations and reports exactly what clipped, overflowed, or degenerated — no judgment calls.

### User stories

- **US1** — As the authoring agent, `canvas_add_variant(orders, "empty")` gives me a linked clone (with an old→new id map) where I delete the rows and stamp the `empty-state` scaffold — the whole variant is minutes, not a rebuild.
- **US2** — As the authoring agent, `canvas_evaluate` on a table screen without an empty variant tells me `[warning] coverage: no "empty" variant designed` and the directive stays NOT READY — I can't present a half-designed screen by accident.
- **US3** — As the reviewing human, the viewer shows "Orders" as one card with `default · empty · loading` chips — I review the screen as a set, not as three unrelated canvases.
- **US4** — As the authoring agent, `canvas_stress(orders)` tells me the customer-name cell clips at long names and the badge overflows at "999+", each with the node id — I fix `minWidth`/wrapping *before* presenting, instead of the shipped app discovering it.
- **US5** — As a loading-state author, `{ type: "skeleton", width: "60%" }` renders a correct neutral block — I never fake skeletons from gray rectangles with hand-picked fills.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **Variant links** — `metadata.variant = { of: <baseCanvasId>, state: <string>, at }` marks a canvas as a state variant of a base canvas. `canvas_add_variant({ canvasId, state })` clones the base (new canvas, re-keyed node IDs, same project), names it `<base> · <state>`, stamps the link, and returns `{ canvasId, idMap }` (old→new node ids so follow-up edits can target cloned nodes directly). Adding a variant to a canvas that is itself a variant links to the ROOT base (flattening). | Cloning `orders` into `empty` yields a canvas whose evaluate/screenshot/hash/drift all work unchanged; `idMap` resolves every base node; re-adding the same state errors (one canvas per state per base). |
| FR-A2 | **Variants surfaced where agents look** — `canvas_list` rows carry `variant: { of, state }` on variant rows and `variants: [{ state, canvasId }]` on base rows that have them. | An agent can enumerate a screen's designed states from one listing. |
| FR-A3 | **Viewer grouping** — the gallery renders a base canvas and its variants as ONE card with state chips (default first); the detail page cross-links sibling states. Orphaned variants (base deleted) render standalone without crashing. | The Orders screen is one gallery card with 3 chips. |
| FR-B1 | **`skeleton` node type** — a neutral loading-placeholder block: `width`/`height`/`cornerRadius`, fill derived from tokens (border/neutral alpha chain like `applyControlDefaults`), optional `pulse: false`. The pulse animation renders ONLY in live viewer contexts — screenshots/exports/diffs render static (determinism: `canvas_diff` and `computeDiff` must not flicker). | A skeleton row renders as calm neutral blocks in screenshots; two consecutive screenshots are byte-comparable. |
| FR-B2 | **State scaffolds** — component-kind structures: `empty-state` (icon + title + one-line hint + optional CTA, taste-vetted), `skeleton-table` (header row + N skeleton rows matching data-table geometry), `skeleton-card`. Stamp under any `targetId` with re-keyed IDs + idMap like existing component structures. | An empty state is one `apply_structure` call; the stamped result evaluates > 95 standalone. |
| FR-C1 | **State-coverage check** — new evaluate category `coverage`: a BASE canvas whose tree contains data-bearing content — a detected table/list (drift.ts `detectTable` + repeated same-shape rows) or a form (≥ 3 input controls) — warns per missing state: `empty` + `loading` for tables/lists, `error` for forms. Variant canvases themselves and non-data screens get no coverage findings. Severity **warning** (directive-blocking) per the decided fork. Evaluate results include which states exist (`coverage: { dataBearing, states, missing }`). | The orders-table canvas with no variants is NOT READY with two coverage warnings; after `canvas_add_variant` ×2 (designed), it can pass; `marquee-hero` shows zero coverage findings. |
| FR-D1 | **Perturbation engine** (pure, `src/stress.ts`) — named content perturbations transform a tree copy and report touched node ids: `long-text` (×2.2 + one long unbroken token on non-data-like text), `i18n` (×1.4 length), `big-numbers` (numeric/badge text → widest realistic form, "9" → "999+", "$1.5M" → "$1,520,847.33"), `empty` (table/list data rows removed via the drift inventory), `many` (data rows ×3). | Each perturbation is fixture-testable without Chrome; `empty`/`many` reuse `detectTable` so tables and hand-built lists both perturb. |
| FR-D2 | **Breakage detection** — render baseline + each perturbed tree, compare via `computeLayout` (extended to capture per-node `scrollWidth`/`clientWidth`/`scrollHeight`): findings `clip` (scroll > client), `overflow-x` (child rect exceeds parent/canvas right edge), `layout-shift` (a node's height grows > 2× baseline). Elements with an intentional CSS ellipsis are reported at `info` (truncation may be designed), everything else `warning`. | The long-name cell yields a `clip` finding naming the node; the fixed-width badge yields `overflow-x` under `big-numbers`; a healthy fluid layout returns zero warnings under all perturbations. |
| FR-D3 | **`canvas_stress` tool** — `{ canvasId, perturbations? }` → `{ findings (per perturbation, with nodeIds), counts, verdict }`; never mutates the canvas; optional `screenshots: true` attaches the failing renders. Chrome required; pure engine + fixtures keep the logic testable without it. | Running on the pace dashboard returns actionable findings or a clean bill; re-running after fixes returns clean. |
| FR-E1 | **Workflow on the agent surfaces** — INSTRUCTIONS/GOTCHAS/WORKFLOW_CHEATSHEET: "design every state" (variants before presenting data screens) and "stress before present" join the loop; GUIDELINES gains a "Design every state" section + stress workflow; `test-discoverability.ts` pins the new tools (auto), the `skeleton` node type (auto via section 4), the coverage category, the state names, and the perturbation names. | An agent reading only connect-time instructions knows data screens need designed states and a stress pass before presenting. |

### Non-goals (explicit scope cuts)

- **No node-level interaction pseudo-states** (hover/focus/active/disabled styling variants) — different mechanism (CSS pseudo-classes, not screen clones); deserves its own phase if demanded. `disabled` already exists on controls.
- **No in-canvas variant overrides** (decided 2026-08-07): variants are sibling canvases, not override sets inside one canvas.
- **No coverage waiver mechanism** in v1 — the decided fork is a plain warning gated on data-bearing detection. If dogfooding surfaces a legitimate never-empty data screen, revisit (the waivable-warning design was sketched and parked).
- **No auto-generated variant content** — `canvas_add_variant` clones; the agent designs the state (scaffolds make it cheap). No LLM in this phase.
- **No stress auto-fix** — findings name nodes; the fix (fluid widths, minWidth, wrapping) is design judgment the GUIDELINES already teach.
- **No `framesmith stress` CLI subcommand yet** — defer until CI demand is proven (the CLI dispatch makes it a small later addition).

---

## 2. CLARIFY  (forks — recommendations; ★ = user-confirmed)

- **C1 — Variant model.** ★ **Decided 2026-08-07: sibling canvases linked via `metadata.variant`**, cloned by `canvas_add_variant`. Rejected: in-canvas override sets (hard to author via ops; every tool grows a variant param; hash/drift/evaluate all need variant awareness). Cost accepted: shared edits repeat per variant — mitigated by components (shared chrome is instances; `copy_nodes` carries fixes across).
- **C2 — Coverage teeth.** ★ **Decided 2026-08-07: warning (directive-blocking) when data-bearing content is detected**; silent otherwise. Rejected: info-only (that's how states get skipped today); waivable warning (deferred, see non-goals).
- **C3 — Skeleton: node type vs structure-only.** *Recommend:* a real `skeleton` node type + scaffolds built from it. A structure alone would bake specific gray fills into stamped trees (exactly the fake-controls anti-pattern the toolkit exists to avoid); a node type gets token-derived color right everywhere and reads honestly in JSON. Cost: the full node-type surface tax (types union, renderer, docstrings, README, discoverability) — known and mechanical.
- **C4 — Which states are demanded.** *Recommend:* `empty` + `loading` for tables/lists; `error` for forms (≥ 3 input controls). `partial`/`degraded`/`offline` stay recommended-but-not-demanded vocabulary (the `state` field is a free string; the check only demands the core trio).
- **C5 — Coverage placement.** *Recommend:* a NEW evaluate category `coverage` rather than folding into `structure` — cleanly filterable (`categories: [...]` lets a caller exclude it deliberately), its own weight, and the category list is already a maintained surface. Cost: enum churn in evaluate/autofix schemas — one-time.
- **C6 — Variant-of-variant.** *Recommend:* flatten — `canvas_add_variant` on a variant links the new canvas to the ROOT base. A variant tree deeper than one level has no UX meaning and complicates the viewer grouping.
- **C7 — Perturbation set v1.** *Recommend:* the five in FR-D1 (long-text, i18n, big-numbers, empty, many). Rejected for v1: RTL flip (rendering direction is a bigger feature than a perturbation), timezone/locale date formats (data-like text is already skipped by design elsewhere; widening covers the layout risk).
- **C8 — Where stress renders.** *Recommend:* reuse the screenshot pipeline (`prepareRender` + `computeLayout`), one render per perturbation, sequential — 6 renders total on default settings is acceptable; no parallel-page complexity in v1.

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — variant links (`canvas_add_variant`)**
- `src/scene-graph.ts`: `deepCloneWithNewIds` (scene-graph.ts:466) grows an id-map-returning form (or a wrapper collecting old→new during the walk); new `addVariant(baseId, state)` — resolve root base (flatten per C6), reject duplicate state, clone root tree + variables + components + fonts, name `<base> · <state>`, stamp `metadata.variant`, persist via the normal create path.
- `src/index.ts`: `canvas_add_variant` tool (thin handler; `ensureFresh` the base first). `canvas_list` rows: `variant` on variants, `variants` rollup on bases (extend `CanvasSummary`).
- `src/viewer.ts`: gallery groups variants under the base card (state chips); detail page cross-links; orphan-safe.
- Tests: `test-variants.ts` — clone fidelity, idMap completeness, flattening, duplicate-state rejection, list rollups, orphan tolerance.

**Slice B — skeleton node + state scaffolds**
- `src/types.ts`: `'skeleton'` in the NodeType union (+ `pulse?: boolean`).
- `src/renderer.ts`: `renderSkeleton` (leaf, hand-rolled styles like `renderToggle`; token-derived neutral via the `applyControlDefaults` chain in `variables.ts`); pulse keyframes emitted only when the render context is the live viewer (renderer option, default static — screenshots/exports/diffs stay deterministic).
- `src/structures.ts`: component-kind `empty-state`, `skeleton-table`, `skeleton-card` (gate: each stamps > 95 standalone, zero cliché tells, like the Phase 20 library).
- Tests: `test-skeleton.ts` (render + defaults + determinism), structure additions covered by the existing structure test pattern.

**Slice C — coverage category**
- `src/evaluate.ts`: `checkCoverage(canvas, entries, opts.variants)` — data-bearing detection reuses `detectTable`/inventory shapes from `src/drift.ts` (export what's needed) + a ≥3-controls form rule; emits per-missing-state warnings; result gains `coverage: { dataBearing, states, missing }`. New `coverage` entry in `CATEGORY_WEIGHTS` + the categories enums (evaluate/autofix schemas).
- `src/index.ts`: the evaluate/autofix handlers collect the canvas's variant states from the store (`listCanvases()` rollup) and pass them in; variant canvases skip the check.
- `src/viewer.ts`: quality panel shows coverage findings like any category.
- Tests: `test-coverage.ts` — table/no-variants warns ×2, form warns error-state, variants present → clean, variant canvas itself → no findings, marketing page → no findings, categories filter excludes it.

**Slice D — stress**
- NEW `src/stress.ts`: pure perturbation table (`perturbations: Record<name, (root) => { root, touched }>`) reusing the drift inventory for `empty`/`many`; `compareLayouts(baseline, perturbed)` → findings per FR-D2.
- `src/screenshot.ts`: `computeLayout` DOM walk grows `scrollWidth`/`clientWidth`/`scrollHeight` + text-overflow style capture (for the ellipsis-is-info rule).
- `src/index.ts`: `canvas_stress` tool — `prepareRender` once, render baseline + each perturbation, compare, aggregate `{ findings, counts, verdict }`; optional screenshots.
- Tests: `test-stress.ts` (pure: perturbation outputs + compareLayouts fixtures), `test-stress-render.ts` (Chrome: a rigid fixture that clips + a fluid fixture that doesn't).

**Slice E — surfaces + guards**
- INSTRUCTIONS/GOTCHAS/WORKFLOW_CHEATSHEET: "design every state" + "stress before present" join the core loop; GUIDELINES "Design every state" section (variants, scaffolds, coverage semantics, stress workflow); README tool sections land with their slices (same-PR rule), E carries the workflow prose.
- `test-discoverability.ts`: new section pins the coverage category, the demanded state names, and the perturbation names to index.ts + GUIDELINES (+ README); tools/node types ride the existing sections.
- docs-steward before each slice PR, per repo convention.

**Order:** A → B → C → D → E. C needs A (variants to count) and benefits from B (scaffolds make satisfying the warning cheap — never ship the demand before the easy path to meet it). D is independent of A–C but shares drift-inventory exports with C, so it follows. Each slice is one PR.

---

## 4. TASKS

- [ ] **T1 (A)** `canvas_add_variant` + variant links + `canvas_list` rollups + `test-variants.ts`
- [ ] **T2 (A)** viewer grouping (chips, cross-links, orphan-safe)
- [ ] **T3 (B)** `skeleton` node type (static-by-default pulse) + `test-skeleton.ts`
- [ ] **T4 (B)** `empty-state` / `skeleton-table` / `skeleton-card` scaffolds, taste-gated
- [ ] **T5 (C)** `coverage` category + data-bearing detection (drift-inventory reuse) + handler wiring + `test-coverage.ts`
- [ ] **T6 (D)** `src/stress.ts` engine + `computeLayout` extension + `canvas_stress` + `test-stress.ts` / `test-stress-render.ts`
- [ ] **T7 (E)** surfaces + GUIDELINES section + discoverability pins + steward pass

---

## 5. ANALYZE  (risks & checks)

- **Coverage-warning friction.** The check fires on data-bearing detection, and detection can be wrong in both directions. False positive (a decorative table on a marketing page) → the `categories` filter is the escape hatch and the finding text should say so; false negative (a list the detector misses) → coverage quietly doesn't fire, which is today's status quo, not a regression. Watch the first dogfooding round; the parked waiver design is the pressure valve if a legit never-empty screen appears.
- **Sequencing risk: teeth before tools.** If C ships before A/B, agents get blocked with no cheap way to comply. The slice order (A, B before C) is a hard dependency, not a preference.
- **Variant sprawl.** Three canvases per screen triples repo JSON files. Mitigations: variants are opt-in per screen (coverage only demands them where data lives), the viewer collapses them to one card, and `metadata.variant` keeps `canvas_list` groupable. Names follow one convention (`<base> · <state>`) so the sprawl at least reads.
- **Stress false positives.** Intentional truncation (ellipsis) is a designed behavior — hence the `info` severity for ellipsis-styled clips. `many` on an already-tall page will always grow height — `layout-shift` compares per-node against baseline, not absolute size, and row-container growth from added rows must be exempted (only NON-perturbed nodes shifting counts).
- **Skeleton determinism.** The pulse animation must never reach `computeDiff`/`canvas_diff`/screenshot paths or visual regression baselines start flickering — static-by-default is a correctness requirement, and `test-skeleton.ts` asserts byte-comparable consecutive renders.
- **Scope discipline.** The gravitational pull is toward interaction states (hover/focus) and auto-generated content. Both are named non-goals; the phase is screen-level states + content robustness, nothing more.

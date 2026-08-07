# Phase 26 — Beyond One Canvas (v1.13)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-08-07.
> Source: the design-quality cluster (2026-08-07) — its final third: points 5 (grid authoring), 6 (project-level consistency), 12 (multi-screen flow critique). Phases 24–25 shipped points 1–4 and 7–11.

---

## 1. SPECIFY

### Problem

Everything framesmith enforces today is enforced **per canvas** — but products are *sets* of screens, and two whole classes of quality live only at the set level:

1. **Compositional ceiling.** Agents can author flex (`horizontal`/`vertical` + wrap) but not CSS grid — so the bento, editorial, and asymmetric compositions that define modern product marketing get approximated with nested-flex mush. The importer *reads* grid (Phase 18 reduces computed templates to proportional rows); authoring is the gap. The 2026 tool reviews are blunt: first drafts converged, and *cross-screen consistency + compositional range* is where tools differentiate.
2. **Cross-screen drift.** Screen A uses radius 8/16, screen B uses 6/12; the accent is blue on one screen and teal on another; the app shell is a hand-rebuilt near-copy on every canvas instead of a component. Every one of those passes the per-canvas evaluator — "wow" products are consistent *across* screens, and no check can see it.
3. **Flow blindness.** The LLM judge critiques one screenshot in a vacuum. Nielsen-level flow heuristics — consistent navigation and terminology, visibility of status *across* a journey — need the screen set. This is an active research area (AIHeurEval: multi-screen heuristic evaluation with MLLMs; UXBench: critique *actionability* is what matters), and `canvas_revise` already proved the actionability contract per canvas.

The moat framing holds one more time: turn set-level taste rules into things the evaluator **sees**.

### Goals

- **Author real grid**: `layout: "grid"` with column templates and cell spans — bento tiles as first-class layout, not flex approximation.
- **Evaluate the project, not just the canvas**: a `project_evaluate` roll-up with cross-screen checks (radius/accent/token drift, hand-copied shells, state-coverage table) — advisory, since the per-canvas directive stays the enforcement gate.
- **Critique the flow**: an opt-in multi-screen LLM pass scoring flow-level heuristics against a fixed rubric, per-screen actionable.

### User stories

- **US1** — As the authoring agent, `I("document", { layout: "grid", gridColumns: [2, 1, 1], gap: 16 })` with a child carrying `gridColumn: "span 2"` gives me a real bento composition; `responsive: "stack"` collapses it to one column on mobile.
- **US2** — As the authoring agent finishing a 6-screen module, `project_evaluate` tells me screen 4 uses a different radius scale, screen 5's accent is off-brand, and screens 2–6 carry hand-rebuilt copies of screen 1's shell — with the `create_component` + `copy_nodes` path named.
- **US3** — As the reviewing human, the same roll-up gives me one table: per-screen scores, designed states, and the cross-screen findings — the project-level "is this coherent?" answer no single canvas can give.
- **US4** — As the authoring agent with an API key, `project_evaluate({ mode: "llm" })` adds a flow critique: navigation drift between screens 2 and 3, a term that changes name mid-flow, an action with no visible result state — each note anchored to a screen.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **Grid layout** — `layout: "grid"` on frames; `gridColumns: number \| (number\|string)[] \| string` (count → equal `fr`s; array → fr weights and/or px strings; raw string sanitized); children may carry `gridColumn` / `gridRow` (`"span 2"`, `"1 / 3"`, or a number). `gap` applies both axes; new `rowGap?` overrides the row axis. Rows are auto (`grid-auto-rows`) — column templates + spans cover the bento/editorial target; row templates/areas are out of scope. | The classic bento (one 2×2 hero tile + four 1×1 tiles over a 4-column template) is one grid frame + five children with spans; unsafe template strings are dropped, never injected. |
| FR-A2 | **Grid responds** — `responsive: "stack"` on a grid frame collapses it to a single column below the mobile breakpoint (spans reset); the existing responsive machinery (`buildRendererStylesheet`, renderer.ts:797) carries it. | The bento renders single-column at 390px with no overlap; `snapshot_layout` / `canvas_stress` see the real geometry in both. |
| FR-A3 | **Grid lands in the toolkit** — the `bento-grid` structure is rebuilt on real grid (taste gate holds: > 95, zero tells); GUIDELINES width-strategy/patterns sections gain the grid recipe; evaluator consistency check ("frames with children but no layout") accepts `grid`; the drift/coverage table detector must NOT misread grid containers as tables (guard + test). | Stamping `bento-grid` yields a grid-layout scaffold; existing suites stay green. |
| FR-B1 | **`project_evaluate` roll-up** (fast, Chrome-free) — for every non-variant canvas in a project: fast-evaluate summary (score, blocking count, designed states). Plus cross-screen checks, all ADVISORY (info/warning, no new gate — the per-canvas directive stays the enforcement): **radius-scale drift** (canvases whose cornerRadius sets disagree), **accent drift** (dominant accent hue differs across screens), **token-adoption outliers** (a canvas far below the project's tokenUsagePercent norm), **hand-copied chrome** (structurally similar top-level non-instance frames on ≥ 2 canvases → the `create_component` + `copy_nodes` suggestion), **state-coverage table** (per-screen missing states, aggregated). | On a 6-screen fixture with a rogue radius scale, an off-accent screen, and a copy-pasted shell, each finding names the offending canvases; a coherent project returns clean. |
| FR-B2 | **Roll-up result shape** — `{ canvases: [{ canvasId, name, score, blocking, states, tokenUsagePercent }], findings, counts, verdict }`; variant canvases are excluded from scoring rows but feed the states column of their base. | One call answers "which screens aren't ready and what's inconsistent between them". |
| FR-C1 | **Flow critique** — `project_evaluate({ mode: "llm" })` renders + screenshots up to 8 canvases (project order; the cap and any skipped screens are reported — no silent truncation) and makes ONE multi-image judge call against a FIXED flow rubric: **navigation-consistency**, **terminology-consistency**, **state-visibility**, **hierarchy-consistency** — each 1–5 with rationale and per-screen notes naming the canvas. Reuses the llm-judge plumbing (`judges` provider table, `parseRubric`-style fixed-format parsing, graceful no-key failure). Advisory like the heuristic roll-up; no auto-revision. | The critique names which screen breaks navigation consistency; without an API key the heuristic roll-up still returns with a note. |
| FR-D1 | **Workflow on the agent surfaces** — INSTRUCTIONS/GOTCHAS/WORKFLOW_CHEATSHEET: grid joins the layout vocabulary; "finish a module with project_evaluate" joins the loop; GUIDELINES gains the grid recipe + a "Reviewing the set" section; `test-discoverability` pins the grid props, the cross-screen finding kinds, and the flow-rubric axes. | An agent reading connect-time instructions knows grid exists and that a multi-screen module ends with a project roll-up. |

### Non-goals (explicit scope cuts)

- **No grid row templates or named areas** — column templates + cell spans cover the bento/editorial evidence; `grid-template-areas` is a large authoring surface with no motivating case yet.
- **No importer change** — Phase 18's grid→proportional-rows reduction stays; flipping the importer to emit real grid nodes is a follow-up once authoring proves out (round-trip fidelity would improve, but the import fixture surface is large and stable).
- **No cross-screen auto-fix** — the shell finding *names* the `create_component` + `copy_nodes` path; executing a cross-canvas refactor mechanically is judgment-laden (which canvas is the source of truth?).
- **No flow auto-revision** — `canvas_revise` stays per-canvas; a flow-level revise loop multiplies cost and blast radius for unproven value.
- **No workspace-level roll-up** — projects are the screen-set unit; a workspace spans products.
- **No new gate** — `project_evaluate` is a review surface. The per-canvas directive (score, coverage, feedback) remains the only presentation gate.

---

## 2. CLARIFY  (forks — recommendations; ★ = needs user confirm)

- **C1 — Grid template form.** *Recommend:* `gridColumns` as count (`3` → `repeat(3, 1fr)`), array (`[2, 1, "240px"]` → `2fr 1fr 240px`), or raw string (sanitized against a safe template charset; unsafe → dropped like other CSS-bearing props). Children: `gridColumn`/`gridRow` accepting `"span N"`, `"a / b"`, or a number. Covers every observed bento/editorial case without inventing a DSL.
- **C2 — Importer emitting grid.** *Recommend:* **defer** (non-goal) — authoring first; the importer's proportional-row reduction is well-tested and honest about itself in `report.layout`.
- **C3 — Hand-copied-chrome heuristic.** *Recommend:* a depth-3 shape hash (type + name + child-count tree) of each canvas's top-level frames; the same hash on ≥ 2 canvases where the node is NOT an instance → one advisory naming all carriers. Coarse and cheap; near-copies with small edits hash differently and are missed (false-negative direction — today's status quo), which beats fuzzy matching that accuses legitimate variation.
- **C4 — Flow-critique packaging.** *Recommend:* a `mode: "llm"` on `project_evaluate`, mirroring `canvas_evaluate` exactly (heuristics always run; llm adds depth; one paid call). Alternative — a separate `project_critique` tool — splits one mental model into two tools for no gain.
- **C5 — Screen cap + order.** *Recommend:* first 8 non-variant canvases in `canvas_list` order, `skipped` reported in the result (the no-silent-caps house rule). Larger sets: the agent picks the flow subset by passing `canvasIds`.
- **C6 — Variant handling in the roll-up.** *Recommend:* variants excluded from scoring rows and the flow critique (they'd double-count screens), included as their base row's `states`.
- **C7 — Radius/accent drift thresholds.** *Recommend:* radius — flag when a canvas's radius SET shares no values with the project's modal set (disjoint = different system; overlap = fine); accent — reuse the cliché accent-detection hue math (`rgbToHsl`), flag hue distance > 30° from the project's dominant accent. Both warnings name canvases, both advisory.

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — grid authoring (FR-A1..A3)**
- `src/types.ts`: `layout` union gains `'grid'`; `gridColumns` / `gridColumn` / `gridRow` / `rowGap` props.
- `src/renderer.ts`: grid template builder (count/array/string normalization + sanitization, the `SAFE_*` regex house pattern); child placement styles; `responsive: "stack"` grid collapse in `buildRendererStylesheet` (renderer.ts:797).
- `src/structures.ts`: `bento-grid` rebuilt on grid (gate: `test-patterns.ts` holds it > 95).
- `src/evaluate.ts`: consistency "missing layout" accepts grid. `src/drift.ts`: `detectTable` guard — a `layout: 'grid'` container is never a table.
- Surfaces (same-PR): batch_design docstring (`Node types` untouched; Properties line + a Grid paragraph beside Borders/Charts), README properties + a grid pattern snippet, GUIDELINES width-strategies/patterns recipe.
- Tests: `test-grid.ts` (render forms, spans, sanitization, responsive collapse via Chrome layout, table-detector guard, bento gate).

**Slice B — project roll-up (FR-B1/B2)**
- NEW `src/project-evaluate.ts` (pure-ish core, Chrome-free): per-canvas fast summaries via `evaluateCanvas`; cross-screen checks — radius sets (raw cornerRadius walk), accent hue (`rgbToHsl` reuse), token adoption (stats.tokenUsagePercent), shell shape-hash (C3), coverage aggregation (`listCanvases` variants rollup).
- `src/index.ts`: `project_evaluate` tool ({ projectId, canvasIds?, mode? }).
- Tests: `test-project-evaluate.ts` — the 6-screen drift fixture, the clean fixture, variant exclusion, no-gate assertion (findings never error-severity).

**Slice C — flow critique (FR-C1)**
- `src/llm-judge.ts`: a `judgeFlow(screens: {name, png}[], opts)` sibling to `judgeCanvas` — multi-image prompt, fixed flow rubric, `parseRubric`-style parser (llm-judge.ts:183), same `judges` provider table (:170) and graceful-degradation contract.
- `src/index.ts`: `project_evaluate` mode "llm" renders/screenshots capped screens (`prepareRender` + `takeScreenshot`), attaches `flowCritique` to the result.
- Tests: `test-flow-critique.ts` (stubbed judge, no network — the `test-critique.ts` pattern): parsing, per-screen note anchoring, cap + skipped reporting, no-key fallback.

**Slice D — surfaces + guards (FR-D1)**
- INSTRUCTIONS/GOTCHAS/WORKFLOW_CHEATSHEET: grid vocabulary + "finish the module with project_evaluate"; GUIDELINES "Reviewing the set" section; README sections land with their slices, D carries workflow prose.
- `test-discoverability` section 11: grid prop names, cross-screen finding kinds, flow-rubric axes — pinned to the three surfaces.
- docs-steward per slice; the standing screenshot-refresh flag remains a release-time item.

**Order:** A → B → C → D. A is independent; C builds on B's tool; D closes. One PR per slice.

---

## 4. TASKS

- [ ] **T1 (A)** grid props + renderer + responsive collapse + sanitization + `test-grid.ts`
- [ ] **T2 (A)** `bento-grid` on real grid + evaluator/drift guards + GUIDELINES recipe
- [ ] **T3 (B)** `src/project-evaluate.ts` cross-screen checks + `project_evaluate` tool + `test-project-evaluate.ts`
- [ ] **T4 (C)** `judgeFlow` + mode "llm" wiring + `test-flow-critique.ts`
- [ ] **T5 (D)** workflow surfaces + "Reviewing the set" + discoverability section 11 + steward pass

---

## 5. ANALYZE  (risks & checks)

- **Grid is a renderer-surface expansion** — the largest new CSS surface since charts. The sanitization posture is the house one: safe-charset regexes, unsafe values dropped never escaped, and every emission path tested with an injection-shaped string.
- **Detector interplay.** Grid containers must not confuse the table detector (drift/coverage/stress all share it) — the `layout: 'grid'` guard plus a fixture in `test-grid.ts` AND `test-drift.ts` keeps the shared vocabulary honest.
- **Cross-screen false accusations.** Every roll-up finding is advisory and names its evidence (which canvases, which values). The shell heuristic deliberately misses near-copies rather than accusing legitimate variation (C3). Watch the first dogfooding round before considering any severity increase.
- **Flow-critique cost + variance.** One multi-image call, capped at 8 screens, opt-in behind mode "llm" — same cost posture as `canvas_evaluate` llm. Rubric parsing reuses the fixed-format contract that made `judgeCanvas` testable; the stubbed-judge test pattern keeps CI offline.
- **No new gate, stated everywhere.** The biggest product risk is agents treating the roll-up as another blocking directive and stalling multi-screen work. Every surface says: per-canvas gates enforce; `project_evaluate` reviews.
- **Scope discipline.** The pull is toward grid areas, importer grid emission, and flow auto-revision. All three are named non-goals with their revisit conditions.

# Phase 27 — The Wow Factor (v1.14)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-08-08.
> Source: the release-dogfood review (2026-08-08). Every screen the demo produced passed every gate — score 97–100, zero blocking, stress CLEAN, roll-up COHERENT — and still looked *competent instead of beautiful*. The goal of this phase is the sentence the whole design-quality arc was aiming at: an agent's user looks at the output and says "this tool crafts top-tier UI with top usability."

---

## 1. SPECIFY

### Problem

Phases 12–26 built **subtractive** machinery: the evaluator finds violations, the cliché tells kill slop, autofix repairs mechanics, stress finds breakage, the roll-up finds drift. An agent iterating against that loop converges on *zero defects* — which is the floor, not the ceiling. Three structural reasons the output stalls at "clean but generic":

1. **Agents inherit the taste of what they stamp.** The scaffold library is the real starting point of every design (the operating contract says: never start from a blank canvas), and several archetypes encode dated or minimal patterns: the stat card is a centered icon-over-number block, the app shell is four nav items floating in an empty column, the chart has no y-axis values, the settings screen has no sections and no save affordance, the bento tiles are a title over a void. Iterating to zero defects from a dated archetype produces a *polished dated archetype*.
2. **The generated design system is safe but characterless.** `generate_color_system` + `generate_scale` produce accessible ramps and modular scales — correctness without a point of view. Nothing generates a *design language*: no font pairing, no tracking discipline, no depth/elevation system, one uniform radius, no density stance, no rule for where the accent gets spent. Beauty in reference-class product interfaces comes precisely from those committed choices.
3. **Usability is contrast-deep only.** The evaluator gates WCAG contrast rigorously, but "top usability" also means: controls big enough to hit, labels associated with their fields, focus visibility, honest action copy. None of that is checked, and none of it is rendered (controls have no focus styles at all).

The moat framing one more time: the floor is enforced — now the *starting points and the generators must encode the ceiling*, so any agent gets there by default, deterministically, without an API key. This is explicitly **not** a hand-polished demo: the deliverable is that a cold agent run in any consuming repo produces work at this bar.

### Goals

- **A design language with personality**: one call takes a seed color and a named personality and emits the full token stack — color system (existing engine), a curated font pairing, a type scale with tracking/leading discipline, radius and spacing stances, an elevation (shadow) scale with a dark-theme treatment, motion defaults, and a density profile the scaffolds consume.
- **An archetype library at reference quality**: every structure an agent stamps looks like it came from a top-tier product team — dense, confident, detailed — while still passing every existing gate (pattern taste gate > 95, stress CLEAN, states designed, honest content).
- **A usability layer**: mechanically checkable UX best practices join the evaluator, and controls gain focus-visible rendering.
- **An upward gate**: the LLM vision critique becomes the standard final polish step when a key is present, with the workflow surfaces teaching it.

### User stories

- **US1** — As the authoring agent, `generate_design_system({ seed: "#0E7490", personality: "technical" })` gives me everything the old two calls gave *plus* a font pairing that loads real faces, `$elevation.*` shadow tokens, a radius stance, and a density profile — and a different personality visibly changes the character of the same seed.
- **US2** — As the authoring agent, stamping `dashboard` now yields a shell with grouped navigation, an account row, and a topbar; stat cards with left-aligned labels, big tabular numbers, and delta chips; a chart with labeled axes. I customize copy and data — the taste is already there.
- **US3** — As the authoring agent, `canvas_evaluate` warns me that a toggle sits in a 20px hit area, that an input control has no associated label, and that a button says "Click here" — before any human sees it.
- **US4** — As the reviewing human, the same six-screen demo pipeline re-run on this phase produces screenshots someone would save as a reference — that is the acceptance bar, verified by the vision judge scoring ≥ 4 on every axis when a key is present.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **`generate_design_system` tool** — inputs: `seed` (hex), `personality` (`"technical" \| "editorial" \| "soft" \| "data-dense"`), optional `baseSize` / `ratio` overrides, and the existing single-scope target (canvasId / projectId / workspaceId). Composes the existing color engine and scale math, then adds what personality contributes: a curated font pairing (display + body from a vetted table, loaded through the existing font resolution so the first screenshot renders real faces), typography tokens with per-role tracking and leading, a radius stance (e.g. technical = 6/10, soft = 12/20), spacing/density values, `$elevation.*` tokens, and motion defaults. Writes through the same layered-token contract as `generate_color_system` (inherited tokens preserved and reported). | Same seed, two personalities → visibly different type, depth, radii, and density; every generated combination passes the full evaluator including both themes; no API key involved. |
| FR-A2 | **Elevation tokens** — new `DesignVariables.elevation?: Record<string, ShadowSpec[]>` referenced from nodes as `shadow: "$elevation.<name>"` (the `$motion.<name>` dotted pattern). Resolution in the variables walk; renderer consumes the existing `shadows` path. Dark theme: a sparse `dark.elevation` override (the `dark.colors` pattern) so depth reads correctly on dark surfaces instead of inheriting light-tuned shadows. | A card with `shadow: "$elevation.raised"` renders layered soft shadows in light and a dark-appropriate treatment in dark; unresolved references degrade exactly like other unresolved `$refs`. |
| FR-A3 | **Personalities are curated, not computed** — each personality is a reviewed preset (the pattern-library philosophy: taste is hand-built, gates verify it). The table lives in source with a comment stating the intent of each choice; a dedicated test locks every personality's output against the evaluator and the cliché tells. | Adding a new personality is a table entry + passing the personality gate test. |
| FR-B1 | **Archetype raise: the shell** — the dashboard/app-shell structures gain grouped navigation with section labels, an active item treatment, badge counts, a bottom account row (avatar tile + name), and a topbar (search affordance + actions region). Density values come from tokens, not literals. | Stamped shell reads as a real product frame at both themes; pattern gate holds > 95; stress stays CLEAN. |
| FR-B2 | **Archetype raise: data display** — stat-card v2 (left-aligned eyebrow label, large tabular-nums value with display tracking, delta chip in AA status color, optional sparkline using the chart node); data-table v2 (avatar + text cell pattern, status dot + label cells, right-aligned numeric columns with tabular nums, pagination footer affordance); chart v2 (y-axis labels via the existing `yLabels`, gridline discipline, subtle area fill, legend chips). | Each stamped archetype passes gate + stress; the honest-content guard still holds (placeholders stay labeled). |
| FR-B3 | **Archetype raise: forms & settings** — settings v2 with grouped sections (header + description per group), a footer action bar (primary save + secondary cancel), and a danger-zone pattern; form-field structures get label + control + help/error slots wired for the usability checks. | The settings error-state story is coherent: the banner's "could not be saved" points at a visible save control. |
| FR-B4 | **State completeness for the new archetypes** — skeleton coverage extends to every data surface: a `skeleton-stat-card` stamp exists, and the coverage check warns when a loading variant leaves a data-bearing region un-skeletoned while sibling regions are skeletoned (the half-loading screen from the dogfood review). | The demo's loading variant with static stat cards next to a skeleton table produces a coverage warning naming the static region. |
| FR-C1 | **Usability category** — new evaluator category `usability` (weighted like other categories; genre-aware where noted): **hit-target size** (interactive control nodes below 24×24px effective box → error, the WCAG 2.5.8 floor; below 44px → info for touch-first genres), **label association** (a control node with no text label in its immediate row/group → warning), **vague action copy** (button-shaped nodes whose label is a bare "Click here" / "Learn more" / "Submit" → info), each with node ids and concrete suggestions. | Fixtures: an unlabeled toggle, a 20px checkbox, and a "Click here" button each produce exactly one finding; the raised archetypes produce zero. |
| FR-C2 | **Focus-visible rendering** — the renderer emits `:focus-visible` ring styles for control nodes (accent-derived, AA against the surface) in viewer/live HTML. Screenshots stay byte-deterministic (focus styles are CSS-only and nothing is focused in a static capture). | Tabbing through a rendered settings page in the viewer shows visible focus rings; screenshot bytes are unchanged from before the feature for the same canvas. |
| FR-D1 | **The wow-gate in the operating contract** — INSTRUCTIONS / GOTCHAS / WORKFLOW_CHEATSHEET teach the full loop: generate_design_system (personality) → stamp → adapt → evaluate → stress → states → *and when an API key is present, `canvas_evaluate` llm mode + `canvas_revise` as the standard final polish*. GUIDELINES gains a "Designing with character" section (what each personality means, where to spend the accent, elevation usage). `test-discoverability` pins the new tool, the personality names, `$elevation`, and the usability finding kinds. | An agent reading connect-time instructions knows personalities exist, what the final-polish step is, and when it applies. |
| FR-D2 | **Proof, not a staged demo** — the acceptance artifact is the same demo pipeline from the dogfood run (same seed, same screens, scripts unchanged except the one new generator call), re-rendered on this phase. Judged: all existing gates green, and with a key present the vision judge scores ≥ 4 on every rubric axis for every base screen. Those screenshots become the release hero images. | The before/after pair from the same seed is the release story; no hand-tuned one-off canvases. |

### Non-goals (explicit scope cuts)

- **No new rubric axes this phase.** The five fixed critique axes stay as they are — changing the rubric shape breaks the Phase 13 contract, and the specificity/variety/execution axes already reward distinctiveness. Revisit only if FR-D2's acceptance shows the rubric itself is the bottleneck.
- **No animation choreography.** Motion stays at the token level (durations/easings); orchestrated entrance sequences and scroll effects are a different product surface.
- **No multi-brand or brand-import theming.** One seed + one personality per scope; importing an existing brand's full identity is future work on top of the import pipeline.
- **No importer changes.** Unchanged from Phase 26's cut.
- **No usability auto-fix beyond the mechanical.** Hit-target and label findings name the fix; resizing layouts or inventing label copy automatically is judgment the agent owns.
- **No removal of the old archetypes' names.** Structures keep their ids; v2 replaces their contents in place. Consumers stamp the same names and get better output — the same contract as every scaffold fix shipped before.

---

## 2. CLARIFY  (forks — recommendations; ★ = needs user confirm)

- **C1 — One wrapper tool vs. a third generator.** *Recommend:* one new `generate_design_system` that *composes* the existing `generate_color_system` + `generate_scale` engines rather than duplicating them; the two existing tools stay for targeted use. One call is the story agents need; composition keeps one source of truth per engine.
- **C2 — Personality count.** *Recommend:* ship exactly four (`technical`, `editorial`, `soft`, `data-dense`). Four is enough to prove the axis matters and small enough to hand-curate honestly. More personalities are table entries later.
- **C3 — Font pairing source.** *Recommend:* a curated in-source table of pairings per personality (each: display family, body family, per-role weights/tracking), all resolvable from the existing font pipeline. No network dependency at spec time; the resolution/caching path already handles offline degradation.
- **C4 — Elevation token shape.** *Recommend:* `elevation: Record<name, ShadowSpec[]>` (the existing `shadows` array shape), referenced as `shadow: "$elevation.<name>"`, with `dark.elevation` as a sparse override. Reuses two proven patterns (`shadows` rendering, `$motion` dotted refs) and stays diffable on disk.
- **C5 — Usability severity stance.** ★ *Recommend:* the hit-target floor (24px) lands as **error** (it is a WCAG 2.2 AA success criterion, same standing as the contrast gate); label association as **warning**; vague copy as **info**. Alternative: everything advisory for one release to observe false-positive rates. The fixtures in FR-C1 are designed to keep the checks conservative either way.
- **C6 — Where density lives.** *Recommend:* density is expressed *through the existing token namespaces* (spacing values, typography sizes, radius) rather than a new `density` token type — the scaffolds read tokens as they already do. A separate density namespace would be a second way to say the same thing.
- **C7 — Sparkline in stat-card v2.** *Recommend:* include it, implemented with the existing chart node in a small footprint, but as an *optional* slot documented in the structure description — data-less stat cards must not fabricate a trend (honest-content rule).

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — design language generator (FR-A1..A3)**
- NEW `src/design-language.ts`: the personality table (fonts, tracking/leading rules, radius stance, density values, elevation scales light+dark, accent-discipline notes used by docs) + `generateDesignSystem(seed, personality, opts)` composing `generateColorSystem` (`src/color-system.ts`) and `generateTypeScale`/`generateSpaceScale` (`src/scales.ts`).
- `src/types.ts`: `DesignVariables.elevation` + `dark.elevation`.
- `src/variables.ts`: `$elevation.<name>` resolution in the resolve walk (mirror the `$motion` dotted lookup); dark merge follows the `dark.colors` path.
- `src/index.ts`: `generate_design_system` tool (single-scope write, inherited-token preservation, font warm-up via `warmFamilies` so faces render on first screenshot).
- Tests: `test-design-language.ts` — per-personality: full evaluator pass both themes, cliché-clean, fonts resolvable, elevation refs resolve, scope/inheritance contract.

**Slice B — archetype raise (FR-B1..B4)**
- `src/structures.ts`: shell v2, stat-card v2 (+ `skeleton-stat-card`), data-table v2, chart section v2, settings v2, form-field v2 — all reading tokens for density/radius/elevation.
- `src/evaluate.ts` (coverage): the un-skeletoned-data-region warning (FR-B4) beside the existing missing-state logic.
- `benchmark`/pattern check-in refresh; `test-patterns.ts` and `test-skeleton.ts` extended to the new archetypes; `test-structures.ts` counts (already count-independent after the pending fix) stay green.
- Surfaces (same PR): structure descriptions, README structures table, GUIDELINES pattern notes.

**Slice C — usability (FR-C1/C2)**
- `src/evaluate.ts`: `checkUsability` + category wiring into `CATEGORY_WEIGHTS`; control-node detection shared with the existing control rendering knowledge (toggle/checkbox/radio/select + button-shaped frames).
- `src/renderer.ts`: `:focus-visible` styles for control markup builders (accent-derived ring, AA-checked against surface at build time); no effect on static capture.
- Tests: `test-usability.ts` fixtures per finding kind + the archetypes-produce-zero assertion; screenshot byte-determinism assertion for FR-C2.

**Slice D — operating contract + proof (FR-D1/D2)**
- `src/index.ts`: INSTRUCTIONS / GOTCHAS / WORKFLOW_CHEATSHEET updates; `canvas_evaluate`/`canvas_revise` docstrings gain the final-polish framing.
- `docs/GUIDELINES.md`: "Designing with character" section.
- `test-discoverability.ts`: pin `generate_design_system`, personality names, `$elevation`, usability finding kinds.
- The demo pipeline re-run (scripts live outside the repo; the resulting screenshots land as release assets) + docs screenshot refresh.

Slice order: A → B → C → D. B consumes A's tokens; C's zero-findings assertion runs against B's archetypes; D documents the whole.

---

## 4. TASKS

| # | Slice | Task | Test |
|---|-------|------|------|
| 1 | A | Personality table + `generateDesignSystem` composition | test-design-language |
| 2 | A | Elevation tokens end to end (types → resolve → render → dark) | test-design-language |
| 3 | A | `generate_design_system` tool + surfaces | test-discoverability |
| 4 | B | Shell v2 + stat-card v2 + skeleton-stat-card | test-patterns, test-skeleton |
| 5 | B | Data-table v2 + chart v2 + settings v2 + form-field v2 | test-patterns |
| 6 | B | Un-skeletoned-region coverage warning | test-coverage |
| 7 | C | `checkUsability` (hit target, label association, vague copy) | test-usability |
| 8 | C | Focus-visible control rendering, deterministic screenshots | test-usability |
| 9 | D | Operating-contract surfaces + GUIDELINES section | test-discoverability |
| 10 | D | Demo re-run, before/after assets, docs screenshots | manual + judge ≥ 4 when key present |

---

## 5. ANALYZE  (risks & checks)

- **Curation is the product risk.** The personalities and archetypes are hand-built taste; a weak table ships weak defaults at scale. Mitigation: every personality × archetype combination runs the full gate suite in CI (the personality gate test), and FR-D2's before/after demo is the human check before release.
- **Elevation plumbing touches the resolve walk.** The `$motion` dotted-lookup precedent keeps it contained, but dark-theme shadow merging is new surface — the dual-theme test must cover a canvas whose only dark override is elevation.
- **Archetype churn vs. existing consumers.** Contents change under stable names; anyone who stamped v1 keeps their canvas (stamps are copies, not references) — only *new* stamps change. Stated in release notes.
- **Usability false positives.** Hit-target math must use the *effective* box (padding included, like the layout engine sees it), not the icon glyph; label association must accept label-above and label-beside forms. The fixtures encode both directions; if C5's error stance proves noisy in dogfood, the severity is one line to soften.
- **Focus rings vs. byte-determinism.** CSS-only additions keep static captures identical, but the assertion in test-usability makes it a contract, not an assumption.
- **Scope honesty.** This phase deliberately does not touch the rubric, animation, or brand import (non-goals) — if the FR-D2 proof still under-whelms with all four slices landed, the next conversation is about *those*, with evidence.

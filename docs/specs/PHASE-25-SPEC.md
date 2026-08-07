# Phase 25 — Craft Depth: Type & Color (v1.12)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-08-07.
> Source: the design-quality cluster (2026-08-07 brainstorm + research) — points 3, 4, 7, 8, 9, 10, 11. Packaging decided 2026-08-07: this phase covers typographic + chromatic depth; Phase 26 ("Beyond one canvas") takes grid authoring, the project roll-up, and flow critique.

---

## 1. SPECIFY

### Problem

framesmith's token system *stores* what agents hand it, but the hardest craft decisions — a harmonious type scale, a perceptually even palette, a dark theme that isn't a hue-inverted accident — are exactly where hand-picked values betray an amateur eye. Five concrete gaps:

1. **The typography token system lies.** A `$heading` reference resolves `.fontSize` ONLY — `fontWeight`/`fontFamily`/`lineHeight` on the token are silently ignored (`lookupToken` at variables.ts:99, substitution at :175). A documented sharp edge since Phase 15; it should just work.
2. **Number columns wobble.** Proportional figures misalign vertically in tables and chart axes — the single most visible amateur tell on data screens, fixed by one CSS property (`font-variant-numeric: tabular-nums`) that nothing sets today.
3. **Scales are hand-picked, not generated.** Modular type scales (a ratio, applied) and paired space scales are the mathematically boring part of craft — the part a tool should produce. Same for color: the state of the art (Ramps Studio, Radix custom palettes) takes ONE brand color and derives perceptual OKLCH ramps, a matched neutral, and status colors; framesmith agents eyeball hex values instead.
4. **Dark mode doesn't exist.** A themed canvas is one theme. Real design systems are dual: author once, render both, verify contrast in BOTH — where WCAG 2 ratios are known to mislead on dark backgrounds (APCA models it better but remains non-normative — advisory only).
5. **Literal values detach from the system.** A node styled `#F8FAFC` when `$surface` IS `#F8FAFC` is drift-in-waiting; the Figma linter ecosystem treats this as the core lint and framesmith doesn't check it. Motion has no token category at all (`transition`/`animation` values are ad-hoc per node).

The through-line: **raise the floor of what an agent produces by making the derivable parts derived, and the checkable parts checked.**

### Goals

- **Typography tokens resolve completely** — the documented quirk dies; declaring a type system means the system actually applies.
- **Numerics and measure are craft defaults**: tabular numerals where numbers stack; line-length flagged when prose runs wide; display sizes get tracking guidance.
- **Scales are one call**: a ratio → a full fluid-capable type + space token set; a seed color → a full dual-theme semantic color system with perceptual ramps.
- **Dark mode is first-class**: one canvas, two themes, contrast verified in both (WCAG 2.2 gate + APCA advisory).
- **Detachment is caught**: literals that equal a token flag with a mechanical `$ref` autofix; motion becomes a token category.

### User stories

- **US1** — As the authoring agent, I set `fontSize: "$heading"` and get the token's size, weight, family, and line-height — not just the size — with any explicit node prop still winning.
- **US2** — As a dashboard author, my table columns and chart tick labels render with tabular numerals by default; the evaluator tells me if a numeric column would wobble.
- **US3** — As the authoring agent, `generate_scale({ ratio: "major-third", baseSize: 16 })` writes a named type + space token set (optionally fluid `clamp()` forms), and my design references `$text-lg` instead of a hand-picked 19.
- **US4** — As the authoring agent, `generate_color_system({ seed: "#0E7490" })` gives me primary ramps 50–900, a matched neutral, status colors at consistent lightness, and semantic tokens mapped for BOTH light and dark — my palette floor is now "perceptually even" instead of "whatever I typed".
- **US5** — As the authoring agent, `screenshot({ theme: "dark" })` renders the same canvas in the dark mapping, and `canvas_evaluate` reports contrast for both themes in one pass (APCA Lc as info alongside the WCAG gate).
- **US6** — As the authoring agent, a node carrying a literal that equals an existing token gets flagged with a one-op autofix to the `$ref`, and my transitions reference `$motion.fast` instead of scattering `150ms ease` strings.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **Full typography-token resolution** — a `$token` reference on `fontSize` applies the token's `fontSize` AND its `fontWeight` / `fontFamily` / `lineHeight` / (new) `letterSpacing` where the NODE doesn't set them explicitly; explicit node props always win. The typography token type gains `letterSpacing?`. Kills the sharp-edges quirk (GUIDELINES + [[feedback_typography_token_quirk]] memory both retire). | A node with `fontSize: "$heading"` and no other type props renders the token's full spec; a node overriding `fontWeight` keeps its override; the benchmark re-baselines cleanly. |
| FR-A2 | **Tabular numerals** — new text prop `tabularNums?: boolean` → `font-variant-numeric: tabular-nums`. Defaults ON for chart tick/axis labels and the `data-table` / `skeleton-table` scaffold cells; the typography check flags a detected table column whose cells are data-like text without it (info, autofixable). | A money column renders aligned; the evaluator's fix op writes `tabularNums: true` on the offenders. |
| FR-A3 | **Measure check** — typography category flags body-size prose (< 18px, > 120 chars content) whose rendered line length exceeds ~75ch. Fast mode estimates (width ÷ fontSize×0.5); detailed mode uses real rects. Warning at > 90ch, info at 76–90ch. Suggestion: `maxWidth` cap. | A full-width article paragraph flags; the same text in a 600px column doesn't. |
| FR-A4 | **Tracking-by-size nudge** — display text (≥ 28px) with default/positive letterSpacing gets an info suggestion for negative tracking (banded: −0.5px at 28–40, −1px above), autofixable. Token-declared letterSpacing (FR-A1) counts as intentional and is never flagged. | The 48px hero headline gets the nudge with a ready op; a token-typed headline doesn't. |
| FR-B1 | **`generate_scale` tool** — `{ ratio: name\|number, baseSize?, steps?, fluid?, scope }` writes typography size tokens (`text-xs`…`text-3xl` naming) and PAIRED space tokens on the chosen layer (workspace/project/canvas) via the existing variables machinery. Named ratios: minor-second 1.125, major-second 1.2, minor-third 1.25, major-third 1.333, perfect-fourth 1.5, golden 1.618. `fluid: { minViewport, maxViewport }` emits `clamp()` strings (Utopia pattern); static numbers otherwise. | One call yields a coherent scale the agent references as `$text-*` / spacing tokens; fluid mode renders correctly at both viewport extremes. |
| FR-B2 | **Renderer accepts string font sizes** — `fontSize` accepts a string (`clamp(...)`, `1.25rem`) pass-through wherever a number works today (renderer, evaluator tolerates: scale checks treat clamp tokens as pinned). | A fluid token renders; the type-scale check doesn't false-flag clamp values. |
| FR-C1 | **OKLCH color engine** (pure, `src/color-system.ts`, zero deps) — sRGB↔OKLCH conversions + `generateRamp(seed)` → 50–900 with perceptually even lightness steps and controlled chroma; `matchedNeutral(seed)` → a neutral ramp with a whisper of the seed's hue; `statusColors(seed)` → success/warning/danger at the seed's lightness/chroma band. | Ramp lightness deltas are monotonic and even (±2 L*); status colors pass the same-lightness assertion; conversions round-trip within 1/255 per channel. |
| FR-C2 | **`generate_color_system` tool** — `{ seed, scope, dark? (default true) }` writes ramp tokens (`primary-50`…`primary-900`, `neutral-*`, `success/warning/danger`) plus SEMANTIC tokens (`bg-primary`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `border`, `accent`) mapped for light, and a dark mapping per FR-D1 (Radix pattern: dark ≈ reversed ramp steps, not inverted hex). Reports the mapping table so the agent sees what was decided. | One seed produces a system where every semantic pair passes WCAG AA in BOTH themes out of the box (asserted in tests). |
| FR-D1 | **Dual-theme tokens** — `DesignVariables` gains `dark?: { colors: Record<string, string> }`: a sparse override layer by token NAME (anything not overridden inherits the light value). Resolution: `resolveVariables(root, tokens, { theme })` merges dark over colors when theme = dark. Stored at any layer (workspace/project/canvas) like everything else; on-disk JSON stays flat and diffable. | A canvas with a dark layer renders both themes from one tree; un-themed canvases behave exactly as today (no migration). |
| FR-D2 | **Theme-aware rendering + evaluation** — `screenshot` / `screenshot_responsive` / `export` gain `theme?: 'light' \| 'dark'`; `canvas_evaluate`'s color category, when a dark layer exists, checks contrast in BOTH themes (issues tagged `theme: 'dark'` where applicable) and adds **APCA Lc as info-severity alongside** the WCAG 2.2 gate (APCA is a candidate method, not a standard — it never blocks). Viewer detail page gets a light/dark toggle when a dark layer exists. | A dark-illegible pair that passes in light mode is caught; APCA rows appear as info; canvases without a dark layer see zero change. |
| FR-E1 | **Token-detachment lint** — consistency category: a node styling prop (fill/stroke/color) holding a LITERAL that exactly equals a merged color token's value flags (info) with a mechanical autofix to the `$ref`; same for cornerRadius vs radius tokens. Text colors, one finding per node. | `fill: "#F8FAFC"` where `$surface` = `#F8FAFC` yields the fix op `U(id, { fill: "$surface" })`; canvas_autofix apply: true writes it. |
| FR-E2 | **Motion tokens** — `DesignVariables` gains `motion?: Record<string, { duration: number; easing: string }>`; `transition`/`animation` props accept `$motion.name` refs (resolved in variables.ts like other categories); a consistency nudge (info) flags ≥3 distinct ad-hoc durations/easings on one canvas when no motion tokens are declared. | `transition: "$motion.fast"` renders the token's duration+easing; the mixed-easings canvas gets one info nudge. |

### Non-goals (explicit scope cuts)

- **No theme editor UI** — the viewer gets a render toggle, not token-editing controls.
- **No APCA gating** — WCAG 3 is a Working Draft and APCA sits outside its normative text; Lc numbers are info-severity until the standard lands. Never block on a non-standard.
- **No W3C DTCG token import/export** — the format is worth watching; adopting it is its own phase when demand appears.
- **No automatic re-theming of existing canvases** — `generate_color_system` writes tokens; re-pointing existing literal styles at them is the agent's judgment (the FR-E1 lint helps exactly here).
- **No font pairing recommendations** — taste-adjacent and dataset-hungry; the guidelines keep teaching it as prose.
- **No RTL / writing-mode work** — separate concern, separate phase if ever.

---

## 2. CLARIFY  (forks — recommendations; ★ = user-confirmed)

- **C1 — Packaging.** ★ **Decided 2026-08-07: two phases** — this one (type + color depth), then Phase 26 (grid, project roll-up, flow critique). À la carte and one-mega-phase rejected.
- **C2 — Dark-theme storage model.** *Recommend:* a sparse `dark.colors` override layer keyed by token NAME (FR-D1) — one source of truth per token, dark inherits everything not overridden, diffs stay readable, and the resolution change is one merge. Alternatives: parallel full theme objects (duplicates every token, drifts), per-node dark overrides (explodes the tree, defeats tokens).
- **C3 — Where tabular-nums defaults on.** *Recommend:* chart tick labels + table scaffolds by default, plus the evaluator nudge for hand-built numeric columns — NOT a global text default (proportional figures are correct for prose; the default should follow context, and detection already exists via the drift inventory).
- **C4 — OKLCH implementation.** *Recommend:* hand-rolled conversions in `src/color-system.ts` (≈80 lines of well-known math, zero new deps — the repo has stayed dependency-light through 24 phases; `culori` would be the first color dep for math we can write and test directly). Regeneration-style test like tailwind-palette's Chrome readback validates against browser `oklch()` parsing.
- **C5 — Scale token naming.** *Recommend:* t-shirt names (`text-xs`…`text-3xl`, `space-2xs`…`space-3xl` pairs) — the vocabulary agents already speak from Tailwind; numeric step names (`text-1`…) are the alternative but read as arbitrary.
- **C6 — Fluid scales v1.** *Recommend:* `fluid` as an OPT-IN flag on `generate_scale` emitting `clamp()` strings (needs FR-B2), static numbers as default — static is what the evaluator's scale checks understand deeply today; fluid is additive.
- **C7 — APCA placement.** *Recommend:* inside the existing color category as extra info-severity issues (`apca: Lc value` in the message), not a new category — it's the same check's second opinion, and category count just stabilized at 7.
- **C8 — Detachment lint scope.** *Recommend:* exact value equality only (colors normalized to lowercase hex; radius numbers) — nearest-match suggestions already exist at import (`snapToTokens`); at evaluate time anything fuzzy would guess, and framesmith never guesses.

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — typography correctness + numerics (FR-A1..A4)**
- `src/types.ts`: typography token gains `letterSpacing?: number`; text node gains `tabularNums?: boolean`.
- `src/variables.ts`: the typography substitution (`lookupToken` :99, cat === 'typography' branch :175) applies the FULL token spec to the node (explicit props win) — the core quirk fix.
- `src/renderer.ts`: `tabularNums` → `font-variant-numeric: tabular-nums`; chart tick/axis label builders set it by default.
- `src/structures.ts`: `data-table` / `skeleton-table` cells carry it.
- `src/evaluate.ts` typography check: measure estimate (fast) + rect-based (detailed); tracking nudge; numeric-column nudge (drift-inventory tables).
- Retire the sharp-edges quirk bullet (GUIDELINES) + the memory note.
- Tests: `test-typography-depth.ts`; benchmark re-baseline expected (FR-A1 changes rendered output where tokens declared weight/family).

**Slice B — scale generation (FR-B1/B2)**
- NEW `src/scales.ts` (pure): ratio table, `generateTypeScale` / `generateSpacePairs`, fluid `clamp()` math (Utopia formulas).
- `src/index.ts`: `generate_scale` tool writing through `set_variables`-equivalent paths per scope.
- `src/renderer.ts` + `src/evaluate.ts`: string `fontSize` pass-through; clamp values treated as pinned in scale checks.
- Tests: `test-scales.ts` (pure math + token writes) + a render check at two viewports.

**Slice C — the color engine (FR-C1/C2)**
- NEW `src/color-system.ts` (pure, zero deps): sRGB↔linear↔OKLab↔OKLCH; `generateRamp`, `matchedNeutral`, `statusColors`, `semanticMapping(light/dark)`.
- `src/index.ts`: `generate_color_system` tool; result reports the full mapping + contrast table.
- Tests: `test-color-system.ts` (round-trips, monotonic ramps, AA assertions both themes) + a Chrome readback validation script mirroring `scripts/generate-tailwind-palette.ts`.
- Order note: C before D so the generator can emit the dark layer the moment FR-D1 lands (C writes light-only if it ships first; the dark write is one function call added in D).

**Slice D — dual theme + APCA (FR-D1/D2)**
- `src/types.ts`: `DesignVariables.dark?`; `src/variables.ts`: theme-aware merge in `resolveVariables` (+ `getCanvasTokens` passthrough).
- `src/index.ts`: `theme` param on screenshot/screenshot_responsive/export; evaluate color category dual-run when a dark layer exists (issues tagged); APCA Lc implementation (pure, in evaluate.ts or color-system.ts) as info.
- `src/viewer.ts`: light/dark toggle on the detail page when a dark layer exists (renders `/html?theme=dark`).
- Tests: `test-dual-theme.ts` (resolution, both-mode contrast catches, no-dark-layer no-change) + APCA value fixtures.
- `evalCacheKey` gains the dark layer (it already hashes tokens via `getCanvasTokens` — verify the dark layer flows through, else add).

**Slice E — detachment lint + motion tokens (FR-E1/E2)**
- `src/evaluate.ts` consistency category: literal-equals-token check (colors lowercased, radius numbers) with autofix ops; ad-hoc-motion nudge.
- `src/types.ts` + `src/variables.ts` + `src/renderer.ts`: `motion` token category + `$motion.name` resolution on transition/animation.
- Tests: `test-token-lint.ts`, `test-motion-tokens.ts`.

**Slice F — surfaces + guards (rides ON each slice per the same-PR rule; this slice is the workflow prose + pins)**
- INSTRUCTIONS/GOTCHAS/WORKFLOW_CHEATSHEET: "derive, don't hand-pick" — scales and color systems come from the generators; dark is a first-class render target.
- GUIDELINES: "Deriving the system" section (generators, dual theme, APCA stance); retire the typography-quirk sharp edge (slice A).
- `test-discoverability.ts` section 10: ratio names, ramp/semantic token names emitted by the generators, `theme` param, `$motion` — pinned to the three surfaces.
- docs-steward per slice PR; screenshot refresh rides the next release (standing flag).

**Order:** A → B → C → D → E → F. A is dependency-free and retires a long-standing bug first; B/C are pure engines; D builds on C's output shape; E is small and independent but shares evaluate plumbing; F closes.

---

## 4. TASKS

- [ ] **T1 (A)** Full typography-token resolution + `letterSpacing` + quirk retirement + `test-typography-depth.ts` (+ benchmark re-baseline)
- [ ] **T2 (A)** `tabularNums` + chart/scaffold defaults + measure + tracking + numeric-column checks
- [ ] **T3 (B)** `src/scales.ts` + `generate_scale` + string fontSize pass-through + `test-scales.ts`
- [ ] **T4 (C)** `src/color-system.ts` engine + `generate_color_system` + Chrome readback validation + `test-color-system.ts`
- [ ] **T5 (D)** `dark` token layer + theme-aware render/evaluate/viewer + APCA info + `test-dual-theme.ts`
- [ ] **T6 (E)** token-detachment lint + motion token category + tests
- [ ] **T7 (F)** workflow surfaces + GUIDELINES section + discoverability pins + steward pass

---

## 5. ANALYZE  (risks & checks)

- **FR-A1 is a behavior change, not just a fix.** Canvases that reference typography tokens carrying `fontWeight`/`fontFamily` will render differently (correctly, but differently) — the benchmark and pattern gate must re-baseline in the same PR, and the release notes must call it out. Explicit-props-win keeps the blast radius to exactly the cases that were silently broken.
- **Color math correctness.** Hand-rolled OKLCH must be validated against a browser's own parsing (the tailwind-palette Chrome-readback pattern exists for exactly this). Gamut clipping at high chroma needs explicit handling (clip toward lower chroma, never hue-shift).
- **Dark theme leak into determinism.** Theme must be a pure render/evaluate parameter — never canvas state — or `versionHash` and the drift/stress baselines fork. The hash already covers `variables` (the dark layer is design content and SHOULD move it); `evalCacheKey` must include it too.
- **Generator output vs existing design systems.** `generate_color_system` on a canvas that inherits workspace tokens must respect the same `preservedFromDesignSystem` contract `apply_preset` honors — never silently clobber an inherited system.
- **Lint noise.** The detachment lint fires only on EXACT equality — but a generated 50–900 ramp makes exact collisions more likely (that's the point). Cap per-canvas findings (20, the house style) and keep it info-severity: it's hygiene, not a gate.
- **Scope discipline.** The pull here is toward a theming product (theme editor, token studio). The non-goals hold: generators + a render toggle + checks. Phase 26 is already scoped for what comes after.

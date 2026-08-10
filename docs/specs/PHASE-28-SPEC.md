# Phase 28 — Dataviz Vocabulary (v1.15)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-08-10.
> Source: the reference-caliber attempt (2026-08-10). Asked how framesmith reaches the level of a top-tier field-operations dashboard, we rebuilt one with today's toolkit before speccing anything. The attempt reached score 94 and visual parity with the reference — but only through **eight hand-carried workarounds**, each recorded live. This spec is that evidence, turned into requirements. The attempt scripts are the regression fixture: the acceptance for the whole phase is re-running the attempt with zero workarounds.

---

## 1. SPECIFY

### Problem

The Phase 27 machinery holds for product shells, forms, and content pages. The reference attempt showed exactly where it stops: **data visualization**. Two failure classes, confirmed by evidence rather than prediction:

1. **The toolkit can't say it.** No donut/radial chart (we faked one with a conic-gradient circle — it renders, but it's not data-bound). No per-bar emphasis or in-chart gradients (we hand-built a 15-bar chart from 34 frames, with its own axis labels and tooltip). No sparkline (7 hand-placed 4px bars per KPI card). No categorical series palette (5 hand-picked hues). No tint layer (6 hand-derived background+ink pairs for chips, tiles, pills, and avatars — with **no dark-theme story at all**; the attempt only works in light mode). No scaffolds for the micro-patterns every dashboard repeats: segmented control, breadcrumb, status chip, pill badge, initials avatar.
2. **The evaluator punishes it.** The cliché tells were written against marketing-page slop and misfire on legitimate dashboard vocabulary, each observed live: the accent-hue tell flagged a categorical violet (we dodged to pink); the gradient-overuse tell counted 15 chart bars as decorative gradients; the fake-chrome tell read a sparkline's rounded bars as traffic-light dots; the eyebrow census counted uppercase KPI labels as template rhythm; and `detectTable` matched the topbar + greeting as a 2×2 "table", consuming the subtree so the *real* table went undetected (we dodged with an invisible spacer node).

The phase's claim: an agent asked for a reference-caliber dashboard should reach it with the toolkit's own vocabulary — no hue-dodging, no spacer hacks, no 34-frame hand-built charts — and the evaluator should recognize dashboard language instead of fighting it.

### Goals

- **A generated color range**: categorical series tokens and a tint layer, from the same seed, AA-managed, dark-aware — the two color families every data screen needs beyond accent + status.
- **Dataviz primitives**: donut kind, bar emphasis, in-chart gradient fills, and a sparkline — data-bound, rendered by the chart machinery, not hand-assembled from frames.
- **An evaluator that knows dashboards**: the five confirmed misfires fixed at the detector level, with the token-ref precedent doing the heavy lifting.
- **The micro-pattern scaffolds** dashboards repeat, plus a KPI-card raise that consumes the new tokens.
- **Proof by re-run**: the attempt rebuilt on the new vocabulary, reaching ≥ 95 with zero workarounds.

### User stories

- **US1** — As the authoring agent, `generate_design_system` (unchanged call) now also gives me `$chart-1`…`$chart-6` and `$accent-tint` / `$success-tint` / `$warning-tint` / `$danger-tint` / `$neutral-tint` — and referencing them never trips a cliché tell, in either theme.
- **US2** — As the authoring agent, a coverage donut is `{ type: "chart", kind: "donut", segments: [{ value: 385, color: "$chart-1", label: "North" }, …] }` with a center value slot — one node, not a conic hack plus an overlay.
- **US3** — As the authoring agent, `highlight: [11]` on a bar series renders the selected bar solid while the rest stay muted, and `{ kind: "sparkline", data: […] }` gives me the KPI-card mini-trend in one node.
- **US4** — As the authoring agent, I stamp `kpi-card`, `status-chip`, `segmented-control`, `breadcrumb`, and `initials-avatar` instead of hand-building them, and the stamped KPI card already carries the tinted icon tile, the pill badge, and the sparkline slot.
- **US5** — As the reviewing human, the reference attempt re-run on this phase scores ≥ 95 with no dodges in the script — the diff between the two attempt scripts IS the phase's changelog.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **Categorical palette** — `generate_design_system` (and `generate_color_system`) emit `chart-1`…`chart-6`: the seed hue first, then hue-rotated steps ≥ 30° apart with matched lightness/chroma bands, each ≥ 3:1 against both `bg-surface` values (the non-text graphical-object contrast floor, WCAG 1.4.11), with `dark.colors` counterparts re-lit for dark surfaces. | Six visually distinct series colors from one seed; every one clears 3:1 on its theme's surface; the attempt's hand-picked `CAT` array deletes. |
| FR-A2 | **Tint layer** — the same calls emit `accent-tint`, `success-tint`, `warning-tint`, `danger-tint`, `neutral-tint`: low-chroma, high-lightness surfaces of each hue whose PAIRED INK is the existing text-tuned color (`accent`, `success`, …), AA-checked as a pair; `dark.colors` carries dark tints (low-lightness) re-paired the same way. | A status chip is `fill: "$success-tint", color: "$success"` and passes contrast in both themes; the attempt's hand-derived `TINT` table deletes. |
| FR-B1 | **Donut kind** — `kind: "donut"` on the chart node: `segments: [{ value, color, label? }]` (colors take `$refs`), `innerRatio` (default ~0.72), optional `centerValue` / `centerLabel` text slots rendered in the hole. Rendered as SVG arcs by the existing chart machinery; legend stays the agent's composition (frames), since legend layout is design, not charting. | The attempt's conic-gradient hack + overlay deletes; segments are data-bound; `$chart-*` refs resolve. |
| FR-B2 | **Bar emphasis + in-chart gradients** — bar series gain `highlight?: number[]` (highlighted bars render the series color solid; the rest render muted at a fixed alpha) and `barGradient?: boolean` (vertical fade rendered inside the SVG). In-SVG fills are invisible to the gradient-overuse tell by construction (the tell counts node `gradient` props, not chart internals). | One chart node replaces the attempt's 34-frame hand-built plot; the tooltip stays an agent-composed floating frame (by design — it's annotation, not charting). |
| FR-B3 | **Sparkline** — `kind: "sparkline"` on the chart node: single series, no axes/gridlines/labels, tight default size, optional `highlight` of the last point, bar or line form (`sparkKind: "bar" \| "line"`, default bar). | A KPI card's mini-trend is one node; the attempt's 7 hand-placed bars per card delete. |
| FR-C1 | **Tells learn the token-ref exemption for dataviz** — the accent-hue tell skips values referenced through `$chart-*` or `$*-tint` tokens (the existing raw-vs-resolved machinery); the gradient-overuse tell already never sees in-SVG fills (FR-B2) and additionally exempts `$`-token-referenced gradients. | The attempt's violet-to-pink dodge reverts: `$chart-2` may be violet and no tell fires; a literal violet accent still flags. |
| FR-C2 | **Fake-chrome tell learns aspect ratio** — the small-circles census only counts shapes that are actually round: ellipses, or frames whose corner radius ≥ half their size AND whose aspect ratio is within ~1.5:1. Tall thin rounded bars stop matching. | The attempt's sparkline-radius dodge reverts; three real traffic-light dots still flag. |
| FR-C3 | **Eyebrow census learns the stat signature** — an uppercase/tracked label is NOT an eyebrow when it sits inside a card whose immediate content includes a large (≥ 20px) tabular-nums value — the KPI-card label signature, detected structurally (no genre dependency). Marketing-page eyebrows above headings keep counting. | The attempt's sentence-case dodge reverts; the existing eyebrow fixtures stay green. |
| FR-C4 | **`detectTable` requires three rows** — unnamed candidates need ≥ 3 matching rows (two stacked two-child rows — a topbar over a greeting — is a layout, not a table); import-named `Table` keeps the trusted loose shape. | The attempt's invisible-spacer dodge reverts; the real activity table is detected and its headers excluded from the eyebrow census; existing drift/coverage fixtures stay green. |
| FR-D1 | **Micro-pattern scaffolds** — new component structures: `kpi-card` (tinted icon tile + sentence-case label + big tabular value with inline context + sparkline slot + tinted pill badge — consumes `$*-tint` and `kind: "sparkline"`), `status-chip`, `segmented-control`, `breadcrumb`, `initials-avatar`. Each passes the pattern gate, stress, and usability checks; each documented in the same PR. | The attempt's hand-built versions delete; `dashboard`'s stat cards upgrade to the `kpi-card` anatomy. |
| FR-D2 | **Proof by re-run** — the attempt script rewritten on the new vocabulary (new tokens, chart kinds, scaffolds; all dodges removed), evaluated ≥ 95 with designed states, screenshotted light AND dark (the tint layer's dark story makes dark possible for the first time). | Before/after scripts diffable; the dark render exists; score ≥ 95 with zero blocking. |

### Non-goals (explicit scope cuts)

- **No tooltip/legend primitives.** Both are agent-composed frames in the attempt and read well; they are design decisions (placement, density), not chart machinery. Revisit only if the re-run proves them painful.
- **No hatched/patterned chart fills.** The reference uses a hatch for projected bars; SVG pattern defs are real surface area for one decoration. The muted-vs-solid emphasis covers the communication need.
- **No interactive chart behavior.** Hover states, real tooltips-on-hover, and animation stay out — canvases are design artifacts; the viewer is not a BI tool.
- **No radar/scatter/heatmap kinds.** No evidence yet; the attempt needed exactly donut + bar emphasis + sparkline.
- **No auto-generated legends.** The donut renders the ring and center; the legend rows stay composition.

---

## 2. CLARIFY  (forks — recommendations)

- **C1 — Categorical palette derivation.** *Recommend:* hue rotation from the seed with fixed perceptual guardrails (OKLCH lightness band ~0.55–0.65, chroma band matched to the seed's, ≥ 30° hue separation, skip the 230–290° purple band only when the seed itself is not purple — otherwise the palette would dodge its own brand). Deterministic, no personality dependency (a series palette must stay stable across personalities).
- **C2 — Sparkline as chart kind vs new node type.** *Recommend:* chart kind — it reuses geometry, series parsing, and `$ref` resolution for free; a new node type would duplicate all three for a smaller feature.
- **C3 — Donut center slots vs children overlay.** *Recommend:* `centerValue`/`centerLabel` props rendered by the chart (typed, theme-aware, tabular-nums by default) — an overlay frame would need absolute positioning gymnastics in every use.
- **C4 — Eyebrow fix: structural signature vs genre relaxation.** *Recommend:* structural (FR-C3) — it works on any screen without requiring the genre stamp, and it is precise about WHY the label is legitimate (it labels a number, not a heading). Genre relaxation stays available as a fallback if the signature proves too narrow in the re-run.
- **C5 — Tint naming.** *Recommend:* `-tint` suffix on the existing semantic names (`success-tint`), not a new namespace — tints are colors, they layer/override/dark-merge like colors, and the pairing rule ("tint surface + base ink") is teachable in one sentence.

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — the color range (FR-A1, FR-A2)**
- `src/color-system.ts`: `categoricalPalette(seed)` (OKLCH hue walk + 3:1 floor vs both surfaces) and `tintLayer(...)` (light tints ~L0.93/low-C paired with existing inks; dark tints ~L0.28 re-paired); both wired into `generateColorSystem`'s return + `dark`.
- `src/design-language.ts`: passes them through (no personality coupling).
- Tests: `test-color-system.ts` — distinctness (pairwise ΔH), 3:1 floors both themes, tint/ink AA pairs both themes, purple-band skip + purple-seed exception.

**Slice B — dataviz primitives (FR-B1..B3)**
- `src/renderer.ts` chart block (`chartGeometry` + the SVG builder around renderer.ts:212–330): donut arc path builder + center text; bar `highlight`/`barGradient` (SVG `<defs>` linearGradient per series); `sparkline` kind (axis-free tight geometry). `src/types.ts`: `segments`, `innerRatio`, `centerValue`, `centerLabel`, `highlight`, `barGradient`, `sparkKind`.
- `src/variables.ts`: `$ref` resolution for `segments[].color` (the chart-series stroke precedent at variables.ts:55).
- Tests: `test-charts.ts` (new) — pure SVG-string assertions per kind + `$ref` resolution; Chrome render smoke in the proof.

**Slice C — evaluator vocabulary (FR-C1..C4)**
- `src/evaluate.ts`: accent-hue tell — raw-ref check against `$chart-*` / `$*-tint` (rawById precedent); gradient tell — token-ref exemption; fake-chrome — aspect-ratio + radius guard; eyebrow census — stat-signature exemption (walk: label's ancestor card contains ≥ 20px tabular text).
- `src/drift.ts`: `detectTable` minimum three rows (unnamed).
- Tests: `test-cliche.ts` + `test-drift.ts` extensions — each misfire fixture (from the attempt) now clean, each original violation fixture still firing.

**Slice D — scaffolds + proof (FR-D1, FR-D2)**
- `src/structures.ts`: the five component scaffolds; `stat()` → `kpi-card` anatomy in `dashboard`.
- The attempt re-run: `build.mts` rewritten (workarounds deleted), light + dark shots, ≥ 95.
- Surfaces same-PR throughout: docstrings, README, GUIDELINES ("Designing with character" gains the chip/tint pairing rule + chart vocabulary), `test-discoverability` pins (`$chart-`, `-tint`, `donut`, `sparkline`, new scaffold names).

Slice order: A → B → C → D (B consumes A's tokens; C's exemptions name A's tokens; D consumes everything).

---

## 4. TASKS

| # | Slice | Task | Test |
|---|-------|------|------|
| 1 | A | `categoricalPalette` + `tintLayer` + generator wiring | test-color-system |
| 2 | B | Donut kind (arcs + center slots) + segment `$refs` | test-charts |
| 3 | B | Bar `highlight` / `barGradient` + sparkline kind | test-charts |
| 4 | C | Accent-hue + gradient token-ref exemptions | test-cliche |
| 5 | C | Fake-chrome aspect guard + eyebrow stat signature | test-cliche |
| 6 | C | `detectTable` three-row minimum | test-drift, test-coverage |
| 7 | D | Five micro-pattern scaffolds + `kpi-card` in dashboard | test-patterns, test-usability |
| 8 | D | Attempt re-run, zero dodges, light + dark, ≥ 95 | manual + scripts diff |

---

## 5. ANALYZE  (risks & checks)

- **Categorical distinctness vs the 3:1 floor is a real constraint system** — six hues, two themes, one seed. If a seed corners the solver (a near-neutral seed), degrade deliberately: fewer guaranteed-distinct steps reported in the tool result rather than silently similar colors (the no-silent-caps house rule).
- **Tell exemptions must not open the door they were built to close.** Every exemption in slice C is keyed to either a token ref (agent opted into the design system) or a structural signature (the shape genuinely isn't the cliché) — never to a blanket genre. Each PR carries the negative fixture proving the original slop still flags.
- **`detectTable`'s three-row minimum touches coverage, drift, stress, and the eyebrow exclusion.** The blast radius is exactly why it ships in its own task with both fixture directions; two-row REAL tables (rare: header + one row) lose detection — accepted, and recorded in the drift docs as the trade.
- **Chart-node surface growth.** Donut + sparkline + emphasis stay inside the existing chart node and SVG builder; if the builder's complexity spikes, split a `src/charts.ts` (pure geometry) out of renderer.ts rather than growing the block — flagged as an implementation option, not a requirement.
- **The proof is the regression.** The attempt scripts live outside the repo, but the re-run's score, theme pair, and zero-dodge diff are quoted in the slice-D PR; if any workaround survives, the phase isn't done.

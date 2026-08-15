# Phase 29 — Commerce Fluency (v2.1)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-08-15.
> Source: the commerce-checkout attempt (2026-08-15). Asked whether v2.0.0 holds on a screen type deliberately unlike a dashboard, we built a full checkout with today's toolkit before speccing anything. It reached score 97 with a clean stress run — but only by declaring `genre: "dashboard"` on a checkout page, and after hand-repairing the generated design system, hand-fixing scaffold font sizes, and rewording legitimate retail copy. Fourteen gaps were recorded live. This spec is that evidence, turned into requirements.

---

## 1. SPECIFY

### Problem

Phases 27 and 28 tuned framesmith against dashboards, and the tuning took: the reference dashboard re-ran at 95 in both themes with zero workarounds. The checkout attempt shows that some of that tuning is dashboard-shaped rather than general. Three failure classes, each confirmed by evidence rather than prediction:

1. **The evaluator only knows two screen types.** Fourteen of the fifteen cliché flags on the finished checkout were `honest-content`, complaining that the subtotal, the line prices, the store-credit balance, and the discount percentage looked like fabricated data. The score was **77 without a genre and 93 with `dashboard`** — that single tell was the entire twenty-point gap. The only route to a passing gate was declaring the screen something it is not, which is precisely the miscalibration the genre docs warn against. Separately, the `slop-copy` tell flagged "30-day plant guarantee" as a section-number eyebrow because the phrase starts with a number and a hyphen.
2. **The generator can be silently overruled, and the scaffolds are off its system.** `generate_design_system` wrote a complete `soft` design language and then preserved inherited workspace tokens over it: a dark-brown `border` on a light-green system, and — worse, because nothing errored — `body`/`label` typography tokens that carry a size and no font family, so the `$body` role quietly lost the personality's face. Meanwhile the component scaffolds hardcode 12px and 14px throughout `structures.ts`, neither of which is on any generated scale, so stamping a scaffold puts an off-scale size into the design and the agent spends a round fixing framesmith's own output.
3. **Some advisories cannot be acted on.** The sibling-padding check moved its complaint up and down the tree as each fix changed which siblings differed — document root, left column, summary rail, basket card, order options — and can only be silenced by making the design worse. The spacing-variety advisory still reported nine unique values after the authored set was collapsed to six. And at one point the evaluation reported zero issues to resolve alongside fifty-two optional refinements, with the directive still reading NOT READY at 93: every blocking problem fixed, no honest move left.

The phase's claim: an agent asked for a checkout should reach the gate by describing the screen accurately, on a design system that survives being generated, using scaffolds that belong to it — and every remaining finding should be one a human would agree is a defect.

### Goals

- **A genre for transactional screens**, so a checkout's own prices stop reading as fabricated data without borrowing the dashboard label.
- **A generator whose output is not silently overruled** by inherited tokens, especially partial typography tokens that drop the personality.
- **Component scaffolds that reference the design system** they are stamped into, and that survive hostile content the way the page shells already do.
- **Advisories that are reachable**, and a directive that does not withhold readiness when nothing blocking remains.
- **Proof by re-run**: the checkout rebuilt with no dodges, at or above 95 in both themes.

### User stories

- **US1** — As the authoring agent, I stamp a checkout's real figures and declare `genre: "commerce"`, and the money on the page stops flagging as fabricated — while a pricing marketing page with invented customer counts still flags.
- **US2** — As the authoring agent, "30-day returns", "2-year warranty" and "24/7 support" are ordinary product copy and no tell fires on them; "01 — Introduction" above a heading still does.
- **US3** — As the authoring agent, `generate_design_system` gives me a language I can build on directly: no hairline colour inherited from an unrelated system, and no type role that resolves to a size while having lost its font.
- **US4** — As the authoring agent, every scaffold I stamp lands on the generated type scale and survives the long-text and i18n perturbations, so `canvas_stress` reports only my own authoring mistakes.
- **US5** — As the authoring agent, when the evaluation says there is nothing blocking left, the directive agrees with it.
- **US6** — As the reviewing human, the checkout attempt re-run on this phase reaches ≥ 95 with no genre borrowed, no design-system repair, and no scaffold sizes rewritten — the diff between the two attempt builds IS the phase's changelog.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **`commerce` genre** — a new entry in `RELAXED_BY_GENRE` relaxing `honest-content`, reached the same two ways `dashboard` is (durable via `canvas_set_genre`, per-call via the `genre` option). Documented as scoped to transactional surfaces — cart, checkout, order confirmation, billing history — and explicitly NOT a pricing or marketing page. | The checkout scores the same with `commerce` as it did with the borrowed `dashboard`; a marketing page stamped `commerce` still flags invented customer counts and testimonials, because those are not money-in-a-transaction. |
| FR-A2 | **Retail-copy guard on `slop-copy`** — the section-number-eyebrow pattern in `SLOP_COPY_PATTERNS` stops matching a leading duration or ratio followed by a unit noun ("30-day", "2-year", "24/7", "90-day"). | "30-day plant guarantee" passes; "01 — Introduction" above a heading still fires; existing slop fixtures stay green. |
| FR-B1 | **Typography preservation merges field-wise** — when `preservedFromDesignSystem` keeps an inherited typography token, it merges that token over the generated one field by field, so a preserved `fontSize` never discards the generated `fontFamily`, `fontWeight`, `lineHeight` or `letterSpacing`. | Generating `soft` into a canvas under a workspace whose `body` token is a bare 13px yields a `body` role that is 13px AND still Inter at the personality's weight and tracking. |
| FR-B2 | **Colour preservation is contrast-aware and loud** — an inherited colour token that fails contrast against the surfaces the generator just wrote is either not preserved or reported as a conflict distinct from an ordinary preservation, so an agent acts on it instead of skimming past. | Generating a light-green system under a workspace whose `border` is `#2a241a` does not leave a dark-brown hairline in place silently. |
| FR-B3 | **Opt out of preservation** — the generator accepts an explicit way to write its full language and ignore inherited tokens, since a caller asking for a whole new design language usually means it. | One documented option produces a canvas whose tokens are entirely the generated set, with the preservation report empty. |
| FR-C1 | **Scaffolds reference type roles** — every component and page structure in `src/structures.ts` references `$caption` / `$label` / `$body` / `$text-lg` / heading roles instead of literal `fontSize: 12` / `14` / etc. | Stamping any scaffold onto a generated design system introduces no font size absent from that system's scale; the type-scale ratio check and the unique-sizes advisory stay quiet. |
| FR-C2 | **Scaffolds survive hostile content** — every component scaffold carries the minimum-width floors, wrapping and designed truncation it needs to pass the long-text and i18n perturbations, as the Phase 27 page shells already do. | `initials-avatar` no longer clips a 36px monogram into a 32px box or lets its text escape its parent; `empty-state`'s title no longer overflows. |
| FR-C3 | **A scaffold regression test** — one test stamps every structure in the library onto a generated design system and asserts both properties: no off-scale font size, and `canvas_stress` CLEAN. | The test fails today on `empty-state` and `initials-avatar` and passes after FR-C1 and FR-C2. |
| FR-D1 | **The sibling-padding check is scoped or removed** — it must not fire on a page's structural bands (a thin utility strip, a header, a padded main region) or on cards whose internal padding is a per-component decision, and fixing it at one level must not relocate it to another. | Rebuilding the checkout produces no sibling-padding finding at any level; a genuine defect case (if one can be characterised) keeps firing, otherwise the check is deleted with its rationale recorded. |
| FR-D2 | **The spacing-variety threshold accounts for screen complexity** — the four-to-six target is calibrated against node count or region count rather than applied flat. | A screen whose authored spacing is drawn entirely from the generated scale does not carry a consolidation advisory. |
| FR-D3 | **The directive does not withhold readiness on advisories alone** — when zero warnings and zero errors remain, the directive reports the design ready, or info-only findings stop moving `overallScore`. Whichever is chosen applies uniformly, and the score stays honest about what it measures. | The state observed live — zero blocking, fifty-two optional, directive NOT READY at 93 — becomes impossible. |
| FR-E1 | **Oversized artboard stops duplicating a page band** — when the document height exceeds its content height, the renderer must not paint a second copy of a page band at the bottom of the artboard. Reproduced at height 1900 against ~1250px of content, with the header repeated; it disappears when the height is reduced. | A canvas with an artboard taller than its content renders each band exactly once. |
| FR-E2 | **`responsive: "fixed"` is implemented or withdrawn** — the value is documented in `batch_design`'s docstring and in `docs/GUIDELINES.md`, but `src/renderer.ts` only reads `'wrap'` and `'stack'`, so it is a silent no-op today. Either implement it or remove it from the documented surface. | The docstring, GUIDELINES and the renderer agree; `test-discoverability` pins whichever choice is made. |
| FR-E3 | **A way to capture the whole design** — `screenshot` hardcodes `fullPage: false` and exposes no option, so a design taller than its artboard can only be seen by editing the artboard height by hand. Provide either a full-document capture option or an artboard that sizes to content. | The checkout can be captured whole without editing `document.height`. |

### Non-goals (explicit scope cuts)

- **No checkout page archetype.** The core loop tells agents never to start from a blank canvas, and for this screen the nearest structure was `catalogue` — so the attempt started near-blank. Adding an archetype is craft work rather than code work, and it should sit on top of a correct evaluator and correct scaffolds rather than be built at the same time. It is the obvious next phase.
- **No product-image placeholder primitive.** A commerce screen is mostly product photography and there is no primitive for it; the attempt used tinted icon tiles. This belongs with the archetype work, for the same reason.
- **No flow-aware state coverage.** The coverage check identified the basket line list as a data table and demanded the generic empty, loading and error trio. Empty and error are right for a checkout and loading is marginal, but the real point is that a checkout's states are an empty basket, a declined payment, an out-of-stock line and an invalid address. Making coverage flow-shaped rather than table-shaped is a larger design question than this phase should absorb.
- **No new relax-genres beyond `commerce`.** One screen type, one piece of evidence. Adding speculative genres would repeat the mistake this phase is fixing.
- **No change to the five-axis critique rubric.** Phase 13's contract stands.

---

## 2. CLARIFY  (forks — recommendations)

- **C1 — Genre name.** *Recommend:* `commerce`, with `checkout` as an alias, mirroring the existing `dashboard` / `data` pairing. "Transactional" is more precise but less likely to be the word an agent reaches for.
- **C2 — Does `commerce` relax anything besides `honest-content`?** *Recommend:* no. `honest-content` was the only tell that fired on the finished screen. Relaxing more would be speculation, and every extra relaxation is a hole in the guardrail.
- **C3 — Colour-preservation conflict: drop or report?** *Recommend:* report loudly rather than drop silently, and keep dropping as the behaviour only when the inherited token actually fails contrast against the new surfaces. Silently discarding a deliberately-set workspace token would trade one surprise for another.
- **C4 — Sibling-padding: scope or delete?** *Recommend:* delete, unless a defect case can be characterised that the check catches and nothing else does. The evidence is that it fires on correct designs, cannot be satisfied, and relocates when addressed — that is a check with a negative expected value. Record the deletion and its reasoning in the PR so it is not reintroduced.
- **C5 — Directive vs score for FR-D3.** *Recommend:* make the directive authoritative on blocking findings and let it report ready at zero warnings and zero errors, keeping the score as an honest quality signal rather than a second gate. Zeroing advisories out of the score would make the number less informative; the number is not the contract, the directive is.
- **C6 — Scaffold type roles and the pattern gate.** *Recommend:* re-baseline the pattern-library gate as part of FR-C1 rather than trying to hold byte-identical renders. Referencing roles will move sizes on some scaffolds by a pixel or two; the gate should assert quality, not pixel stasis.

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — commerce vocabulary (FR-A1, FR-A2)**
- `src/evaluate.ts`: add `commerce` (and the `checkout` alias) to `RELAXED_BY_GENRE` at evaluate.ts:912 — `relaxedByGenre` and `knownGenres` pick it up for free; adjust the section-number pattern in `SLOP_COPY_PATTERNS` at evaluate.ts:1333 so a leading duration or ratio plus unit noun does not match.
- Surfaces in the same change: the genre gotcha and the `canvas_evaluate` / `canvas_set_genre` docstrings in `src/index.ts`, the cliché and genre sections of `docs/GUIDELINES.md`, and the genre list in `test-discoverability.ts`.
- Tests: `test-cliche.ts` — the checkout's money strings clean under `commerce`, a marketing page's invented social proof still firing under `commerce`, the retail phrasings clean, the numbered eyebrow still firing.

**Slice B — generator preservation (FR-B1..B3)**
- `src/index.ts` around the two `preservedFromDesignSystem` sites (index.ts:1054 and index.ts:1131) and the shared merge that feeds them: field-wise merge for typography entries, a contrast check for colour entries against the newly generated `bg-surface` / `bg-primary`, a distinct conflict shape in the report, and the opt-out option threaded through `generate_design_system`.
- Tests: a new case in the design-system tests covering the exact live conditions — a bare-size `body` token inherited over a personality that sets a family, and a dark `border` inherited onto a light generated system.

**Slice C — scaffolds on the system (FR-C1..C3)**
- `src/structures.ts`: replace literal `fontSize` values throughout with role references (`$caption`, `$label`, `$body`, `$text-lg`, headings); add minimum-width floors, wrapping and `textOverflow` where the stress run demands them, starting with `initials-avatar` and `empty-state`.
- New test stamping every entry returned by `list_structures` onto a generated system, asserting no off-scale size and `canvas_stress` CLEAN.
- Re-baseline the pattern-library gate; `benchmark/baselines.json` regenerates.

**Slice D — advisory honesty (FR-D1..D3)**
- `src/evaluate.ts`: the sibling-padding finding at evaluate.ts:771 inside `checkConsistencyDetailed`, scoped or removed per C4; the spacing-variety advisory at evaluate.ts:343 recalibrated; the unique-font-sizes advisory at evaluate.ts:510 reviewed alongside it.
- `src/index.ts`: the directive construction at index.ts:1980–1981 — ready when blocking is zero, per C5.
- Tests: fixtures asserting a correct page produces no sibling-padding finding, and that a zero-blocking evaluation reports ready.

**Slice E — renderer and capture (FR-E1..E3)**
- `src/renderer.ts`: the oversized-artboard duplicate (FR-E1) — reproduce first at the recorded dimensions, then fix; decide and act on `responsive: 'fixed'` (FR-E2), which today is read nowhere in the file.
- `src/screenshot.ts`: the four hardcoded `fullPage: false` call sites (screenshot.ts:95, 222, 265, 302) — expose an option or size the artboard to content (FR-E3).

Slice order: A → B → C → D → E. A is self-contained and unblocks the re-run's genre; B must land before C so the scaffold test has a correct generated system to stamp into; D is measured against a screen built on A–C; E is independent and can move if convenient.

---

## 4. TASKS

| # | Slice | Task | Test |
|---|-------|------|------|
| 1 | A | `commerce` genre + `checkout` alias in `RELAXED_BY_GENRE` | test-cliche, test-set-genre |
| 2 | A | Retail-copy guard on the section-number slop pattern | test-cliche |
| 3 | B | Field-wise typography preservation | test-design-system |
| 4 | B | Contrast-aware colour preservation + conflict reporting + opt-out | test-design-system |
| 5 | C | Scaffolds reference type roles across `structures.ts` | test-patterns, re-baseline |
| 6 | C | Scaffold stress hardening (`initials-avatar`, `empty-state` first) | test-stress |
| 7 | C | Stamp-every-scaffold regression test | new test |
| 8 | D | Sibling-padding scoped or removed; spacing-variety recalibrated | test-evaluate |
| 9 | D | Directive reports ready at zero blocking | test-evaluate |
| 10 | E | Oversized-artboard duplicate band | test-renderer |
| 11 | E | `responsive: "fixed"` implemented or withdrawn | test-discoverability |
| 12 | E | Full-document capture or content-sized artboard | test-screenshot |
| 13 | — | Checkout re-run, zero dodges, light + dark, ≥ 95 | manual + build diff |

---

## 5. ANALYZE  (risks & checks)

- **A genre is a hole in a guardrail, so scope it in the docs, not just the code.** `honest-content` exists because agents invent metrics and testimonials. `commerce` must read, everywhere it is documented, as "the money in this transaction is the design" — not "money is fine here". The negative fixture (a marketing page stamped `commerce` that still flags invented social proof) is the requirement, not a nicety.
- **The scaffold rewrite in Slice C touches every structure in the library.** That is a wide diff against a taste-vetted set, and the pattern gate will move. Re-baseline deliberately and read the rendered diff rather than trusting the score; a scaffold that still scores well while looking worse is the failure mode.
- **Deleting a check needs its reasoning recorded.** If C4 lands as a deletion, the PR must say what evidence retired it, so a future phase does not reintroduce a sibling-padding heuristic on first principles.
- **FR-D3 changes what "ready" means.** Loosening the directive is the right call on the evidence, but it slightly weakens the strongest thing framesmith says to an agent. Pair it with a check that the score is still reported prominently, so ready-at-93 does not read as ready-at-100.
- **Three findings from the attempt were my own error and are deliberately absent.** `read_nodes` was called with `nodeId` and `fields`, which are not its parameters (`nodeIds` and `maxDepth` are); `screenshot` was passed a `fullPage` argument it does not accept; and the duplicate band was first attributed to `responsive: "fixed"` when re-testing showed the trigger is the oversized artboard. FR-E1 and FR-E3 are what survived verification. Recording this here so the attempt log is not mined again for the retracted three.
- **The proof is the regression.** The checkout build lives outside the repo, but the re-run's score, theme pair and zero-dodge diff are quoted in the final PR; if any workaround survives — a borrowed genre, a hand-repaired token, a rewritten scaffold size — the phase is not done.

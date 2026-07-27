# Phase 23 — Design Gate Integrity (v1.10)

> Spec-driven breakdown, borrowing spec-kit's flow: **Specify → Clarify → Plan → Tasks → Analyze**.
> This is a planning artifact, not code. File/symbol references verified against `src/` on 2026-07-27.
> Source: issues #148 + #149 — both filed from one agent session working under a design-first gate in a downstream repo.

---

## 1. SPECIFY

### Problem

Downstream teams are starting to use framesmith canvases as a **design gate**: a screen may only be built/edited when an approved canvas describes it. Two failure modes from a real session show the gate can't currently keep its own promise:

- **Drift is invisible (#148).** Canvases are authored once, the code evolves, and nothing ever prompts a comparison. Two repo-bound canvases silently diverged from the shipped implementation — one showed a STATUS column, "Rename" links, and rows that no longer existed; the other showed a **radio group that was never built** (the implementation shipped a `<select>`). Both were caught by a human, not by tooling — and the radio/select mismatch caused a second-order failure where the difference was *annotated* rather than reconciled. `canvas_sync_from_url` exists but answers "how different does it look?" (a pixel percentage); nobody runs it, and a changePercent can't say *"the canvas has a radiogroup; the page has a select."*
- **Approvals are unversioned (#149).** An approval record references a canvas by name and status. Nothing detects that the canvas changed *after* it was approved — "approved" is a point-in-time judgment recorded as a permanent, unversioned fact. Combined with drift, an approval can outlive both the design it approved and the code it described. (The reporter's own gate greps for *any* `status: approved`, so one approved entry green-lights every UI edit on the branch — per-screen matching is only possible if approvals can carry something specific enough to match against.)

Root cause, shared: **framesmith gives the gate nothing falsifiable.** If approved canvases can silently stop describing reality, "approved" stops meaning anything — this is the single biggest threat to a design gate's credibility, and framesmith is uniquely placed to fix it: repo-bound canvases are already checked-in JSON, and the import pipeline already turns a live page into a comparable scene graph.

### Goals

- **Make "approved" falsifiable**: a stable content hash per canvas, so any consumer can verify that the canvas an approval referenced is still the canvas that exists.
- **Make drift detectable by tooling, not humans**: a structural comparison between a canvas and its shipped view that names the differences ("canvas has a radiogroup; page has a select"), coarse by design.
- **Make it runnable where it fails loudly**: from CI or a pre-commit hook via a CLI, not only over MCP — sync being *available* but never *demanded* is exactly how the incidents happened.

### User stories

- **US1** — As a gate consumer, I record `{ canvas, versionHash }` at approval time; later, one call tells me whether the approved canvas is still byte-for-byte the current design — so a stale approval fails instead of green-lighting.
- **US2** — As the authoring agent picking up an existing canvas, I run `canvas_check_drift` against the shipped route before designing on it, and get told the canvas shows a STATUS column the page no longer has — instead of faithfully restyling a fiction.
- **US3** — As a CI pipeline, I run `npx framesmith check-drift <canvas> --url <route>` and fail the build when the approved design and the shipped view structurally diverge.
- **US4** — As the authoring agent, when drift is reported I reconcile deliberately: re-import the changed region, or update the canvas, or flag the implementation — but never silently annotate the difference away.

### Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| FR-A1 | **Stable content hash** — `canvasVersionHash(canvas)`: SHA-256 over a canonical (recursively key-sorted) serialization of the canvas's *design content*: `root`, `variables`, `components`, `fonts`. Excludes `metadata` (feedback/critique/provenance stamps), `lastModified`, `createdAt`, `projectId`, canvas `id`, and `name` — process- and machine-independent, so the same design hashes identically everywhere. | Two processes loading the same repo JSON produce the same hash; resolving feedback or stamping a critique does NOT move it; any `batch_design` edit does. |
| FR-A2 | **`canvas_version` tool** — `{ canvasId, expectedHash? }` → `{ canvasId, name, versionHash, lastModified, matches? }`. With `expectedHash`, `matches: boolean` makes the approval check one call. | Approving against the returned hash, editing the canvas, and re-checking returns `matches: false`. |
| FR-A3 | **Hash surfaced where consumers already look** — `canvas_list` rows carry `versionHash`; `export` includes it in the payload header. | A gate can populate its approval records from `canvas_list` alone. |
| FR-B1 | **Structural drift engine** — `computeStructuralDrift(canvasRoot, importedRoot)` (pure, fixture-testable, no Chrome): compares normalized inventories of both trees and returns findings: `missing-in-page` (canvas element absent from the DOM), `missing-in-canvas` (page element the canvas lacks), `control-mismatch` (canvas `radio` vs page `select`, etc. across the input primitives), `table-mismatch` (column count / header set differences), each `{ kind, severity, canvasNodeId?, detail }`. Matching is text-anchored first (normalized text equality), then type+order — coarse output is the contract, per the issue. | Fixtures reproducing both incidents produce the right findings: the STATUS-column/Rename-link canvas yields `missing-in-page` entries naming them; the radiogroup canvas vs a select page yields one `control-mismatch` saying exactly that. |
| FR-B2 | **`canvas_check_drift` tool** — same live-page controls as `canvas_sync_from_url` (viewport / selector / waitFor / auth — auth stays in the throwaway context, never persisted); imports the page EPHEMERALLY (no canvas created, nothing mutated) and returns `{ inSync, findings, counts }`. Pixel diffing stays in `canvas_sync_from_url` — this tool answers *what* diverged, that one answers *how much it looks* diverged. | Running against an in-sync page returns `inSync: true, findings: []`; against the drifted fixtures, the findings above. Never mutates the canvas. |
| FR-C1 | **CLI entry** — the existing `framesmith` bin (dist/index.js) dispatches on argv before starting the MCP server: `framesmith check-drift <canvasIdOrName> --url <url> [--project-dir <dir>] [--json]` (exit 0 in-sync / 1 drift / 2 error) and `framesmith verify <canvasIdOrName> --hash <hash>` (exit 0 match / 1 mismatch / 2 error). Canvas resolution reuses the server's repo detection (walk up from cwd, `CANVAS_MCP_PROJECT_DIR` override); `verify` needs no Chrome, `check-drift` does. | A pre-commit hook using `verify` blocks on a post-approval edit; a CI job using `check-drift` fails on either incident fixture served locally. |
| FR-D1 | **Workflow lands on the agent surfaces** — the manual rule the issue proposes ("always verify a canvas against the implemented view before designing on it") becomes a GOTCHA + INSTRUCTIONS + GUIDELINES workflow step: when picking up a canvas that describes a shipped view, run `canvas_check_drift` first; on findings, reconcile deliberately (update canvas / fix implementation / re-import) — never annotate the difference. `test-discoverability.ts` lists extended for the new tools and finding kinds. | An agent reading only the connect-time instructions knows drift-check-before-design is part of picking up a bound canvas. |

### Non-goals (explicit scope cuts)

- **No approval-record storage in framesmith** (decided 2026-07-27) — which screens need approval, who approves, and where records live (`design-approvals.yml`, PR reviews, whatever) is the consumer's gate logic. framesmith's job ends at making "approved X" checkable: the hash and the verify call.
- **No auto-reconciliation** — `check-drift` reports; it never edits the canvas or suggests the page is wrong. Reconciling is a judgment call (US4), and the radio/select incident shows exactly why silently "fixing" either side is the failure mode.
- **No per-node DOM selector mapping** — findings anchor to canvas node IDs and human-readable descriptions, not CSS selectors into the page. Selector-level mapping is brittle across builds and unnecessary for the coarse contract.
- **No pixel-diff changes** — `canvas_sync_from_url` is untouched; the two tools compose (structural first, pixel when structure agrees but styling drifted).
- **No watch/daemon mode** — CI and pre-commit are the demand points; a background watcher is speculative.
- **No hash-chain / history** — one current hash, no lineage. Git already versions the repo-bound JSON; lineage is `git log`.

---

## 2. CLARIFY  (forks — recommendations; ★ = needs user confirm)

- **C1 — Drift surface.** ★ **Decided 2026-07-27: new `canvas_check_drift` tool + CLI.** Alternatives considered: extending `canvas_sync_from_url` with a structural section (fewer tools, but couples "what diverged" with "how much it looks diverged" and gives CI no entry point); MCP-only without the CLI (leaves the "available but never demanded" gap open — the exact way both incidents happened).
- **C2 — Approval scope.** ★ **Decided 2026-07-27: hash + verify only.** Full approval records (`{ canvasId, hash, timestamp, status }` stored in `.framesmith/` with approve/check tools) were considered and cut: it bakes one team's gate workflow into the tool, and the reporter's per-screen-matching problem is solved by the hash alone.
- **C3 — What the hash covers.** *Recommend:* design content only — `root`, `variables`, `components`, `fonts` — canonically serialized (recursively sorted keys, no whitespace). Exclude ALL of `metadata`: feedback arriving or being resolved, critique stamps, and provenance must not invalidate an approval (the design didn't change). Node IDs inside `root` ARE included — an ID rewrite is a real content change to the checked-in JSON, and excluding IDs would make structurally-identical-but-rebuilt trees hash equal, which overstates stability. Con: a cosmetic re-key changes the hash; acceptable — re-keys are rare post-bind and a false "changed" is the safe direction for a gate.
- **C4 — Matching strategy for the structural diff.** *Recommend:* two-pass, coarse by design. Pass 1: match text nodes across trees by normalized content (trim/collapse whitespace, case-fold); matched text anchors its nearest control/table ancestors. Pass 2: match remaining nodes by (type, document order) within unmatched regions. Everything still unmatched becomes `missing-in-page` / `missing-in-canvas`. Alternatives: tree-edit-distance (precise, but heavy and its output doesn't read as "canvas has a radiogroup; page has a select"); position/geometry matching (import already normalizes geometry away). The issue explicitly blesses coarse: *"even just 'canvas has a radiogroup; rendered view has a select' would have caught both incidents."*
- **C5 — CLI packaging.** *Recommend:* argv dispatch inside the existing `framesmith` bin — `npx framesmith` with no args stays the MCP server (how every client launches it), `check-drift`/`verify` subcommands run and exit. Alternative: a third bin (`framesmith-check`) — avoids any risk to the server entry path but adds a name to remember and a `files` entry; not worth it for two subcommands. Guard: subcommand parsing happens before any server/viewer bootstrap, and unknown args fall through to the server unchanged (a client passing flags we don't know about must not break).
- **C6 — Where `table-mismatch` gets its structure.** *Recommend:* both sides reduce to the same shape — imported pages via Phase 18's table reconstruction (named `Table`/`Row`/`Cell` frames), canvas side via the same names from the `data-table` structure plus a generic "rows of same-shaped cells" detector for hand-built tables. Column count + header-text set compare; row count is reported informationally only (data length isn't drift). Rowspan tables already degrade with a warning at import (Phase 18) — out of scope here.
- **C7 — Hash algorithm/format.** *Recommend:* SHA-256 via `node:crypto`, rendered as `sha256:<first 16 hex>` — short enough for YAML approval records and log lines, 64 bits of collision resistance is far beyond the threat model (accidental staleness, not adversaries). Full digest available internally if ever needed.

---

## 3. PLAN  (technical — mapped to real symbols)

**Slice A — version hash (#149)**
- NEW `src/version.ts`: `canonicalSerialize(value)` (recursive key-sort, JSON) + `canvasVersionHash(canvas)` → `sha256:<16hex>` over `{ root, variables, components, fonts }`. Pure; no fs.
- `src/index.ts`: register `canvas_version` (thin handler: `ensureFresh` → hash → optional `matches`); add `versionHash` to the `canvas_list` row mapper and the `export` payload header.
- Tests: `test-version-hash.ts` — determinism across key order, metadata/feedback/critique edits don't move it, tree/token/component/font edits do, `expectedHash` matching.

**Slice B — structural drift engine + tool (#148)**
- NEW `src/drift.ts`: `extractInventory(root)` (text runs normalized; controls with nearest label text; tables reduced per C6; icons/images/charts counted) + `computeStructuralDrift(canvasRoot, importedRoot)` per C4. Pure — fixture-testable without Chrome, mirroring how `domToSceneGraph` is tested.
- `src/index.ts`: register `canvas_check_drift` — reuses `importUrl` + the shared `validateImportArgs` live-page plumbing from Phase 17 (`src/import.ts`, `withIsolatedPage`); never creates a canvas, never mutates.
- Tests: `test-drift.ts` (pure fixtures, incl. both incident reproductions) + `test-check-drift-url.ts` (local http server pattern from `test-import-url.ts`, no external network).

**Slice C — CLI (#148/#149)**
- `src/index.ts` entry: argv dispatch before server bootstrap → NEW `src/cli.ts` (`runCheckDrift`, `runVerify`; canvas resolution via the existing repo-store startup walk; `--json` for machine consumption; exit codes 0/1/2 per FR-C1). Keep `src/cli.ts` free of MCP imports so `verify` stays Chrome-free and fast.
- Tests: `test-cli.ts` — spawn `node dist/index.js verify …` against a temp `FRAMESMITH_HOME`, assert exit codes; `check-drift` covered through the slice-B url test's server.

**Slice D — agent surfaces + docs**
- `src/index.ts`: INSTRUCTIONS (extend the "Import from implementation" paragraph: sync = how much, check-drift = what, version = is the approval still true), GOTCHAS (drift-check before designing on a bound canvas; reconcile deliberately), docstrings land with their slices.
- `docs/GUIDELINES.md`: new "Keeping the design honest" section (drift workflow, hash-based approvals, CI/pre-commit recipes). `README.md`: Tools rows + a gate-integrity blurb. `VISION.md` tick.
- `test-discoverability.ts`: new tools auto-covered by check 1; extend with a finding-kind list (`missing-in-page`, `missing-in-canvas`, `control-mismatch`, `table-mismatch`) pinned to index.ts + GUIDELINES, and `versionHash` pinned likewise.
- Dispatch docs-steward before each slice PR per repo convention.

**Order:** A → B → C → D (A is dependency-free and smallest; C needs B; D touches surfaces the earlier slices create). Each slice is one PR.

---

## 4. TASKS

- [ ] **T1 (A)** `src/version.ts` + `canvas_version` + `canvas_list`/`export` surfacing + `test-version-hash.ts` — closes the #149 core
- [ ] **T2 (B)** `src/drift.ts` engine + fixtures reproducing both #148 incidents + `test-drift.ts`
- [ ] **T3 (B)** `canvas_check_drift` tool wiring + `test-check-drift-url.ts`
- [ ] **T4 (C)** argv dispatch + `src/cli.ts` (`check-drift`, `verify`) + `test-cli.ts`
- [ ] **T5 (D)** surfaces (INSTRUCTIONS/GOTCHAS/GUIDELINES/README/VISION) + `test-discoverability.ts` extensions + docs-steward pass

---

## 5. ANALYZE  (risks & checks)

- **False drift on styling-only rewrites.** The import pipeline is lossy by design; the structural inventory must only compare what survives import faithfully (text, control types, table shape, counts) — never styles. Mitigation: the engine consumes the same normalized shapes `test-import-url.ts` already proves stable; anything else stays out of the inventory.
- **Text matching vs dynamic content.** Live pages contain data the canvas's placeholder copy won't match (dates, live figures), which pass 1 won't anchor. Mitigation: unmatched text alone is reported at `info` severity (counts, not per-string noise) unless it co-occurs with a structural finding; the blocking kinds are the structural ones (`control-mismatch`, `table-mismatch`, missing controls/columns).
- **CLI vs server entry regression.** The `framesmith` bin is how every MCP client launches the server; a bad argv dispatch bricks installs. Mitigation: dispatch matches exact subcommand names only, everything else falls through untouched; `test-cli.ts` includes a "no args still boots as server" smoke (spawn, expect the MCP handshake banner, kill).
- **Hash stability across serialization changes.** If a future phase adds a field to `SceneNode`, hashes move even for untouched canvases (the JSON gains keys only after an edit, so in practice only edited canvases move — but document it: a framesmith upgrade is not expected to invalidate approvals, and `canonicalSerialize` must never inject defaults).
- **Scope discipline.** The gravitational pull here is toward building the gate (approval records, statuses, per-screen policy). The non-goals section is the contract: hash + verify + drift report, nothing more, until a downstream consumer proves demand.

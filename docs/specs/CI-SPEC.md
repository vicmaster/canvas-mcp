# Continuous integration — make the test suite runnable, then run it on every pull request

## Where this came from

While discussing whether slice pull requests should keep going straight to master, I inventoried what actually protects master today. The answer is nothing: there are no GitHub Actions workflows, no branch protection, and no checks of any kind on a pull request. Every release so far has been guarded by running tests by hand and remembering which ones matter.

That held up because there is a single disciplined maintainer, but it has already failed twice without anyone noticing. The repository has 102 test files and **no way to run them as a suite** — there is no `test` script in `package.json`, so each file is invoked individually with `npx tsx`. Running all 69 of the tests that do not need Chrome takes about four minutes and produces 65 passes and 4 failures. Two of those failures are real and long-standing: I checked them out at `10d09cb`, the v2.0.0 release tag, and they were **already failing there**. Broken tests shipped in a release because nothing ever ran them together.

The missing runner is the root cause, and it has to be fixed before continuous integration is worth anything. A pipeline that is red on its first run teaches you to ignore the red X, which is worse than having no pipeline at all.

## What the suite looks like today

Of the 102 files, 33 need Chrome (they call `takeScreenshot`, `computeLayout`, or `withPage`) and the rest are pure. Six touch the network or an LLM API key. One never exits by design. The four current failures break down as follows.

`test-viewer.ts` starts a server and waits — it is interactive by design and was never meant for a batch run. It needs to be excluded by name, not fixed.

`test-cli.ts` is misfiled. Its `check-drift` cases need Chrome, so it fails whenever it is run in the group that is supposed to be Chrome-free. It belongs in the other tier.

`test-component-structures.ts` is stale. It asserts that the `data-table` scaffold contains a node called `dt-row1-status-toggle`, but the scaffold was rebuilt at some point since that test was written: the identifiers are now `dt-r1-*` and the status cell is a chip rather than a toggle. The render assertion checks for a border radius that belonged to the old toggle track. The scaffold is fine; the test describes a version of it that no longer exists.

`test-typography-depth.ts` is the one that needs a judgement call. It asserts that a numeric table cell without `tabularNums` produces an advisory about proportional figures, and that advisory no longer fires on its fixture. This is a genuine behaviour change and it is not obvious which side is right — the table detector was tightened in a later phase, so either the advisory has quietly stopped covering small tables and that is a loss worth restoring, or the tightening was correct and the fixture is simply too small to be a table any more. It has to be investigated before it is fixed in either direction.

Separately, the local Puppeteer cache holds only an unextracted `.zip`, so the 33 Chrome tests cannot run on this machine at all right now. That is a local environment problem rather than a repository one, but it is the reason the Chrome tier has not been exercised recently and it should be confirmed working before the pipeline depends on it.

## Slice A — make the suite runnable and green

Add the missing runner as a small script that discovers `test-*.ts`, runs each one, and reports a summary with a non-zero exit code if any fail. Split it into tiers so that the fast feedback is genuinely fast: a `test:fast` tier for the tests that need nothing but Node, a `test:full` tier that adds the 33 Chrome tests, and `test` as the sensible default. Exclude the interactive viewer test by name, with a comment saying why, so nobody re-adds it. Move `test-cli.ts` into the Chrome tier where it belongs.

Fix the stale `data-table` assertions so they describe the scaffold as it exists now rather than as it was. Investigate the tabular-figures advisory and either restore the behaviour or update the fixture and its comment to record the deliberate narrowing — whichever the investigation supports, with the reasoning written down in the test rather than in a commit message.

Confirm that the tests which reach the network or want an API key degrade rather than fail when neither is available. `test-llm-judge.ts` and `test-flow-critique.ts` want a key, and the font tests reach Google Fonts. A machine that is offline or keyless should see them skip with a clear line saying so, because that is exactly the state a fresh continuous-integration runner is in.

This slice stands on its own. Even if the pipeline never gets built, being able to type one command and learn whether the project is healthy is worth having, and it is the thing that has been missing for 102 test files.

## Slice B — run it on every pull request

Add a GitHub Actions workflow triggered on pull requests and on pushes to master, with two jobs so that a typo does not wait behind a browser download.

The fast job installs dependencies, runs the TypeScript build as the type check it already is, and runs the `test:fast` tier. It should finish in roughly a minute and is the one that will catch almost everything.

The Chrome job installs the Puppeteer-managed browser and runs the `test:full` tier. It is slower and it is allowed to be, because its feedback is not what unblocks the common case.

Neither job needs a secret. The tests that would use an API key skip without one, which Slice A confirms, so the pipeline stays useful on pull requests from forks. Pin the Node version in the workflow and add a matching `engines` field to `package.json`, since the project currently declares no supported Node version anywhere.

Once the workflow has run green a few times, turning on branch protection for master with these checks required is a one-click follow-up. That is deliberately not part of this issue — the checks should earn trust before they can block a merge.

## Proof

The work is done when a fresh clone can run one command and get an honest verdict, and when opening a pull request produces the same verdict automatically without anyone remembering to ask for it. Concretely: `npm run test:fast` exits zero with every test accounted for as passed or explicitly skipped, `npm run test:full` does the same on a machine with Chrome, and a pull request shows both checks with no failures and no test quietly missing from the run.

## Deliberately not in scope

Branch protection, as described above. A test framework — the existing files are plain scripts with their own `check()` helpers and a zero-or-one exit code, that convention works, and rewriting 102 files onto a runner is a much larger change with no relationship to the problem this issue names. Release automation, since publishing stays a manual step that Victor initiates. Coverage measurement, which is a reasonable thing to want later but is not what is broken now.

<!-- SPDX-License-Identifier: GPL-2.0-only -->

# Working in this repository

Rules for any coding agent (and any human) changing this fork. They exist
because the expensive failures here are not typos: they are a broken `main`, two
edits to the same file in one working tree, and a claim of "verified" for
something that was never run.

## What this repository is

`ranuay/Virtual-FPGA` is a fork of `rlangoy/HDLBoard` (upstream, GPL-2.0), being
extended into the ACSL Virtual FPGA Lab. `PRD.md` is the specification and the
phase plan; `docs/*.md` are the per-feature plans. Read the relevant plan before
touching the feature it describes — they carry the decisions and the tests those
decisions are pinned by. `docs/acsl_tickets.md` is the order of what is left and
which of those plans a ticket will touch.

Two simulators do the real work, and neither is installed by `npm install`:
GHDL (VHDL) and Icarus Verilog (Verilog). Without them the app still runs but
nothing simulates.

## Branches

`main` is the trunk and is expected to be green. Work happens on a short-lived
branch, one ticket at a time:

```
git switch main
git pull --ff-only
git switch -c acsl/<topic>        # e.g. acsl/ghdl-compat, acsl/nexys-a7-board
```

- **Never commit or push to `main` directly.** Open a pull request; `main` is
  protected and requires the `verify` check (`.github/workflows/ci.yml`).
- One branch per ticket, named after it, lasting days not weeks. Long-lived
  feature branches here collide in the same files (`src/boards/*`,
  `server/src/session.ts`, `server/src/tbTemplate.ts`, the workbench shell),
  and the fork has to merge `upstream/main` regularly on top of that.
- Commit before switching branches. `git switch` carries uncommitted edits into
  the next branch, which is how a half-finished change ends up in an unrelated
  PR.
- Two agents at once need two working trees, not two checkouts of one:
  `git worktree add ../vf-<topic> -b acsl/<topic>`. Git refuses the same branch
  in two worktrees, which is the point.
- Never `push --force` to a branch someone else may have based work on, and
  never `reset --hard`, `clean -fd` or `checkout -- .` to "clean up" — they
  discard work that is not yours.

## Before you call a change done

Run, from the repository root:

```
npm run typecheck                 # frontend
npm test                          # frontend, vitest over src/
npm run lint
npm run typecheck --prefix server # backend
npm test --prefix server          # backend unit tests, Node's runner
npm run build                     # tsc -b && vite build
```

Windows note: `npm test --prefix server` runs `tsc -b` first; it needs no
simulator (the simulator tests skip themselves).

Then check the behaviour itself, not only the suite — run the app
(`npm run dev` plus `server`'s `npm start`) and exercise the changed path. Tests
alone are not evidence that a UI or a simulation pipeline works.

**Do not claim a simulator result you did not observe.** If GHDL or Icarus is
not on `PATH`, say the change is untested against a simulator instead of
inferring it from unit tests that ran with the tool missing.

## Tests

| Where | Runner | Command |
|---|---|---|
| `src/**/*.test.ts(x)` | vitest | `npm test` |
| `server/src/**/*.test.ts` | Node's runner over `server/dist` | `npm test --prefix server` |
| `server/src/integration/**` | Node's runner, needs GHDL/Icarus, one file at a time | `npm run test:integration --prefix server` |
| `tests/e2e/*.md` | manual checklists | — |

Add a test for behaviour a consumer can see: boundaries, precedence, error
paths. Do not add tests that re-read the source text, restate a default, or
assert that a function did not throw. The existing suites are large because
they pin real rules (see `docs/changelog.txt` for what each one guards); match
that level, not a higher one.

The backend's tests import from `dist/`, so a new test file needs `tsc -b` —
`npm test --prefix server` already does it.

## Code conventions

- SPDX header on every new source file, matching its neighbours.
- New frontend folders are linted only when added to `NEW_CODE` in
  `eslint.config.js`; add a new feature's folder there rather than leaving it
  unchecked. Old files are not added — the list is for new code.
- Vitest covers `src/` only, and its CSS stubbing is deliberately narrow; see
  the comment in `vitest.config.ts` before adding a test that imports CSS.
- Prefer editing the module the plan names. Do not reformat, rename or
  "tidy" files a ticket did not ask about; it makes the review diff useless.
- Board definitions are data (`src/boards/builtinBoards.json`), not literals
  scattered through components. Nexys A7 already exists there: 16 SW/LED,
  5 buttons plus `CPU_RESETN` (active-low), 8-digit multiplexed display,
  100 MHz. Extending it is not the same as adding hardcoded mappings.
- `server/` is a separate package with its own `package.json`,
  `package-lock.json`, `tsconfig.json` and lint config. Install with
  `npm ci --prefix server`.
- Version numbers come from git tags at release time (`tools/bump-version.mjs`
  stamps them on the runner). Do not bump `package.json` by hand.

## Documentation

`docs/changelog.txt` is the project's history, newest first: one dated entry per
change that a user can see, written as prose that names the behaviour and the
files/decisions behind it. A user-visible change without an entry is unfinished.
Plans live in `docs/<feature>_*.md`; update the plan when the implementation
departs from it, rather than leaving the two disagreeing.

## Never

- Commit secrets, `.env` values, tokens, or anything from `.run/`, `temp/`,
  `Claude outputs/`, `Examples/` or `*.log` (all gitignored for a reason).
- Delete or rewrite tests to make a change pass. If a test encodes a wrong
  expectation, change it in its own commit with the reason in the message.
- Run `git push` at all unless asked; never to `main`.

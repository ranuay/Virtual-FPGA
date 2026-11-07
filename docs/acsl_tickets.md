# ACSL tickets

The work left between here and a lab the ACSL course can use. `PRD.md` is the
specification; this file is only the order, so two agents (or two Mondays) never
edit the same file at once.

Scope is **Bab 5, 6, 7** - seven segment and buttons, FSM and traffic light, ALU.
Bab 4 (UART, LDR, PuTTY) is deferred, see the bottom.

## How a ticket runs

```
git switch main && git pull --ff-only
git switch -c acsl/<branch>          # the branch column below
git push -u origin acsl/<branch>     # then a pull request; `verify` must pass
```

A second agent on a second ticket gets a second working tree, not a second
checkout: `git worktree add ../vf-<branch> -b acsl/<branch>`. Do not pre-create
branches for work nobody has started - a branch that lives for weeks is a merge
conflict in `src/boards/*` and `server/src/session.ts` (AGENTS.md, Branches).

## How an example reaches a board

Read this before writing one; it is where new examples go wrong.

- **The built-in pair** is an entry in `EXAMPLE_FILES`
  (`src/components/workbench/files.ts`) plus a card in `CATALOGUE`
  (`src/components/workbench/examples.ts`). It is written in the Default board's
  names and `copyExample` renames its ports into the chosen board's names.
- **The rename only works between boards that need no other edit**
  (`renamesPortsOn`, `src/boards/boardPorts.ts`): Default, DE1-SoC, DE10-Lite.
  For **Basys 3 and Nexys A7 it renames nothing at all** - pinned by
  `src/boards/boardShape.test.ts`, "renames nothing to or from a Digilent board".
  So on the lab's Nexys A7 a built-in example keeps `LEDR` and `KEY_N`, which that
  board does not have, and its LEDs simply never move.
- **Therefore a board-port example needs a file of its own** in
  `src/components/workbench/boardExamples/nexys-a7/<language>/`, with a file *name*
  matching the built-in one (`BOARD_EXAMPLE_FILES` keys the board file by the
  built-in id). One such file with no built-in twin is taken as that board's *top
  level*, so never add a second.
- **`usesHex: true` is the only gate** that hides a card from a board without such
  a file (`examplesFor`). Despite the name it means "written per board", which is
  what the traffic light and ALU cards need too. If that reads badly while doing
  T2, rename the property to `perBoard` in the same change: one property, a
  handful of call sites, `examples.test.ts`.
- Board files also need a **description** per board where the built-in text names
  another board's keys (`BOARD_DESCRIPTIONS`), and test designs in
  `server/src/testSupport/shapeDesigns.ts` if a suite drives them.

## Merge first

Two pushed branches are ahead of `main` and nothing else can be trusted before
they land. Merge them before T1 and do not re-implement either. Each now has a
second commit on top (see the rows), so the branch tip is what merges.

| Branch | What it fixes |
|---|---|
| `acsl/ghdl-compat` (`739e5e6`) | ACSL handout code that imports `ieee.std_logic_arith`, `std_logic_unsigned` or `std_logic_signed` does not analyse on `main`: `GHDL_STANDARD` there is a bare `--std=08` (`server/src/engines/ghdlEngine.ts:29`) and GHDL wants `-fsynopsys` at `-a`, `-e` *and* `-r`. The branch replaces that constant with `GHDL_OPTIONS` carrying the flag and pins it in `integration/synopsysPackages.test.ts` — verified on this machine's bundled GHDL 6.0.0, 2/2 pass. Without it, every practical sheet has to be edited by the student first, which defeats the lab. Its second commit (`739e5e6`) names the flag in the docs that list the backend's GHDL commands: `editor_diagnostics_implementation_plan.md` § 2.6 and Appendix A, `editor_diagnostics_improvement_plan.md` § 1, `plugin_batch_implementation_plan.md` § 2 and § 5. |
| `acsl/verilog-include-cycle` (`f3788fe`) | A circular `` `include `` is only found by Icarus exhausting its descriptors, so the run dies on the 30 s compile timeout with no message. The branch finds the cycle in `server/src/verilog/includes.ts` before any compiler starts and reports file, line and loop. Its second commit (`f3788fe`) stops it counting an `` `include `` behind an `ifdef`/`ifndef`/`if` as an edge: a false guard makes the cycle legal (Icarus 13.0 compiles it in 59 ms), so counting it rejected working code. Verified through the backend on this machine: the guarded cycle reaches `READY`, an unguarded one is an `analyze` error naming `top2.v → b.vh → top2.v` in 9 ms. |

## Ready to start

| # | Branch | What | Done when |
|---|---|---|---|
| T1 | `acsl/seven-seg-examples` | Bab 5's two practical designs (PRD Phase 4 tasks 3-4): an up/down counter shown on the display, and a binary-to-BCD converter. Both drive a display, so each needs the built-in pair in Default names (`HEX0_N`/`HEX1_N`, independent) **and** a Nexys A7 file using `CA..CG` + `DP` + `AN`, card `usesHex: true`. `src/components/workbench/boardExamples/nexys-a7/vhdl/keyCounter7Seg.vhdl` is the pattern: segment table, `CLOCK_500Hz` digit scan, `BTNC`/`BTNU`. Cross-check the numbers against the handouts before writing them. | On the Nexys A7 board both examples load from the Examples pane; the counter steps on `BTNC` and resets on `BTNU`; the digits shown equal the binary value on the switches; and a test pins two digits of each - a design pair in `server/src/testSupport/shapeDesigns.ts` driven through the `nexys-a7` case in `integration/boardShapes.test.ts`. |
| T2 | `acsl/traffic-light` | Bab 6's FSM (PRD § 5, Phase 4 tasks 5-7). LED-only output, `LED2..0` = red, amber, green, each state held long enough to watch, clocked from `CLOCK_500Hz` so no divider is needed. Because the rename is inert on Nexys A7 this still needs a `boardExamples/nexys-a7/` file (`LED` there, not `LEDR`), card gated like T1. Declare the states so a waveform can name them: Verilog `localparam` groups (`src/components/waveform/verilogStates.ts` reads `localparam` only, never `parameter`), or a VHDL enumeration, which GHW carries by name. Note that **only a batch run has a waveform** - `boardPlan` (`ghdlEngine.ts:99`, `verilogEngine.ts:143`) sets no `wave` - so the named states are visible in a testbench run, and in board mode the three LEDs are the whole observation. | Red → green → amber → red at roughly 1 s a state on the LEDs; the same file run as a batch run names its states in the waveform; a scenario test drives one full cycle. |
| T3 | `acsl/alu-examples` | Bab 7's eight designs (PRD Phase 6): half adder, full adder, 3-bit adder, full subtractor, 3-bit subtractor, 3-bit multiplier, 3-bit comparator, ALU. Operands from `SW`, result and carry/borrow/compare on `LED`, the ALU's opcode on the top three switches. Built-in pair plus a Nexys A7 file each, same reason as T2. **No visualizer UI** - see "Not tickets". | For each design, a scenario test drives a set of operands and asserts the exact `STATE` bits; a swapped operand order or a dropped carry fails it. |

## Needs something this repository does not have

| # | Branch | What | Needs |
|---|---|---|---|
| T4 | `acsl/nexys-lab-profile` | Check `nexys-a7` against the lab's own hardware and handouts (PRD § 4: master XDC, board reference manual, practical source, the hardware in the lab) and record what differs. | A human with the lab board and the handouts. Do not guess a pinout. |
| T5 | `acsl/deploy` | `docker/`, `nginx.conf` and `docs/HOSTING*.md` against the real domain (PRD says `fpga.acsl.my.id`; nothing in the repo names it yet), sized for a lab. | A host |

## Already there (do not re-ticket)

Evidence is a passing suite or a file, not a claim.

| Bab | State |
|---|---|
| - | `nexys-a7` matches the Digilent hardware: 16 `SW`, 16 `LED`, five cross-placed buttons `BTNC/U/L/R/D`, active-low `CPU_RESETN` as its own field, 8-digit multiplexed `CA..CG` + `DP` + `AN`, 100 MHz (`src/boards/builtinBoards.json`). `integration/boardShapes.test.ts` runs a `nexys-a7` case in both languages through the same code path as Basys 3 and DE10-Lite. |
| 5 | Buttons and reset are wired by the generated testbench from the board shape: names, widths and polarity come from `server/src/engines/boardShape.ts` and `boardPorts.ts`, so the student writes no glue. Polarity is per board - active-low `KEY_N`/`KEY` on Default, DE1-SoC and DE10-Lite, active-high `btnC`/`BTNC` on Basys 3 and Nexys A7. A width that does not match the board is reported before elaboration (`boardShapeCheck.ts`), in VHDL as an error and in Verilog as a note. |
| 5 | A multiplexed display is decoded in the generated testbench, not the browser: a digit stays lit for 75 ms after its enable goes away (`DISPLAY_PERSIST_MS`), so the pane shows stable digits rather than a flicker - `boardShapes.test.ts`, "a 4-digit refresh from CLOCK_500Hz shows four stable digits, dark 75 ms after it stops". |
| 6 | State names in a **batch** waveform: Verilog from the sources' `localparam` groups (`src/components/waveform/verilogStates.ts`), VHDL enumerations through GHW (`src/components/waveform/ghwParser.ts`). |
| 7 | Nothing yet: T3 is the first ALU material in the repository. |

## Not tickets

- **An ALU or traffic-light picture.** PRD Phase 6 asks that every output come
  from the simulation; `SW` → `LED` already is that, since the bits are the
  design's own signals. A widget redrawing them would carry nothing the LED panel
  does not, and that panel already reads out hex and decimal. If a handout insists
  on a picture it is a small component over the same `STATE` bits - `Led` already
  takes `color: 'red' | 'green' | 'amber'`
  (`src/components/Leds/Led.tsx`) - with no protocol or backend change.
- **A new pane.** Two side panes exist (`sidebar`, `board`) and the board pane is
  where all of Bab 5-7 is observed. Nothing in these three chapters needs a third.

## Deferred: Bab 4

Out of scope until Bab 5-7 are done. What it would need, so it is not lost:

- **Virtual serial terminal** (PRD Phase 5 tasks 3-7). Three modules are written
  and unit-tested but not wired in: `docs/impl_files_for_plugins/ts/pluginLine.ts`,
  `pluginCatalog.ts`, `uartPayload.ts`; the sender is
  `docs/impl_files_for_plugins/vhdl/uart_monitor.vhd` with `hdlb_pkg.vhd`. The work
  is the wiring - analyse the plugin library before the student's files, forward a
  `PLUGIN` frame, render the pane - not a second UART.
- **Virtual LDR** (PRD Phase 5 tasks 1-2): one optional role in
  `src/boards/types.ts`, its mirror in `server/src/engines/boardPorts.ts`, and the
  `BOARD` frame that carries it.
- **PuTTY** (PRD Phase 5 task 9) is optional in the PRD. Revisit only if a handout
  insists on a real serial port.
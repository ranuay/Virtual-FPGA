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

## The handouts

The practical sheets are the site, not a PDF: <https://fpga.acsl.my.id/docs/>.
Its VHDL was run through this backend, so what follows is measured, not read off
the page.

**It compiles as printed.** All thirteen sources - Bab 5's `sevseg`, `sevseg2`,
`sevseg3`; Bab 6's `sevseg_fsm`, `TrafficLightFSM`; Bab 7's eight - analyse *and*
elaborate on the bundled GHDL 6.0.0 with `--std=08 -fsynopsys`, the flags
`acsl/ghdl-compat` adds. That branch is enough to make the sheets work; never edit
a handout to make it compile.

**It shows nothing as printed.** Run in board mode on `nexys-a7`, all thirteen
reach `READY` and every one is inert: exactly one `STATE` frame, then no more,
carrying `16 zeros + 48 ones` - every LED off, every digit dark. Each port is
warned as not a board port (`clk`, `pos_seg`, `led_seg`, `count_up`, `bcd_input`,
`green`, `a`, `b`, `sel`…), the testbench holds the inputs at 0 ("`clk` is not a
board input, so the board holds it at 0") and drops the outputs. Renaming is
therefore the job of T1-T3, not a tidy-up after it.

The rename each design needs, so a student's copy from the site still matches what
they see in the lab:

| Handout port | Board port |
|---|---|
| `clk` (100 MHz, counting) | `CLK100MHZ` |
| `clk` (only "slow enough to press") | `CLOCK_500Hz` |
| `count_up`, `count_down` | `BTNC`, `BTNU` |
| `reset` | `BTNU`, or `CPU_RESETN` (active-low) |
| `pos_seg`, `an` | `AN` |
| `led_seg`, `seg` | `CA..CG` + `DP` |
| `green`, `yellow`, `red` | `LED0`, `LED1`, `LED2` |
| `bcd_input`, `a`, `b`, `c`, `sel` | `SW` |

### Where the handouts are wrong, and what T1-T3 do about it

Each was observed; none is a guess.

- **`sevseg` cannot run at all - it crashes on a bound check.** Both of its
  counters declare a subtype the increment overflows, and GHDL checks the
  *expression*, not the assignment:

  ```vhdl
  signal delay  : natural range 0 to 1000 := 0;   -- delay  + 1 = 1001
  signal number : natural range 0 to 7    := 0;   -- number + 1 = 8
  ```

  `delay <= delay + 1` runs before `if delay >= 1000`, so at 1000 the right-hand
  side is out of range; `number <= number + 1` is out of range at 7 even though the
  `if number >= 7` arm assigns 0 straight after. Measured: a testbench clocking the
  handout at 100 MHz dies with `ghdl:error: bound check failure at sevseg.vhd:19`
  after 10 us, and the app reports only `Simulation exited unexpectedly.` - the pane
  says nothing about a range. In board mode as printed it never gets that far
  (the clock is held at 0), so this is exactly the failure a student hits the moment
  they rename `clk` to `CLK100MHZ` and think they are done. T1 must not ship this
  shape: test the counter before incrementing (`if delay = 1000 then … else
  delay <= delay + 1`), which runs to the end - verified for 400 us, cycling
  1..8 with `AN` walking `01111111 → 11111110`.
- **`sevseg2` is not a binary-to-BCD converter.** It is a 4-bit BCD to 7-segment
  decoder plus a one-hot digit select, and the page titles it "Program Binary to
  BCD". Name the example for what it does, or T1 ships a misnamed card.
- **`sevseg2` blanks zero and nine.** Its first `case` has no `"0000"` arm, so 0
  falls to `when others => "1111111"` (all segments off), and 9 does too. Measured:
  `BCD 0 -> seg=1111111 an=11111111`, `BCD 9 -> seg=1111111 an=11111111`; renamed
  onto the board with `SW = 0` the whole pane stays idle for the same reason. A
  student who types the sheet gets a display that cannot show 0. The example carries
  the missing arms.
- **`sevseg3` counts on the raw clock.** No divider, so a press at 100 MHz spans
  millions of rising edges and the count races to 9 and wraps. The edge detector
  itself is right - a 100 ns press steps exactly once, up `1→2→3`, down `3→2→1` - so
  the fix is to run that detector on `CLOCK_500Hz`, as `keyCounter7Seg.vhdl` does.
- **`sevseg_fsm` refreshes too slowly to stay lit.** Its tick is `clkdiv = 0` on a
  24-bit counter, which at 100 MHz is one digit per 167.77 ms - measured as
  `AN` stepping every 167 772 175 000 000 fs. A digit goes dark after
  `DISPLAY_PERSIST_MS` = 75 ms (`server/src/engines/boardTiming.ts:55`), so the pane
  can only ever show one lit digit at a time, and a full frame takes 1.34 s. T2
  should clock the same FSM from `CLOCK_500Hz` and drop `clkdiv` entirely.
  Note also the cost: that 100 MHz run took 660 s of wall clock for 0.7 s of
  simulated time, which is why the paced clock is not just tidier but the only way
  a lab session stays usable.
- **`TrafficLightFSM` says "5 detik" and means 0.5 s.** `counter = 50000000` at
  100 MHz is half a second. Under `CLOCK_500Hz` pacing no divider is needed at all,
  which is what T2 does.

### What the adaptation looks like when it works

Both Bab 5 designs were rewritten in the board's names and driven through the real
backend on `nexys-a7`, which is the shape T1 should produce:

- **The counter** (`CLOCK_500Hz`, `BTNC` up, `BTNU` reset, one digit on `AN`):
  presses step the display `0 → 1 → 2 → 3 → 4` and `BTNU` returns it to `0`.
  Clocking it from `CLOCK_500Hz` is what makes one press one step; the handout's
  edge detector is kept as printed.
- **The decoder** (`SW(3 downto 0)` in, one digit out): `SW` = 0…9 shows `0`…`9`,
  and 10…15 show blank via `when others`. Adding the two missing arms is the only
  change from the sheet, and it is the difference between a display that shows 0 and
  one that cannot.

Two things a ticket must not forget, both learned by driving this. `STIM`'s button
field is written most-significant bit first (`boardShape.ts`, "each field bit N−1
first"), so the character on the **right** is the first button in `boardBindings`
order: `00001` is `BTNC` and `00010` is `BTNU` on Nexys A7, and `10000` is `BTND`.
The shipped `keyCounter7Seg.vhdl` confirms it - `00001` steps `00 → 10 → 20 → 30` and
`00010` returns it to `00`. And a press needs a release before the next press, since
both counters step on the edge.

### What is *not* wrong

Checked, so a later ticket does not "fix" it:

- **Bab 7's arithmetic is correct.** A truth-table run of the site's own sources
  matched every case: adder 128/128 (`cout` is the fourth bit), subtractor 128/128
  (`bout`), multiplier 128/128, comparator 128/128, and the ALU 128/128 across all
  four opcodes and both carry values. T3 can assert exact bits.
- **`comparator_3bit` compiles with only `STD_LOGIC_1164`.** `a > b` on
  `std_logic_vector` is legal in VHDL-2008, which defines relational operators on
  arrays of discrete types. `--std=08` is load-bearing for Bab 7, not cosmetic.
- **T3's "opcode on the top three switches" is right.** `sel` is 2 bits and `c` is a
  separate 1-bit carry/borrow input: two switches for the opcode, one for `c`.

## Merge first

Two pushed branches are ahead of `main` and nothing else can be trusted before
they land. Merge them before T1 and do not re-implement either. Each has two
commits on top of its first (see the rows); the branch tip is what merges.

| Branch | What it fixes |
|---|---|
| `acsl/ghdl-compat` (`739e5e6`) | ACSL handout code that imports `ieee.std_logic_arith`, `std_logic_unsigned` or `std_logic_signed` does not analyse on `main`: `GHDL_STANDARD` there is a bare `--std=08` (`server/src/engines/ghdlEngine.ts:29`) and GHDL wants `-fsynopsys` at `-a`, `-e` *and* `-r`. The branch replaces that constant with `GHDL_OPTIONS` carrying the flag and pins it in `integration/synopsysPackages.test.ts` — verified on this machine's bundled GHDL 6.0.0, 2/2 pass. Without it, every practical sheet has to be edited by the student first, which defeats the lab. Its second commit (`739e5e6`) names the flag in the docs that list the backend's GHDL commands: `editor_diagnostics_implementation_plan.md` § 2.6 and Appendix A, `editor_diagnostics_improvement_plan.md` § 1, `plugin_batch_implementation_plan.md` § 2 and § 5. |
| `acsl/verilog-include-cycle` (`c74494a`) | A circular `` `include `` is only found by Icarus exhausting its descriptors, so the run dies on the 30 s compile timeout with no message. The branch finds the cycle in `server/src/verilog/includes.ts` before any compiler starts and reports file, line and loop. Its second commit (`f3788fe`) stops it counting an `` `include `` behind an `ifdef`/`ifndef`/`if` as an edge: a false guard makes the cycle legal (Icarus 13.0 compiles it in 0.06–0.14 s), so counting it rejected working code; the third (`c74494a`) replaces the one-run 59 ms figure with that range. Verified through the backend on this machine: the guarded cycle reaches `READY`, an unguarded one is an `analyze` error naming `top2.v → b.vh → top2.v` in 9–12 ms. |

## Ready to start

| # | Branch | What | Done when |
|---|---|---|---|
| T1 | `acsl/seven-seg-examples` | Bab 5's two practical designs (PRD Phase 4 tasks 3-4): the up/down counter (`sevseg3`) and the BCD to 7-segment decoder (`sevseg2` - the site calls it "binary to BCD"; see "The handouts"). Both drive a display, so each needs the built-in pair in Default names (`HEX0_N`/`HEX1_N`, independent) **and** a Nexys A7 file using `CA..CG` + `DP` + `AN`, card `usesHex: true`. `src/components/workbench/boardExamples/nexys-a7/vhdl/keyCounter7Seg.vhdl` is the pattern: segment table, `CLOCK_500Hz` digit scan, `BTNC`/`BTNU`. Two handout defects to fix rather than copy: `sevseg2` has no `"0000"` or `"1001"` arm (0 and 9 show blank) and `sevseg3` counts on the raw clock. | On the Nexys A7 board both examples load from the Examples pane; the counter steps on `BTNC` and resets on `BTNU`; the digits shown equal the binary value on the switches; and a test pins two digits of each - a design pair in `server/src/testSupport/shapeDesigns.ts` driven through the `nexys-a7` case in `integration/boardShapes.test.ts`. |
| T2 | `acsl/traffic-light` | Bab 6's FSM (PRD § 5, Phase 4 tasks 5-7). LED-only output, `LED0..2` = red, amber, green, each state held long enough to watch, clocked from `CLOCK_500Hz` so no divider is needed - the handout's own divider is 50 000 000 cycles, half a second, despite its "5 detik" comment. Because the rename is inert on Nexys A7 this still needs a `boardExamples/nexys-a7/` file (`LED` there, not `LEDR`), card gated like T1. Declare the states so a waveform can name them: Verilog `localparam` groups (`src/components/waveform/verilogStates.ts` reads `localparam` only, never `parameter`), or a VHDL enumeration, which GHW carries by name. Note that **only a batch run has a waveform** - `boardPlan` (`ghdlEngine.ts:99`, `verilogEngine.ts:143`) sets no `wave` - so the named states are visible in a testbench run, and in board mode the three LEDs are the whole observation. | Red → green → amber → red at roughly 1 s a state on the LEDs; the same file run as a batch run names its states in the waveform; a scenario test drives one full cycle. |
| T3 | `acsl/alu-examples` | Bab 7's eight designs (PRD Phase 6): half adder, full adder, 3-bit adder, full subtractor, 3-bit subtractor, 3-bit multiplier, 3-bit comparator, ALU. Operands from `SW`, result and carry/borrow/compare on `LED`, the ALU's 2-bit opcode plus its separate 1-bit carry/borrow input on switches. Built-in pair plus a Nexys A7 file each, same reason as T2. The handout arithmetic is already verified case by case (see "The handouts"), so an example that disagrees with a truth table is the port's fault, not the sheet's. **No visualizer UI** - see "Not tickets". | For each design, a scenario test drives a set of operands and asserts the exact `STATE` bits; a swapped operand order or a dropped carry fails it. |

## Needs something this repository does not have

| # | Branch | What | Needs |
|---|---|---|---|
| T4 | `acsl/nexys-lab-profile` | **Nothing to build.** `nexys-a7` already covers both of the lab's boards; the measurements are in "Already there" below. A `nexys4` entry in `builtinBoards.json` would buy a student nothing the existing warning does not (YAGNI). | Only the silkscreen on the lab's second board: "Nexys 4 DDR" closes this with no code. A rev B reopens it *only* if a handout spells its ports the rev-B way, or if the lab flashes real boards and wants the pane's "Board definitions" link to point at an XDC whose pins match. |
| T5 | `acsl/deploy` | `docker/`, `nginx.conf` and `docs/HOSTING*.md` against the real domain (PRD says `fpga.acsl.my.id`; nothing in the repo names it yet), sized for a lab. | A host |

## Already there (do not re-ticket)

Evidence is a passing suite or a file, not a claim.

| Bab | State |
|---|---|
| - | The lab's two boards need one entry between them. Nexys 4 DDR *is* the Nexys A7 under its old name - Digilent's two master XDCs agree on all 55 basic-I/O pins (`CLK100MHZ` E3, `SW[0]` J15, `LED[0]` H17, `CA` T10, `AN[0]` J17, `BTNC` N17, `CPU_RESETN` C12) - and the -100T boards carry the same part, `XC7A100T-1CSG324C`: Artix-7, `CSG324`, speed `-1`, which is what the lab selects in Vivado either way (an A7-50T is `XC7A50T-1CSG324C`, same package and speed). The original Nexys 4 (rev B) has the same components (16 `SW`, 16 `LED`, five buttons, 8-digit display, 100 MHz) on *different pins*, and Digilent's suggested names for them differ too (`clk`, `sw`, `led`, `seg[6:0]`, `dp`, `an[7:0]`, `btnC`, `btnCpuReset`). Measured on `nexys-a7`, such a design binds `sw`, `led`, `an`, `dp` and all five `btnC/U/L/R/D` (matching is case-insensitive) and is warned by name on exactly three - `clk` (wants `CLK100MHZ`), `seg` (wants `CA..CG`), `btnCpuReset` (wants `CPU_RESETN`) - so its pane works after three renames. Pins and part never matter to this app: it simulates, it does not build a bitstream. |
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
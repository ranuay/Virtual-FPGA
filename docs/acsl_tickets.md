# ACSL tickets

The work left between here and a lab the ACSL course can use. `PRD.md` is the
specification; this file is only the order, so two agents (or two Mondays) never
edit the same file at once.

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

## Ready to start

| # | Branch | What | Done when |
|---|---|---|---|
| T1 | `acsl/uart-terminal` | Virtual serial terminal (PRD Phase 5 tasks 3-7). Most of it is written and unit-tested already, just not wired in: `docs/impl_files_for_plugins/ts/pluginLine.ts` (parse and route `@@HDLB` lines, the `PLUGIN` frame), `pluginCatalog.ts` and `uartPayload.ts`. The sender side is `docs/impl_files_for_plugins/vhdl/uart_monitor.vhd` plus `hdlb_pkg.vhd`, which already emit `@@HDLB uart <name> <t_ns> <hh>`. The ticket is the wiring: move those three modules to their intended homes (`server/src/pluginLine.ts`, `server/src/pluginCatalog.ts`, `src/components/workbench/plugins/uart/`), analyse the plugin library before the student's files, forward a `PLUGIN` frame over the socket, and render the pane. Do not write a second UART. | A board design that sends 'A' on `BTNC` shows `A` in the pane, at 9600 and 115200 baud, and the test that pins it fails without the wiring. |
| T2 | `acsl/ldr-pmod` | Virtual LDR (a slider) and the Pmod role it needs (PRD Phase 5 tasks 1-2): one new optional role in `src/boards/types.ts`, its mirror in `server/src/engines/boardPorts.ts`, and the `BOARD` frame that carries it. | Setting the LDR changes a value the design reads; a board file that has no LDR still loads and runs. |

T1 and T2 both touch `src/boards/types.ts` and `server/src/engines/boardPorts.ts`
only if T2 lands first; they are otherwise independent. Run them one at a time on
these two files, or take `worktree`s and merge T2 first.

## Needs something this repository does not have

| # | Branch | What | Needs |
|---|---|---|---|
| T3 | `acsl/alu-visualizer` | Operands, result, carry and comparison bits from the running design rather than inferred from the LEDs (PRD Phase 6). `STATE` today carries board outputs only - LEDs, then display 0 … D-1 (`server/src/engines/boardShape.ts:58`) - so this ticket starts by deciding how a value that is not a board port reaches the pane. It may turn out to need no protocol change at all, if the T1 reader can serve the second consumer. | T1, to know whether the reader is enough |
| T4 | `acsl/nexys-lab-profile` | Check `nexys-a7` against the lab's own hardware and handouts (PRD § 4: master XDC, board reference manual, practical source, the hardware in the lab) and record what differs. | A human with the lab board and the handouts. Do not guess a pinout. |
| T5 | `acsl/deploy` | `docker/`, `nginx.conf` and `docs/HOSTING*.md` against the real domain (PRD says `fpga.acsl.my.id`; nothing in the repo names it yet), sized for a lab. | T1, and a host |

## Already there (do not re-ticket)

Evidence is a passing suite or a file, not a claim.

| PRD phase | State |
|---|---|
| 1 - Foundation | ACSL handout code using `ieee.std_logic_arith`, `std_logic_unsigned`, `std_logic_signed` runs unmodified: `-fsynopsys` on `-a`, `-e` and `-r` from `GHDL_OPTIONS` (`server/src/ghdl.ts`), pinned by `integration/synopsysPackages.test.ts`. A circular `` `include `` is reported before Icarus hangs on it (`server/src/verilog/includes.ts`). |
| 2 - Nexys A7 board | `nexys-a7` in `src/boards/builtinBoards.json`: 16 SW/LED, 5 buttons plus `CPU_RESETN` (active-low), 8-digit multiplexed display with `DP`, 100 MHz; `integration/boards.test.ts` 9/9. What is left of Phase 2 is T4's verification, not the board itself. |
| 3 - Bab 1-3 | VHDL and Verilog both run on real simulators, waveform and live board included (`integration/crossLanguage.test.ts`); examples per board in `boardExamples/<board id>/`. |
| 4 - Bab 5, 6 | Seven-segment, pushbuttons and the counter/BCD/FSM/traffic-light shapes need no new code: board I/O plus the waveform. Verilog state names are named in the waveform (`waveform/verilogStates.ts`); VHDL enumerations come through GHW. |

## Not tickets

- PuTTY integration (PRD Phase 5 task 9) is optional in the PRD, and T1 answers
  the same need from the browser. Revisit only if a handout insists on a real
  serial port.
- The plugin system (`docs/plugin_batch_implementation_plan.md`, id `rs232`) is
  designed, not built. T1 wires in the three modules already written under
  `docs/impl_files_for_plugins/ts/`, but not the rest of that design: a settings
  toggle, a plugin catalogue shipped with the app, and I2C/SPI/1-Wire. Those are
  later plugins, not this ticket.

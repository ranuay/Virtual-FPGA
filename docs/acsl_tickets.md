# ACSL tickets

The work left between here and a lab the ACSL course can use. `PRD.md` is the
specification; this file is only the order, so two agents (or two Mondays) never
edit the same file at once.

**Scope is locked (PRD § 1.5): VHDL and Nexys A7 only.** No ticket below adds
another board or new Verilog-only support; existing boards and Icarus keep
working and are not allowed to break, but they are not targets. A ticket that
needs either must say why against § 1.5 before it starts.

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

T1 (virtual serial terminal, PRD Phase 5 tasks 3-7) does not exist on `main`, and
no branch in this fork carries it - the plugin work is on `upstream/impl_plugin`,
in `server/src/pluginLine.ts`, `server/src/pluginCatalog.ts`,
`server/src/engines/pluginLibrary.ts`, `server/plugins/vhdl/` and
`src/components/workbench/plugins/`, committed as `ee63220` and `ffc3cbf`. T1 is
therefore a port, not a wiring job: take upstream's files, or let the upstream
branch come in by merge, and check each of our workbench modules against it -
this fork has moved since. One thing upstream settles already: `uartPayload.ts`
is not needed, the pane formats the payload itself.

Observed end to end on 2026-11-13, against *this* fork's backend rather than
upstream's: a design driving `uart_monitor` answered `PLUGIN uart mon0 179265` /
`00 FE`, and the browser showed it in a `UART MON0` pane. That run used the
working-tree copy of `server/src/pluginLine.ts` and friends, which differs from
`upstream/impl_plugin`'s copy (`server/src/library.ts` is not upstream's at all),
so the pair still has to be reconciled before either is called done.


| #   | Branch          | What                                                                                                                                                                                                                | Done when                                                                                            |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| T2  | `acsl/ldr-pmod` | Virtual LDR (a slider) and the Pmod role it needs (PRD Phase 5 tasks 1-2): one new optional role in `src/boards/types.ts`, its mirror in `server/src/engines/boardPorts.ts`, and the `BOARD` frame that carries it. | Setting the LDR changes a value the design reads; a board file that has no LDR still loads and runs. |
| T9  | `acsl/multifile-set-top` | Multi-file VHDL hierarchy and **Set as Top** for Bab 7, whose handout is eight files: the project holds several `.vhd` files at once and marks one entity as the top; changing the top invalidates the Design Flow (`outdated`, board `stale`, PRD § 7.4); GHDL compiles the dependencies in order and leaves `*_tb.vhd` out in Board Flow; I/O Planning and `hdl_board_tb` take their ports from the top alone. | `boardExamples/bab7_alu/`'s eight files compile as one hierarchy, the top's ports are the ones I/O Planning places, and the run drives the virtual Nexys A7. |


T1 and T2 both touch `src/boards/types.ts` and `server/src/engines/boardPorts.ts`
only if T2 lands first; they are otherwise independent. Run them one at a time on
these two files, or take `worktree`s and merge T2 first.

## Needs something this repository does not have

## ACSL Custom Additions (Append to Ticket Queue)

### Ticket: `acsl/board-warmup-state`

- **Target Files:** `src/boards/*`, komponen visualisasi Nexys A7, state Hardware Manager.

- **Requirement (§ 4.6):**

  - Sebelum `Program Device` (saat board menyala / `connected`), visual board Nexys A7 menampilkan mode *warming-up* (seluruh LED `LD0`–`LD15`, RGB, dan 7-segment menyala).

  - Tepat setelah `Program Device` berhasil (`programmed`), lampu *warming-up* padam dan hanya menyisakan indikator `POWER` menyala default sebelum sinyal output VHDL mengambil alih.

- **Acceptance:** State `unconnected` -&gt; `connected` (\*warming-up\* aktif) -&gt; `programmed` (\*warming-up\* mati, `POWER` on, output VHDL aktif) teruji di unit test dan runtime UI.

### Ticket: `acsl/vivado-flow-ui`

- **Target Files:** Workbench shell / Flow Navigator, panel I/O Planning, Hardware Manager.

- **Requirement (§ 7 &amp; § 11):**

  - Susun navigasi Flow Navigator mengikuti alur Vivado 2020.2 (`docs/vivado_ref.png`), disederhanakan hanya untuk langkah yang dibutuhkan praktikum:

    1. `RTL ANALYSIS` -&gt; `Open Elaborated Design` -&gt; `Schematic` (untuk Bab 3 &amp; Bab 7)

    2. `SYNTHESIS` -&gt; `Run Synthesis` -&gt; `Open Synthesized Design` (I/O Planning pin Nexys A7 `csg324`)

    3. `IMPLEMENTATION` -&gt; `Run Implementation` (imitative/edukatif + cek kelengkapan pin)

    4. `PROGRAM AND DEBUG` -&gt; `Generate Bitstream` (imitative/edukatif + kunci constraint)

    5. `Open Hardware Manager` -&gt; `Open Target` -&gt; `Program Device`

  - Sembunyikan/nonaktifkan menu Vivado yang tidak relevan dengan modul ACSL agar UI tetap bersih.

- **Acceptance:** Praktikan wajib melewati urutan di atas (atau menerima dialog konfirmasi otomatis saat melompati langkah sesuai § 7.5).

### Ticket: `acsl/curriculum-fixtures-e2e`

- **Target Files:** `fixtures/acsl/*`, `server/src/integration/*`.

- **Requirement (§ 1.5, § 3, § 9):**

  - Seluruh kode `.vhd` praktikum dari [`fpga.acsl.my.id`](http://fpga.acsl.my.id) (Bab 1–7, mengecualikan integrasi PuTTY eksternal Bab 4) berhasil dikompilasi GHDL (`--std=08 -fsynopsys`) tanpa modifikasi source code praktikum dan berjalan di Virtual Nexys A7.

- **Acceptance:** Seluruh fixture di `fixtures/acsl/` lulus test integrasi backend dari tahap Synthesis hingga eksekusi sinyal I/O.


| #   | Branch                   | What                                                                                                                                                                                                                                                                                                                                                                                                                              | Needs                                                                                                     |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| T3  | `acsl/alu-visualizer`    | Operands, result, carry and comparison bits from the running design rather than inferred from the LEDs (PRD Phase 6). `STATE` today carries board outputs only - LEDs, then display 0 … D-1 (`server/src/engines/boardShape.ts:58`) - so this ticket starts by deciding how a value that is not a board port reaches the pane. It may turn out to need no protocol change at all, if the T1 reader can serve the second consumer. | T1, to know whether the reader is enough                                                                  |
| T4  | `acsl/nexys-lab-profile` | Check `nexys-a7` against the lab's own hardware and handouts (PRD § 4: master XDC, board reference manual, practical source, the hardware in the lab) and record what differs.                                                                                                                                                                                                                                                    | A human with the lab board and the handouts. Do not guess a pinout.                                       |
| T5  | `acsl/deploy`            | `docker/`, `nginx.conf` and `docs/HOSTING*.md` against the real domain (PRD says `fpga.acsl.my.id`; nothing in the repo names it yet), sized for a lab.                                                                                                                                                                                                                                                                           | T1, and a host                                                                                            |
| T6  | acsl/board-warmup-state  | Nexys A7 power-on *warming-up* visual (PRD § 4.6): when board state is `connected` (powered/Auto Connect before `Program Device`), all user LEDs (`LD0`–`LD15`), RGB LEDs, and 7-segment digits light up as a hardware self-test; once `Program Device` succeeds (`programmed`), self-test lights turn off leaving only the `POWER` LED lit by default while VHDL outputs drive the mapped pins.                                  | `acsl/design-flow` merged to `main` first (touches board state / Hardware Manager).                       |
| T7  | acsl/rtl-schematic       | **Done** — see "Already there", row 5. RTL Schematic viewer for Bab 3 &amp; Bab 7 (`RTL ANALYSIS -> Open Elaborated Design -> Schematic`). | — |
| T8  | acsl/vivado-ui-polish    | Align Flow Navigator layout, step grouping (`RTL ANALYSIS`, `SYNTHESIS`, `IMPLEMENTATION`, `PROGRAM AND DEBUG`), and minimal workspace panels with Vivado 2020.2 (`docs/vivado_ref.png`), hiding non-ACSL upstream UI clutter while preserving existing functionality.                                                                                                                                                            | `acsl/design-flow` merged to `main` first.                                                                |


## Already there (do not re-ticket)

Evidence is a passing suite or a file, not a claim.


| PRD phase          | State                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 - Foundation     | ACSL handout code using `ieee.std_logic_arith`, `std_logic_unsigned`, `std_logic_signed` runs unmodified: `-fsynopsys` on `-a`, `-e` and `-r` from `GHDL_OPTIONS` (`server/src/ghdl.ts`), pinned by `integration/synopsysPackages.test.ts`. A circular ``include` is reported before Icarus hangs on it (`server/src/verilog/includes.ts`). |
| 2 - Nexys A7 board | `nexys-a7` in `src/boards/builtinBoards.json`: 16 SW/LED, 5 buttons plus `CPU_RESETN` (active-low), 8-digit multiplexed display with `DP`, 100 MHz; `integration/boards.test.ts` 9/9. What is left of Phase 2 is T4's verification, not the board itself.                                                                                   |
| 3 - Bab 1-3        | VHDL and Verilog both run on real simulators, waveform and live board included (`integration/crossLanguage.test.ts`); examples per board in `boardExamples/<board id>/`.                                                                                                                                                                    |
| 4 - Bab 5, 6       | Seven-segment, pushbuttons and the counter/BCD/FSM/traffic-light shapes need no new code: board I/O plus the waveform. Verilog state names are named in the waveform (`waveform/verilogStates.ts`); VHDL enumerations come through GHW.                                                                                                     |
| 5 - RTL schematic  | `RTL ANALYSIS -> Open Elaborated Design -> Schematic` (T7) draws the elaborated design from GHDL's VHDL netlist (`server/src/engines/netlist.ts`, `ghdl synth --out=vhdl`), one block per source assignment with its `file:line`; `src/components/schematic/` lays it out and `DesignFlowPanel` draws the heading. Verified against GHDL 6.0.0 on the Bab 5 counter: 16 blocks, 19 wires, provenance intact. |


## Not tickets

- PuTTY integration (PRD Phase 5 task 9) is optional in the PRD, and T1 answers
the same need from the browser. Revisit only if a handout insists on a real
serial port.
- The plugin system (`docs/plugin_batch_implementation_plan.md`, id `rs232`) is
designed, not built. T1 wires in the three modules already written under
`docs/impl_files_for_plugins/ts/`, but not the rest of that design: a settings
toggle, a plugin catalogue shipped with the app, and I2C/SPI/1-Wire. Those are
later plugins, not this ticket.
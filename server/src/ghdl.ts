// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * Spawning and managing GHDL child processes.
 * ../../docs/ghdl_implementation_plan.md § 7.4 / § 11 (security).
 *
 * `spawn(cmd, argsArray, { cwd })` only, everywhere — never a shell
 * string. No source content, filename, or generic value is ever
 * concatenated into a command line. Do not "simplify" this to `exec`.
 */

import { spawn } from 'node:child_process';
import { createBatchHandle, createRunHandle, type BatchHandle, type RunHandle } from './runtime.js';
import { resolveGhdlExe } from './ghdlPath.js';

/**
 * Which GHDL to run. `'ghdl'` means "whatever is on PATH", which is what
 * every non-desktop deployment wants and what `GHDL_DIR` / `GHDL_EXE`
 * let an operator override. The packaged Windows app is the case that
 * needs more: it ships its own GHDL under `resources/ghdl/` and must not
 * depend on the student having installed one, so Electron passes that
 * directory to `startBackend()`, which calls `setGhdlExe()` before
 * anything can spawn.
 */
let ghdlExe = resolveGhdlExe(process.env);

export function setGhdlExe(path: string): void {
  ghdlExe = path;
}

/** The resolved executable. */
export function getGhdlExe(): string {
  return ghdlExe;
}

/**
 * The options every GHDL command gets, in one place because they have to agree on all
 * three stages. `--std=08` is the language. `-fsynopsys` makes the legacy
 * `ieee.std_logic_arith` / `std_logic_unsigned` / `std_logic_signed` packages that ACSL
 * lab code is written against available at all; without it GHDL refuses the file that
 * imports them ("use of synopsys package "std_logic_arith" needs the -fsynopsys
 * option"). Analyse, elaborate and run each re-read the sources, so the flag is needed
 * on all three — measured on GHDL 5.0.1: with `-a` alone the design analyses and then
 * fails to elaborate and to run with that same message.
 *
 * It does not change GHDL's error text for ordinary mistakes, and a design that does
 * not use the packages is unaffected (verified on 5.0.1 against the diagnostic fixtures
 * and VHDL-2008 features). Do not add it to `--version`.
 */
export const GHDL_OPTIONS: readonly string[] = ['--std=08', '-fsynopsys'];

/**
 * Starts the persistent, free-running simulation — Candidate A
 * (§ 5.4.1). Not awaited to completion: the process runs until `kill()`
 * is called (Stop/Reset/session teardown), which is the whole point of
 * this architecture over re-simulating from t=0.
 */
export function startPersistentRun(
  cwd: string,
  entityName: string,
  inputFile: string,
  outputFile: string,
  pollIntervalNs: number,
  minDwellNs: number,
  heartbeatFile: string,
  pacingFile: string,
): RunHandle {
  const child = spawn(
    ghdlExe,
    [
      '-r',
      ...GHDL_OPTIONS,
      entityName,
      `-ginput_file=${inputFile}`,
      `-goutput_file=${outputFile}`,
      `-gpoll_interval_ns=${pollIntervalNs}`,
      `-gmin_dwell_ns=${minDwellNs}`,
      `-gheartbeat_file=${heartbeatFile}`,
      // Omitted rather than passed empty when there is no FIFO (Windows,
      // which paces through stdin instead — see session.ts's PACING):
      // `-gpacing_file=` with no value is a hard "missing value in generic
      // override option" from GHDL, not an empty string. The generic's own
      // declared default in tbTemplate.ts is already `""`, which is exactly
      // the "no FIFO" state.
      ...(pacingFile ? [`-gpacing_file=${pacingFile}`] : []),
    ],
    { cwd },
  );

  return createRunHandle(child);
}

/**
 * Runs a design directly — `ghdl -r <entityName>`, no generated wrapper,
 * no board polling. For a genuinely portless entity (`session.ts` only
 * calls this when the resolved top declares zero ports at all): a design
 * with real board ports still gets `startPersistentRun`'s wrapper, since
 * *something* has to supply `CLOCK_50`/`SW`/`KEY` for it to do anything.
 * A portless entity supplies its own stimuli (the classic self-contained
 * testbench shape — this file's own `stim_proc`, say), so wrapping it in
 * anything would be redundant at best and an elaboration error at worst.
 *
 * Bounded by `timeoutMs`, unlike the persistent run: this process is
 * expected to reach quiescence and exit on its own, and without our own
 * infinite polling loop keeping it alive, a design bug (an unconditional
 * loop with no `wait`) has nothing else to save it from a hang.
 */
export function runBatch(
  cwd: string,
  entityName: string,
  onOutput: (line: string) => void,
  timeoutMs: number,
  runOptions: readonly string[] = [],
): BatchHandle {
  // Run options such as `--wave=` follow the entity name: they belong to the simulation, not to GHDL.
  const child = spawn(ghdlExe, ['-r', ...GHDL_OPTIONS, entityName, ...runOptions], { cwd });
  return createBatchHandle(child, onOutput, timeoutMs);
}

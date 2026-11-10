// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * The Vivado-style design flow as the panel shows it (PRD.md § 7.2–§ 7.4): the
 * steps, the statuses, and the `FLOW` frame the backend sends after every change.
 *
 * Mirrors server/src/engines/designFlow.ts independently (a separate npm package,
 * in the browser, cannot import that file) — keep the step order and the
 * prerequisite table in sync by hand if either changes.
 */

/** PRD.md § 7.2, in order. */
export type FlowStep = 'synthesis' | 'ioPlanning' | 'implement' | 'bitstream' | 'hardware' | 'connect' | 'program';

export const FLOW_STEPS: readonly FlowStep[] = ['synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware', 'connect', 'program'];

/** The menu names of PRD.md § 7.2, as the row shows them. */
export const STEP_LABEL: Readonly<Record<FlowStep, string>> = {
  synthesis: 'Run Synthesis',
  ioPlanning: 'I/O Planning',
  implement: 'Run Implementation',
  bitstream: 'Generate Bitstream',
  hardware: 'Open Hardware Manager',
  connect: 'Open Target, Auto Connect',
  program: 'Program Device',
};

/** PRD.md § 7.3. */
export type StepStatus = 'not_run' | 'running' | 'done' | 'failed' | 'outdated';

export const STATUS_TEXT: Readonly<Record<StepStatus, string>> = {
  not_run: 'Not run',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  outdated: 'Outdated: an input changed',
};

const STATUSES: readonly string[] = ['not_run', 'running', 'done', 'failed', 'outdated'];

/** PRD.md § 4.6: what the virtual board shows. */
export type BoardStage = 'unconnected' | 'connected' | 'programmed' | 'stale';

export const BOARD_STAGE_TEXT: Readonly<Record<BoardStage, string>> = {
  unconnected: 'Board not connected',
  connected: 'Board connected',
  programmed: 'Board programmed',
  stale: 'Board running a stale bitstream',
};

const BOARD_STAGES: readonly string[] = ['unconnected', 'connected', 'programmed', 'stale'];

/** One row of the panel. */
export interface FlowStepRow {
  readonly step: FlowStep;
  readonly status: StepStatus;
  /** Implementation and Generate Bitstream are simulated; the row badges them (§ 7.1.6). */
  readonly educational: boolean;
}

/** One row of the I/O Planning table: a design port and the board port it drives. */
export interface FlowWirePort {
  readonly name: string;
  readonly direction: string;
  /** Bits; absent when the port reader could not tell. */
  readonly width?: number;
  /** The board port I/O Planning wrote as this port's constraint (§ 7.6). */
  readonly constraint?: string;
  /** The board port the student pinned it to, which I/O Planning has not written yet. */
  readonly pin?: string;
  /** When the pin covers a word (the display's segments): the board ports its bits are, least significant first. */
  readonly bits?: readonly string[];
  /** The board ports this port may be pinned to (§ 7.6's direction and width rules). */
  readonly choices?: readonly string[];
}

/** The `FLOW` frame's body: every status, the board stage and the constraint. */
export interface FlowWire {
  readonly steps: readonly FlowStepRow[];
  readonly board: BoardStage;
  readonly ports: readonly FlowWirePort[];
  readonly canProgram: boolean;
}

/** PRD.md § 7.4's prerequisite table. */
const PREREQUISITES: Readonly<Record<FlowStep, readonly FlowStep[]>> = {
  synthesis: [],
  ioPlanning: ['synthesis'],
  implement: ['synthesis'],
  bitstream: ['implement'],
  hardware: [],
  connect: ['hardware'],
  program: ['bitstream', 'connect'],
};

const isStep = (value: unknown): value is FlowStep => (FLOW_STEPS as readonly unknown[]).includes(value);

const isPort = (value: unknown): value is FlowWirePort =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as FlowWirePort).name === 'string' &&
  typeof (value as FlowWirePort).direction === 'string';

/**
 * `FLOW`'s body, or undefined when it is not one. A step the body leaves out is
 * `not_run`, so a backend that grows a step the panel already lists still renders.
 */
export function parseFlow(body: string): FlowWire | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const wire = raw as Partial<FlowWire>;
  if (!BOARD_STAGES.includes(wire.board as string)) return undefined;
  if (!Array.isArray(wire.steps) || !Array.isArray(wire.ports)) return undefined;

  const sent = wire.steps.filter(
    (entry): entry is FlowStepRow => isStep((entry as FlowStepRow | undefined)?.step) && STATUSES.includes((entry as FlowStepRow).status),
  );
  const statusOf = (step: FlowStep): StepStatus => sent.find((entry) => entry.step === step)?.status ?? 'not_run';
  return {
    steps: FLOW_STEPS.map((step) => ({ step, status: statusOf(step), educational: step === 'implement' || step === 'bitstream' })),
    board: wire.board as BoardStage,
    ports: wire.ports.filter(isPort),
    canProgram: wire.canProgram === true,
  };
}

/**
 * The prerequisites of `step` that are not `done` — what the jump dialog offers to run.
 * Before the first `FLOW` frame nothing has run, so every prerequisite is missing: a
 * student whose first click is Generate Bitstream must still be asked (§ 7.5).
 */
export function unmetPrerequisites(flow: FlowWire | null, step: FlowStep): readonly FlowStep[] {
 if (flow === null) return PREREQUISITES[step];
 return PREREQUISITES[step].filter((needed) => flow.steps.find((entry) => entry.step === needed)?.status !== 'done');
}

/** Whether `step` may be clicked: a running step locks it, and Program Device needs its bitstream. */
export function canRun(flow: FlowWire, step: FlowStep): boolean {
  const status = flow.steps.find((entry) => entry.step === step)?.status;
  if (status === 'running') return false;
  return step === 'program' ? flow.canProgram : true;
}

// SPDX-License-Identifier: GPL-2.0-only
/**
 * The Vivado-style design flow's state machine (PRD.md § 7.3, § 7.4, § 7.5) —
 * pure functions over a plain state object. No simulator, no socket, no files:
 * that is what lets the rules be tested without GHDL, and what keeps the
 * sequence enforceable on the backend rather than only in the frontend
 * (PRD.md § 8.2: "Status Design Flow disimpan dan divalidasi di backend").
 *
 * The steps and their order are fixed by PRD.md § 7.2:
 *
 *   1 synthesis    analyze + elaborate (real)
 *   2 ioPlanning   pin assignment, written as a constraint (real)
 *   3 implement    educational simulation
 *   4 bitstream    educational simulation, then a constraint check
 *   5 hardware     opens the Hardware Manager panel (UI)
 *   6 connect      Auto Connect: the board becomes `connected`
 *   7 program      Program Device: the board becomes `programmed` (real effect)
 *
 * Steps 2 and 7 have no `running` state of their own: I/O Planning is a panel the
 * user edits, and Program Device is a run of the elaborated design. They are
 * `done` when their precondition holds and their result exists. Everything else
 * follows § 7.3's five statuses.
 */
import type { BoardIo } from './boardPorts.js';
import { pinChoices, pinTargets } from './ioPins.js';
import type { DesignPort } from './types.js';

/** The executable steps. `synthesis`…`program` are the seven rows of PRD.md § 7.2. */
export type FlowStep = 'synthesis' | 'ioPlanning' | 'implement' | 'bitstream' | 'hardware' | 'connect' | 'program';

/** PRD.md § 7.2, in order. */
export const FLOW_STEPS: readonly FlowStep[] = [
  'synthesis',
  'ioPlanning',
  'implement',
  'bitstream',
  'hardware',
  'connect',
  'program',
];

/** PRD.md § 7.3. */
export type StepStatus = 'not_run' | 'running' | 'done' | 'failed' | 'outdated';

/**
 * Which steps ran as a real simulator invocation, and which only show progress,
 * a log and an explanation (PRD.md § 7.1.3, § 7.1.6). The frontend renders a
 * "Simulasi edukatif" badge for the latter — a step must never look real when
 * it is not.
 */
export function isEducational(step: FlowStep): boolean {
  return step === 'implement' || step === 'bitstream';
}

/** PRD.md § 4.6: what the virtual board shows. */
export type BoardStage = 'unconnected' | 'connected' | 'programmed' | 'stale';

export interface FlowState {
  readonly statuses: Readonly<Record<FlowStep, StepStatus>>;
  readonly board: BoardStage;
}

export function initialFlow(): FlowState {
  const statuses = {} as Record<FlowStep, StepStatus>;
  for (const step of FLOW_STEPS) statuses[step] = 'not_run';
  return { statuses, board: 'unconnected' };
}

/** PRD.md § 7.4, "Prasyarat": what must be `done` before a step may run. */
const PREREQUISITES: Readonly<Record<FlowStep, readonly FlowStep[]>> = {
  synthesis: [],
  // The port list comes from a successful elaborate, so synthesis must be done.
  ioPlanning: ['synthesis'],
  implement: ['synthesis'],
  bitstream: ['implement'],
  // Vivado lets the Hardware Manager be opened at any time (§ 7.4).
  hardware: [],
  connect: ['hardware'],
  // § 7.4: a target connected and a bitstream done.
  program: ['bitstream', 'connect'],
};

/** The prerequisites of `step` that are not `done`, in flow order. */
export function unmetPrerequisites(state: FlowState, step: FlowStep): readonly FlowStep[] {
  return PREREQUISITES[step].filter((needed) => state.statuses[needed] !== 'done');
}

/**
 * What a request to run `step` means (PRD.md § 7.5). A step whose prerequisite is
 * missing either offers to run what is missing (`implement`, `bitstream` — the
 * dialogs of § 7.5), or is refused outright (`program`: its action is disabled
 * when no bitstream exists).
 */
export type StepRequest =
  | { readonly kind: 'run' }
  | { readonly kind: 'offer-missing'; readonly missing: readonly FlowStep[] }
  | { readonly kind: 'refuse'; readonly missing: readonly FlowStep[] };

export function requestStep(state: FlowState, step: FlowStep): StepRequest {
  if (state.statuses[step] === 'running') return { kind: 'refuse', missing: [] };
  const missing = unmetPrerequisites(state, step);
  if (missing.length === 0) return { kind: 'run' };
  // § 7.5: Program Device is disabled with no bitstream; every other jump is offered.
  if (step === 'program') return { kind: 'refuse', missing };
  return { kind: 'offer-missing', missing };
}

/**
 * The steps § 7.5 agrees to run, in flow order: every prerequisite `step` is
 * missing (transitively — Bitstream's Implementation needs Synthesis too), then `step`.
 */
export function planRun(state: FlowState, step: FlowStep): readonly FlowStep[] {
  const needed = new Set<FlowStep>();
  const collect = (candidate: FlowStep): void => {
    if (needed.has(candidate)) return;
    needed.add(candidate);
    for (const prerequisite of PREREQUISITES[candidate]) collect(prerequisite);
  };
  collect(step);
  return FLOW_STEPS.filter((candidate) => needed.has(candidate) && state.statuses[candidate] !== 'done');
}

const withStatus = (state: FlowState, step: FlowStep, status: StepStatus): FlowState => ({
  ...state,
  statuses: { ...state.statuses, [step]: status },
});

/** A step starts: `running` (PRD.md § 7.3 — buttons lock while a step runs). */
export function begin(state: FlowState, step: FlowStep): FlowState {
  return withStatus(state, step, 'running');
}

/**
 * A step finished. Programming is the only step that changes the board: success
 * makes it `programmed`, and the older stage (`connected`) is kept by § 4.6's
 * altitude — `programmed` implies connected, so a failure returns there.
 */
export function succeed(state: FlowState, step: FlowStep): FlowState {
  const next = withStatus(state, step, 'done');
  if (step === 'program') return { ...next, board: 'programmed' };
  if (step === 'connect') return { ...next, board: next.board === 'programmed' ? 'programmed' : 'connected' };
  return next;
}

/**
 * A step failed. `connect` failing leaves the board `unconnected`; a failed
 * `program` returns a previously programmed board to `connected` rather than
 * keeping a bitstream the design no longer matches.
 */
export function fail(state: FlowState, step: FlowStep): FlowState {
  const next = withStatus(state, step, 'failed');
  if (step === 'connect') return { ...next, board: 'unconnected' };
  if (step === 'program') return { ...next, board: next.board === 'programmed' ? 'connected' : next.board };
  return next;
}

/** What changed since the flow last ran (PRD.md § 7.4's invalidation table). */
export type InputChange = 'source' | 'constraint' | 'top';

const INVALIDATED_BY: Readonly<Record<InputChange, readonly FlowStep[]>> = {
  // A changed source invalidates everything downstream of synthesis.
  source: ['synthesis', 'ioPlanning', 'implement', 'bitstream'],
  // A pin change leaves synthesis alone (§ 7.4's stated simplification).
  constraint: ['implement', 'bitstream'],
  // A different top module changes the port list too, so I/O Planning goes with it.
  top: FLOW_STEPS,
};

/**
 * An input changed: the affected steps that are `done` become `outdated`, and a
 * programmed board becomes `stale` (§ 4.6: it keeps running the old bitstream, and
 * the UI says the design moved on). Steps that never ran, or failed, are left
 * alone — `not_run` already says they are not usable.
 */
export function invalidate(state: FlowState, change: InputChange): FlowState {
  const statuses = { ...state.statuses };
  for (const step of INVALIDATED_BY[change]) {
    if (statuses[step] === 'done') statuses[step] = 'outdated';
  }
  const board = state.board === 'programmed' ? 'stale' : state.board;
  return { statuses, board };
}

/**
 * Whether Program Device may be clicked right now. The dialogs of § 7.5 do not
 * apply here: a missing bitstream disables the action rather than offering it.
 */
export function canProgram(state: FlowState): boolean {
  return unmetPrerequisites(state, 'program').length === 0;
}

/** The steps the UI may offer as runnable, in flow order (§ 7.4's prerequisites met). */
export function runnableSteps(state: FlowState): readonly FlowStep[] {
  return FLOW_STEPS.filter((step) => unmetPrerequisites(state, step).length === 0);
}

/** One step as the flow panel shows it. */
export interface FlowWireStep {
  readonly step: FlowStep;
  readonly status: StepStatus;
  /** Implementation and Generate Bitstream are simulated: the panel badges them (§ 7.1.6). */
  readonly educational: boolean;
}

/** One row of the I/O Planning table: a design port and the board port it is assigned to. */
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

/** The `FLOW` frame's body (PRD.md § 7.3): everything the panel needs, in one place. */
export interface FlowWire {
  readonly steps: readonly FlowWireStep[];
  readonly board: BoardStage;
  readonly ports: readonly FlowWirePort[];
  readonly canProgram: boolean;
}

/** What the panel's port rows are derived from: the constraints I/O Planning wrote, and the board the pins are chosen on. */
export interface FlowWiring {
  /** What I/O Planning wrote, so a port without an entry is exactly the one Generate Bitstream's DRC refuses (§ 7.5). */
  readonly constraints: ReadonlyMap<string, string>;
  /** With `board`, each row lists the board ports it may be pinned to (§ 7.6). */
  readonly board?: BoardIo;
  /** The student's choices, which I/O Planning has not written yet. */
  readonly pins?: ReadonlyMap<string, string>;
}

/** The flow as the panel shows it, in one frame (§ 7.3). */
export function flowWire(state: FlowState, ports: readonly DesignPort[], wiring: FlowWiring): FlowWire {
  const { constraints, board, pins = new Map() } = wiring;
  const targets = new Map(board === undefined ? [] : pinTargets(board).map((choice) => [choice.key, choice]));
  return {
    steps: FLOW_STEPS.map((step) => ({ step, status: state.statuses[step], educational: isEducational(step) })),
    board: state.board,
    ports: ports.map((port) => {
      const constraint = constraints.get(port.name);
      const pinned = pins.get(port.name.toLowerCase());
      // The pin wins; without one, the constraint I/O Planning wrote names the same board port.
      const choice = targets.get(pinned ?? (constraint ?? '').toLowerCase());
      const pin = pinned === undefined ? undefined : (choice?.label ?? pinned);
      // A word pin's package pins are its bits', which the board lists one port at a time.
      const word = choice === undefined || choice.bits.length < 2 ? undefined : choice.bits.map((binding) => binding.name);
      const choices = board === undefined ? undefined : pinChoices(port, board).map((option) => option.label);
      return {
        name: port.name,
        direction: port.direction,
        width: port.width,
        ...(constraint === undefined ? {} : { constraint }),
        ...(pin === undefined ? {} : { pin }),
        ...(word === undefined ? {} : { bits: word }),
        ...(choices === undefined ? {} : { choices }),
      };
    }),
    canProgram: canProgram(state),
  };
}

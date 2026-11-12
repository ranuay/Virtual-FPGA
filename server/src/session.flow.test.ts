// SPDX-License-Identifier: GPL-2.0-only
/**
 * The design flow in a session (PRD.md § 7.3–7.5): the sequence is enforced on the
 * backend, a jump offers to run what is missing, and I/O Planning's constraint is what
 * Generate Bitstream's DRC checks.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { decodeBoardBody, encodeBoardBody } from './boardFrame.js';
import type { PrepareRequest, PrepareResult, RunPlan, SimEngine } from './engines/types.js';
import type { ServerFrame } from './protocol.js';
import { Session } from './session.js';
import { BOARD_FRAMES } from './testSupport/boards.js';

const FILES = [{ name: 'top.vhdl', content: 'entity top is end entity;' }];

const plan = (dir: string, ports: RunPlan['ports'] = DEFAULT_PORTS): RunPlan => ({
  mode: 'board',
  dir,
  runTarget: 'tb',
  timing: { pollIntervalNs: 1, minDwellNs: 1 },
  pacing: 'stdin',
  messages: [],
  ports,
});

const DEFAULT_PORTS = [
  { name: 'CLOCK_50', direction: 'in', width: 1 },
  { name: 'SW', direction: 'in', width: 10 },
  { name: 'LEDR', direction: 'out', width: 10 },
];

/** An engine that prepares successfully and starts nothing: the flow steps only prepare. */
function preparingEngine(ports: RunPlan['ports'] = DEFAULT_PORTS) {
  const prepared: PrepareRequest[] = [];
  const engine: SimEngine = {
    language: 'vhdl',
    prepare: (request: PrepareRequest): Promise<PrepareResult> => {
      prepared.push(request);
      return Promise.resolve({ ok: true, plan: plan(request.dir, ports) });
    },
    startBoardRun: () => ({ kill: () => {}, onExit: () => {}, onOutput: () => {}, grantPacing: () => {} }),
    startBatchRun: () => ({ kill: () => {}, done: new Promise(() => {}) }),
  };
  return { engine, prepared };
}

/** A session over `engine`, destroyed afterwards: its timers outlive the test otherwise. */
async function withFlow(engine: SimEngine, body: (session: Session, frames: ServerFrame[]) => Promise<void>): Promise<void> {
  const frames: ServerFrame[] = [];
  const session = new Session((frame) => frames.push(frame), () => engine);
  try {
    await body(session, frames);
  } finally {
    session.destroy();
  }
}

/** The last FLOW frame's body, decoded. */
function lastFlow(frames: readonly ServerFrame[]) {
  const flows = frames.filter((frame) => frame.verb === 'FLOW');
  const last = flows[flows.length - 1];
  assert.ok(last !== undefined && last.verb === 'FLOW', 'no FLOW frame was sent');
  return JSON.parse(last.state) as {
    steps: Array<{ step: string; status: string; educational: boolean }>;
    board: string;
    ports: Array<{ name: string; constraint?: string; pin?: string; bits?: string[]; choices?: string[] }>;
    canProgram: boolean;
  };
}

const statusOf = (frames: readonly ServerFrame[], step: string) =>
  lastFlow(frames).steps.find((entry) => entry.step === step)?.status;

const logged = (frames: readonly ServerFrame[]) =>
  frames.flatMap((frame) => (frame.verb === 'LOG' ? [frame.text] : [])).join('\n');

describe('the design flow in a session', () => {
  test('Synthesis without a design is refused, not invented', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleFlowRun('synthesis');
      assert.equal(statusOf(frames, 'synthesis'), 'failed');
      assert.match(logged(frames), /Synthesis needs a design/);
    });
  });

  test('Synthesis prepares the last RUN without starting a simulation, and reports its ports', async () => {
    const { engine, prepared } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('synthesis');
      assert.equal(prepared.length, 2, 'the RUN and the flow step each prepare');
      assert.equal(statusOf(frames, 'synthesis'), 'done');
      assert.deepEqual(
        lastFlow(frames).ports.map((port) => port.name),
        ['CLOCK_50', 'SW', 'LEDR'],
      );
    });
  });

  test('a step whose prerequisite is missing runs it first, in flow order (§ 7.5)', async () => {
    const { engine, prepared } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('bitstream');
      assert.equal(prepared.length, 2, 'Synthesis prepared once; Implementation and Bitstream are simulated');
      assert.equal(statusOf(frames, 'synthesis'), 'done');
      assert.equal(statusOf(frames, 'implement'), 'done');
      assert.equal(statusOf(frames, 'bitstream'), 'failed', 'no I/O Planning ran, so no port is constrained');
      assert.match(logged(frames), /Unconstrained logical port: CLOCK_50, SW, LEDR/);
    });
  });

  test('after a step failed, the next one refuses and names it (§ 7.5)', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      // No design yet, so Synthesis fails; the steps after it report that reason rather
      // than starting a chain that would fail the same way.
      await session.handleFlowRun('synthesis');
      assert.equal(statusOf(frames, 'synthesis'), 'failed');
      await session.handleFlowRun('implement');
      assert.match(logged(frames), /Cannot run implement: synthesis failed\./);
      assert.equal(statusOf(frames, 'implement'), 'not_run', 'the refusal runs nothing');
    });
  });

  test('I/O Planning constrains the ports the board has, and Bitstream then passes its DRC', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      assert.equal(statusOf(frames, 'ioPlanning'), 'done');
      assert.deepEqual(
        lastFlow(frames).ports.map((port) => port.constraint),
        ['CLOCK_50', 'SW', 'LEDR'],
      );
      await session.handleFlowRun('bitstream');
      assert.equal(statusOf(frames, 'bitstream'), 'done');
      assert.match(logged(frames), /SW -> SW/);
    });
  });

  test('a port the board does not have is left unconstrained, and Bitstream names it', async () => {
    const { engine } = preparingEngine([{ name: 'UART_TX', direction: 'out', width: 1 }]);
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      assert.equal(statusOf(frames, 'ioPlanning'), 'failed');
      assert.match(logged(frames), /No design port matches a board port/);
      await session.handleFlowRun('bitstream');
      assert.equal(statusOf(frames, 'bitstream'), 'failed');
      assert.match(logged(frames), /UART_TX/);
    });
  });

  test('Program Device is refused outright while a bitstream is missing (§ 7.5)', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleFlowRun('program');
      assert.equal(statusOf(frames, 'program'), 'not_run');
      assert.match(logged(frames), /Cannot run program: bitstream, connect/);
    });
  });

  test('Programming a board makes it programmed, and a changed source makes it stale', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      await session.handleFlowRun('bitstream');
      await session.handleFlowRun('connect');
      await session.handleFlowRun('program');
      assert.equal(statusOf(frames, 'program'), 'done');
      assert.equal(lastFlow(frames).board, 'programmed');
      assert.equal(lastFlow(frames).canProgram, true);

      await session.handleRun([{ name: 'top.vhdl', content: 'entity top is end entity; -- edited' }], 'top.vhdl');
      assert.equal(lastFlow(frames).board, 'stale');
      assert.equal(statusOf(frames, 'synthesis'), 'outdated');
    });
  });

  test('re-running the same source leaves Synthesis done: a re-run is not an edit', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('synthesis');
      await session.handleRun(FILES, 'top.vhdl');
      assert.equal(statusOf(frames, 'synthesis'), 'done');
    });
  });

  test('a changed top module outdates every step (§ 7.4)', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      await session.handleRun(FILES, 'other.vhdl');
      assert.equal(statusOf(frames, 'synthesis'), 'outdated');
      assert.equal(statusOf(frames, 'ioPlanning'), 'outdated');
    });
  });

  test('an edit carried by a flow step marks the earlier steps outdated (§ 7.4)', async () => {
    const { engine, prepared } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      assert.equal(statusOf(frames, 'ioPlanning'), 'done');
      const edited = [{ name: 'top.vhdl', content: 'entity top is end entity; -- edited' }];
      // The panel sends the editor's sources with every step, so this is how the browser
      // reports an edit: no RUN in between, the step itself carries the new source.
      // `hardware` has no prerequisite, so the invalidation is all it can do.
      await session.handleFlowRun('hardware', { files: edited, topFile: 'top.vhdl' });
      assert.equal(statusOf(frames, 'synthesis'), 'outdated');
      assert.equal(statusOf(frames, 'ioPlanning'), 'outdated');
      assert.equal(prepared.length, 2, 'the flow step did not silently re-synthesise');
    });
  });

  test('an unknown step is a protocol error, and nothing runs', async () => {
    const { engine, prepared } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleFlowRun('simulate');
      const error = frames.find((frame) => frame.verb === 'ERROR');
      assert.ok(error !== undefined && error.verb === 'ERROR');
      assert.match(error.text, /unknown step/);
      assert.equal(prepared.length, 0);
    });
  });

  test('a step that cannot compile is failed, and the next step does not run', async () => {
    const failing: SimEngine = {
      language: 'vhdl',
      prepare: () => Promise.resolve({ ok: false, stage: 'analyze', text: 'top.vhdl:1:1: syntax error' }),
      startBoardRun: () => ({ kill: () => {}, onExit: () => {}, onOutput: () => {}, grantPacing: () => {} }),
      startBatchRun: () => ({ kill: () => {}, done: new Promise(() => {}) }),
    };
    await withFlow(failing, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('implement');
      assert.equal(statusOf(frames, 'synthesis'), 'failed');
      assert.equal(statusOf(frames, 'implement'), 'not_run');
      assert.match(logged(frames), /syntax error/);
    });
  });

  test('I/O Planning matches the board the session was given, not the Default one', async () => {
    const { engine } = preparingEngine([
      { name: 'clk', direction: 'in', width: 1 },
      { name: 'led', direction: 'out', width: 16 },
    ]);
    await withFlow(engine, async (session, frames) => {
      session.handleBoard(decodeBoardBody(encodeBoardBody(boardWithLeds)));
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      assert.equal(statusOf(frames, 'ioPlanning'), 'done');
      assert.deepEqual(
        lastFlow(frames).ports.map((port) => port.constraint),
        ['clk', 'led'],
      );
    });
  });

  test('a pin moves a port to the board port the student chose, and I/O Planning writes that wire', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      await session.handleFlowRun('bitstream');
      session.handleFlowPin('CLOCK_50', 'CLOCK_500Hz');
      const clock = lastFlow(frames).ports.find((port) => port.name === 'CLOCK_50');
      assert.equal(clock?.pin, 'CLOCK_500Hz');
      assert.equal(clock?.constraint, 'CLOCK_500Hz', 'I/O Planning follows the pin at once');
      assert.equal(statusOf(frames, 'implement'), 'outdated');
      assert.equal(statusOf(frames, 'bitstream'), 'outdated');
      assert.equal(statusOf(frames, 'synthesis'), 'done', 'a pin change leaves Synthesis alone (§ 7.4)');
      await session.handleFlowRun('ioPlanning');
      assert.equal(lastFlow(frames).ports.find((port) => port.name === 'CLOCK_50')?.constraint, 'CLOCK_500Hz');
    });
  });

  test('a pin that breaks § 7.6 is refused with its reason, and the old wiring stays', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      session.handleFlowPin('LEDR', 'SW');
      assert.match(logged(frames), /LEDR is an output, and SW is an input on this board/);
      assert.equal(lastFlow(frames).ports.find((port) => port.name === 'LEDR')?.pin, undefined);
      assert.equal(lastFlow(frames).ports.find((port) => port.name === 'LEDR')?.constraint, 'LEDR');
    });
  });

  test('a pin for a port the design does not have is refused, not stored', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      session.handleFlowPin('NOPE', 'SW');
      assert.match(logged(frames), /no port named NOPE/);
      assert.equal(lastFlow(frames).ports.some((port) => port.pin !== undefined), false);
    });
  });

  test('clearing a pin goes back to the name match', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('ioPlanning');
      session.handleFlowPin('CLOCK_50', 'CLOCK_500Hz');
      session.handleFlowPin('CLOCK_50');
      assert.equal(lastFlow(frames).ports.find((port) => port.name === 'CLOCK_50')?.pin, undefined);
      await session.handleFlowRun('ioPlanning');
      assert.equal(lastFlow(frames).ports.find((port) => port.name === 'CLOCK_50')?.constraint, 'CLOCK_50');
    });
  });

  test('each row lists the board ports it may be pinned to (§ 7.6 direction and width)', async () => {
    const { engine } = preparingEngine();
    await withFlow(engine, async (session, frames) => {
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('synthesis');
      const ports = lastFlow(frames).ports;
      // A 1-bit input may go on either clock; a 10-bit output only on the 10 LEDs.
      assert.deepEqual(ports.find((port) => port.name === 'CLOCK_50')?.choices, ['CLOCK_50', 'CLOCK_500Hz']);
      assert.deepEqual(ports.find((port) => port.name === 'SW')?.choices, ['SW']);
      assert.deepEqual(ports.find((port) => port.name === 'LEDR')?.choices, ['LEDR']);
    });
  });
  test('a multiplexed display offers its segment word, so one port drives CA…CG or CA…DP', async () => {
    const ports: RunPlan['ports'] = [
      { name: 'seg7', direction: 'out', width: 7 },
      { name: 'seg8', direction: 'out', width: 8 },
    ];
    const { engine } = preparingEngine(ports);
    await withFlow(engine, async (session, frames) => {
      session.handleBoard(decodeBoardBody(BOARD_FRAMES['nexys-a7'] ?? ''));
      await session.handleRun(FILES, 'top.vhdl');
      await session.handleFlowRun('synthesis');
      const rows = lastFlow(frames).ports;
      assert.deepEqual(rows.find((port) => port.name === 'seg7')?.choices, ['CA…CG']);
      assert.deepEqual(rows.find((port) => port.name === 'seg8')?.choices, ['AN', 'CA…DP']);
      session.handleFlowPin('seg8', 'CA…DP');
      await session.handleFlowRun('ioPlanning');
      const pinned = lastFlow(frames).ports.find((port) => port.name === 'seg8');
      assert.equal(pinned?.pin, 'CA…DP', 'the pin names the word, not one of its bits');
      assert.equal(pinned?.constraint, 'CA…DP', 'I/O Planning writes the word, not its last bit');
      assert.deepEqual(pinned?.bits, ['CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'DP']);
      assert.match(logged(frames), /seg8 -> CA…DP/);
    });
  });
});
/** A board whose port names differ from the Default board's, so the match cannot be a coincidence. */
const boardWithLeds = {
  clock: { port: 'clk', mhz: 100 },
  clock500Hz: 'clk500',
  switches: { port: 'sw', count: 16 },
  pushbuttons: { group: { kind: 'vector' as const, port: 'btn', count: 5 }, activeLow: true },
  leds: { port: 'led', count: 16 },
  sevenSegment: { kind: 'independent' as const, ports: ['seg0'], width: 7, activeLow: true },
};

// SPDX-License-Identifier: GPL-2.0-only
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  begin,
  canProgram,
  fail,
  FLOW_STEPS,
  initialFlow,
  invalidate,
  isEducational,
  planRun,
  requestStep,
  runnableSteps,
  succeed,
  unmetPrerequisites,
  type FlowState,
  type FlowStep,
} from './designFlow.js';

/** A flow that reached `step` by running every step up to it in order. */
function flowThrough(...steps: readonly FlowStep[]): FlowState {
  let state = initialFlow();
  for (const step of steps) state = succeed(begin(state, step), step);
  return state;
}

const ALL: readonly FlowStep[] = FLOW_STEPS;

describe('the flow order', () => {
  test('follows PRD § 7.2, seven steps starting at synthesis', () => {
    assert.deepEqual(ALL, ['synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware', 'connect', 'program']);
  });

  test('only Implementation and Generate Bitstream are marked educational (§ 7.1.3, § 7.1.6)', () => {
    assert.deepEqual(ALL.filter(isEducational), ['implement', 'bitstream']);
  });

  test('a fresh flow has every step not_run and an unconnected board', () => {
    const state = initialFlow();
    assert.deepEqual(
      ALL.map((step) => state.statuses[step]),
      ALL.map(() => 'not_run'),
    );
    assert.equal(state.board, 'unconnected');
  });
});

describe('prerequisites (§ 7.4)', () => {
  test('Synthesis has none; every other step names the steps before it that must be done', () => {
    const fresh = initialFlow();
    assert.deepEqual(unmetPrerequisites(fresh, 'synthesis'), []);
    assert.deepEqual(unmetPrerequisites(fresh, 'ioPlanning'), ['synthesis']);
    assert.deepEqual(unmetPrerequisites(fresh, 'implement'), ['synthesis']);
    assert.deepEqual(unmetPrerequisites(fresh, 'bitstream'), ['implement']);
    assert.deepEqual(unmetPrerequisites(fresh, 'connect'), ['hardware']);
    assert.deepEqual(unmetPrerequisites(fresh, 'program'), ['bitstream', 'connect']);
  });

  test('the Hardware Manager opens without any prerequisite, as in Vivado', () => {
    assert.deepEqual(unmetPrerequisites(initialFlow(), 'hardware'), []);
    assert.deepEqual(requestStep(initialFlow(), 'hardware'), { kind: 'run' });
    assert.deepEqual(runnableSteps(initialFlow()), ['synthesis', 'hardware']);
  });

  test('a bitstream needs Implementation done, not merely started', () => {
    const running = begin(flowThrough('synthesis', 'ioPlanning'), 'implement');
    assert.deepEqual(unmetPrerequisites(running, 'bitstream'), ['implement']);
  });
});

describe('jumping ahead (§ 7.5)', () => {
  test('Implementation without Synthesis offers to run Synthesis first', () => {
    assert.deepEqual(requestStep(initialFlow(), 'implement'), {
      kind: 'offer-missing',
      missing: ['synthesis'],
    });
  });

  test('Bitstream from nothing offers the whole chain, in order', () => {
    assert.deepEqual(planRun(initialFlow(), 'bitstream'), ['synthesis', 'implement', 'bitstream']);
  });

  test('Program Device is refused outright, not offered, without a bitstream', () => {
    const state = flowThrough('synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware');
    assert.deepEqual(requestStep(state, 'program'), { kind: 'refuse', missing: ['connect'] });
    assert.equal(canProgram(state), false);
  });

  test('with a bitstream and a connection, Program Device runs', () => {
    const state = flowThrough('synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware', 'connect');
    assert.equal(canProgram(state), true);
    assert.deepEqual(requestStep(state, 'program'), { kind: 'run' });
  });

  test('a step already running refuses a second request', () => {
    const state = begin(initialFlow(), 'synthesis');
    assert.deepEqual(requestStep(state, 'synthesis'), { kind: 'refuse', missing: [] });
  });

  test('an outdated step is still not done, so it must run again', () => {
    const state = invalidate(flowThrough('synthesis', 'ioPlanning'), 'source');
    assert.deepEqual(unmetPrerequisites(state, 'implement'), ['synthesis']);
  });
});

describe('programming and board stage (§ 4.6)', () => {
  test('successful Program Device makes the board programmed', () => {
    const state = flowThrough('synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware', 'connect', 'program');
    assert.equal(state.board, 'programmed');
  });

  test('Auto Connect moves the board from unconnected to connected', () => {
    const state = flowThrough('synthesis', 'hardware', 'connect');
    assert.equal(state.board, 'connected');
  });

  test('a failed Auto Connect leaves the board unconnected', () => {
    const state = fail(begin(flowThrough('synthesis', 'hardware'), 'connect'), 'connect');
    assert.equal(state.board, 'unconnected');
    assert.equal(state.statuses.connect, 'failed');
  });

  test('a failed Program Device does not claim a programmed board', () => {
    const connected = flowThrough('synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware', 'connect');
    const state = fail(begin(connected, 'program'), 'program');
    assert.equal(state.board, 'connected');
    assert.equal(state.statuses.program, 'failed');
  });

  test('reconnecting after programming keeps the board programmed', () => {
    const programmed = flowThrough('synthesis', 'ioPlanning', 'implement', 'bitstream', 'hardware', 'connect', 'program');
    const state = flowThrough(...ALL);
    assert.equal(state.board, 'programmed');
    assert.equal(programmed.board, 'programmed');
  });
});

describe('invalidation (§ 7.4)', () => {
  const complete = (): FlowState => flowThrough(...ALL);

  test('a source change outdates Synthesis downward and stales a programmed board', () => {
    const state = invalidate(complete(), 'source');
    assert.deepEqual(
      ALL.map((step) => state.statuses[step]),
      ['outdated', 'outdated', 'outdated', 'outdated', 'done', 'done', 'done'],
    );
    assert.equal(state.board, 'stale');
  });

  test('a constraint change leaves Synthesis done and outdates Implementation and Bitstream', () => {
    const state = invalidate(complete(), 'constraint');
    assert.deepEqual(
      ALL.map((step) => state.statuses[step]),
      ['done', 'done', 'outdated', 'outdated', 'done', 'done', 'done'],
    );
    assert.equal(state.board, 'stale');
  });

  test('a new top module outdates every step', () => {
    const state = invalidate(complete(), 'top');
    assert.deepEqual(
      ALL.map((step) => state.statuses[step]),
      ALL.map(() => 'outdated'),
    );
    assert.equal(state.board, 'stale');
  });

  test('a change with nothing done yet changes nothing', () => {
    const state = invalidate(initialFlow(), 'top');
    assert.deepEqual(state, initialFlow());
  });

  test('a change does not resurrect a failed step as outdated', () => {
    const failed = fail(begin(flowThrough('synthesis', 'ioPlanning', 'implement'), 'bitstream'), 'bitstream');
    const state = invalidate(failed, 'source');
    assert.equal(state.statuses.bitstream, 'failed');
  });

  test('a stale board does not become programmed again by re-running Synthesis', () => {
    const stale = invalidate(complete(), 'source');
    const state = succeed(begin(stale, 'synthesis'), 'synthesis');
    assert.equal(state.board, 'stale');
  });
});

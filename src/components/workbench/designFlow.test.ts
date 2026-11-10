// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy
/**
 * The panel's reading of the backend's FLOW frame (PRD.md § 7.3–§ 7.5): a frame it
 * cannot read changes nothing, a step it leaves out is not_run, and the jump rules
 * agree with the ones the session enforces.
 */
import { describe, expect, test } from 'vitest';
import { canRun, parseFlow, unmetPrerequisites, FLOW_STEPS, type FlowStep } from './designFlow';

const wire = (statuses: Partial<Record<FlowStep, string>> = {}, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    steps: FLOW_STEPS.map((step) => ({ step, status: statuses[step] ?? 'not_run' })),
    board: 'unconnected',
    ports: [],
    canProgram: false,
    ...extra,
  });

describe('parseFlow', () => {
  test('a body that is not JSON, or names an unknown board stage, is ignored', () => {
    expect(parseFlow('not json')).toBeUndefined();
    expect(parseFlow('null')).toBeUndefined();
    expect(parseFlow(wire({}, { board: 'on fire' }))).toBeUndefined();
  });

  test('a step the backend leaves out is not_run, so the panel still lists seven', () => {
    const flow = parseFlow(JSON.stringify({ steps: [{ step: 'synthesis', status: 'done' }], board: 'connected', ports: [] }));
    expect(flow?.steps.map((entry) => entry.step)).toEqual([...FLOW_STEPS]);
    expect(flow?.steps.find((entry) => entry.step === 'synthesis')?.status).toBe('done');
    expect(flow?.steps.find((entry) => entry.step === 'bitstream')?.status).toBe('not_run');
  });

  test('a step with an unknown status is not_run rather than rendered as-is', () => {
    const flow = parseFlow(wire({ synthesis: 'mostly' }));
    expect(flow?.steps.find((entry) => entry.step === 'synthesis')?.status).toBe('not_run');
  });

  test('only Implementation and Generate Bitstream are badged simulated (§ 7.1.6)', () => {
    const flow = parseFlow(wire());
    expect(flow?.steps.filter((entry) => entry.educational).map((entry) => entry.step)).toEqual(['implement', 'bitstream']);
  });
});

describe('jumping ahead (§ 7.5)', () => {
  test('the missing prerequisites are named in flow order', () => {
    const flow = parseFlow(wire({ synthesis: 'done' }));
    expect(unmetPrerequisites(flow ?? null, 'program')).toEqual(['bitstream', 'connect']);
  });

  test('an outdated prerequisite is still missing: it has to run again', () => {
    const flow = parseFlow(wire({ synthesis: 'done', ioPlanning: 'done', implement: 'outdated', bitstream: 'outdated' }));
    expect(unmetPrerequisites(flow ?? null, 'bitstream')).toEqual(['implement']);
  });

  test('before the first FLOW frame every prerequisite is missing, so a first click still asks', () => {
    expect(unmetPrerequisites(null, 'bitstream')).toEqual(['implement']);
    expect(unmetPrerequisites(null, 'synthesis')).toEqual([]);
  });

  test('Program Device is locked until the backend says it can program', () => {
    const ready = parseFlow(wire({}, { canProgram: false }));
    expect(ready && canRun(ready, 'program')).toBe(false);
    const programmable = parseFlow(wire({}, { canProgram: true }));
    expect(programmable && canRun(programmable, 'program')).toBe(true);
  });

  test('a running step cannot be started twice', () => {
    const flow = parseFlow(wire({ synthesis: 'running' }));
    expect(flow && canRun(flow, 'synthesis')).toBe(false);
    expect(flow && canRun(flow, 'hardware')).toBe(true);
  });
});
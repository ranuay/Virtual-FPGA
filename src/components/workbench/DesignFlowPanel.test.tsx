// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/** The Design Flow panel as a student sees it (PRD.md § 7.2–§ 7.8). */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DesignFlowPanel } from './DesignFlowPanel';
import { parseFlow, type FlowStep, type FlowWire } from './designFlow';

const flowOf = (statuses: Partial<Record<FlowStep, string>>, extra: Record<string, unknown> = {}): FlowWire | undefined =>
  parseFlow(
    JSON.stringify({
      steps: Object.entries(statuses).map(([step, status]) => ({ step, status })),
      board: 'unconnected',
      ports: [],
      canProgram: false,
      ...extra,
    }),
  );

const PINS = { BTNC: ['N17'], SW: ['J15', 'L16'], CLOCK_50: ['E3'] };

const render = (flow: FlowWire | undefined, busy = false, onPin: (port: string, boardPort: string | undefined) => void = () => {}): string =>
  renderToStaticMarkup(<DesignFlowPanel flow={flow ?? null} pins={PINS} busy={busy} onRun={() => {}} onPin={onPin} />);

const runButtons = (html: string): string[] => html.match(/<button[^>]*class="wb-flow__run"[^>]*>/g) ?? [];

describe('DesignFlowPanel', () => {
  it('lists all seven steps before the backend has said anything, with only Program Device locked', () => {
    const html = render(undefined);
    expect(html.match(/class="wb-flow__step /g)).toHaveLength(7);
    // The first click opens the socket, so the other six must be clickable before any FLOW frame.
    expect(runButtons(html).filter((button) => !button.includes('disabled'))).toHaveLength(6);
    expect(runButtons(html).at(-1)).toContain('disabled');
  });

  it('shows each step status, and only Implementation and Bitstream carry the Simulated badge', () => {
    const html = render(flowOf({ synthesis: 'done', ioPlanning: 'done', implement: 'done', bitstream: 'outdated' }));
    expect(html).toContain('Synthesis');
    expect(html).toContain('Outdated');
    expect(html.match(/wb-flow__badge/g)).toHaveLength(2);
  });

  it('locks every button while a step runs, and leaves the rest clickable so a jump can ask first', () => {
    const idle = render(flowOf({ synthesis: 'done' }));
    // § 7.5: a step whose prerequisites are missing is still clickable — the panel asks
    // before running them. Only Program Device is disabled, because the backend refuses it.
    expect(runButtons(idle).filter((button) => !button.includes('disabled'))).toHaveLength(6);
    const busy = render(flowOf({ synthesis: 'done' }), true);
    expect(runButtons(busy).every((button) => button.includes('disabled'))).toBe(true);
  });

  it('keeps Program Device locked until the backend says the board can be programmed', () => {
    const locked = render(flowOf({}, { canProgram: false }));
    const programmable = render(flowOf({}, { canProgram: true }));
    expect(runButtons(locked).at(-1)).toContain('disabled');
    expect(runButtons(programmable).at(-1)).not.toContain('disabled');
  });

  it('shows the I/O table only once there are ports, and marks the unconstrained ones', () => {
    expect(render(flowOf({ synthesis: 'done' }))).not.toContain('wb-flow__ports');
    const html = render(
      flowOf({ synthesis: 'done' }, { ports: [{ name: 'LED', direction: 'out', width: 16 }, { name: 'SW', direction: 'in', width: 16, constraint: 'SW' }] }),
    );
    expect(html).toContain('1 without a pin');
    expect(html).toContain('unassigned');
    expect(html).toContain('>SW<');
  });

  it('offers a select only for a port with choices, showing the pin when there is one', () => {
    const onPin = vi.fn();
    const html = render(
      flowOf(
        { synthesis: 'done' },
        {
          ports: [
            { name: 'LED', direction: 'out', width: 16, choices: ['LED', 'HEX0_N'] },
            { name: 'SW', direction: 'in', width: 16, choices: ['SW'], pin: 'SW' },
            { name: 'UART_TX', direction: 'out', width: 1 },
          ],
        },
      ),
      false,
      onPin,
    );
    expect(html.match(/<select/g)).toHaveLength(2);
    expect(html).not.toContain('aria-label="Board port for UART_TX"');
    expect(html).toContain('<option value="SW" selected="">SW</option>');
    expect(html).toContain('2 without a pin');
  });

  it('names the package pin of the board port in the row, and — when the board has no pin table', () => {
    const html = render(
      flowOf(
        { synthesis: 'done' },
        {
          ports: [
            { name: 'KEY0', direction: 'in', width: 1, choices: ['BTNC'], pin: 'BTNC' },
            { name: 'sw', direction: 'in', width: 2, choices: ['SW'], pin: 'SW' },
            { name: 'CLK', direction: 'in', width: 1, choices: ['CLOCK_50'], pin: 'CLOCK_50' },
            { name: 'UART_TX', direction: 'out', width: 1 },
          ],
        },
      ),
    );
    expect(html).toContain('<code>N17</code>');
    expect(html).toContain('<code>J15…L16</code>');
    expect(html).toContain('<code>E3</code>');
    // A port pinned to nothing has no package pin to name.
    expect(html.match(/<code>—<\/code>/g)).toHaveLength(1);
  });

  it('names the board stage, so a stale board is visible without reading the log', () => {
    expect(render(flowOf({}, { board: 'stale' }))).toContain('is-stale');
  });
});
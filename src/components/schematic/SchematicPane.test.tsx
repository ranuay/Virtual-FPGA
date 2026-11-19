// SPDX-License-Identifier: GPL-2.0-only
/**
 * What the schematic pane draws, not how it looks: an `and`/`or`/`xor`/`not` cell is a
 * gate symbol the way Vivado draws one, a port and a register stay labelled boxes, and
 * an empty drawing says why it is empty instead of showing a blank canvas.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchematicPane } from './SchematicPane';
import type { SchematicWire } from './schematic';

const wire = (nodes: SchematicWire['nodes'], edges: SchematicWire['edges'] = []): SchematicWire => ({ top: 'demo', nodes, edges });

const render = (schematic: SchematicWire | null, busy = false): string =>
  renderToStaticMarkup(<SchematicPane schematic={schematic} busy={busy} onClose={() => {}} />);

describe('SchematicPane', () => {
  it('draws a gate-driven signal as its gate symbol, and a port as a labelled box', () => {
    const html = render(wire([{ id: 'a', name: 'a', kind: 'port', op: 'IN', width: 1, direction: 'in' }, { id: 'y', name: 'y', kind: 'logic', op: 'XOR', width: 1 }], [{ from: 'a', to: 'y' }]));
    // The XOR's body and its exclusive back edge are both drawn; the port's box is not.
    expect(html.match(/class="sc-gate-shape"/g)).toHaveLength(2);
    expect(html.match(/<rect /g)).toHaveLength(1);
    expect(html).toContain('>y</text>');
  });

  it('says why the canvas is empty rather than drawing a blank one', () => {
    expect(render(null, true)).toContain('Elaborating');
    expect(render(null, false)).toContain('Run Open Elaborated Design first');
  });

  it('counts what the elaborated design is made of, as Vivado does above the drawing', () => {
    const html = render(
      wire(
        [
          { id: 'a', name: 'a', kind: 'port', op: 'IN', width: 1, direction: 'in' },
          { id: 'y', name: 'y', kind: 'logic', op: 'AND', width: 1 },
          { id: 's', name: 's', kind: 'port', op: 'OUT', width: 1, direction: 'out' },
        ],
        [{ from: 'a', to: 'y' }, { from: 'y', to: 's' }],
      ),
    );
    expect(html).toContain('1 cells · 2 I/O ports · 2 nets');
  });
});

describe('junction dots', () => {
  it('marks a fan-out on the drawing, and leaves a point-to-point wire unmarked', () => {
    // A single driver-to-load wire has no second wire to branch off, so it gets no dot.
    const html = render(
      wire(
        [
          { id: 'a', name: 'a', kind: 'port', op: 'IN', width: 1, direction: 'in' },
          { id: 'b', name: 'b', kind: 'logic', op: 'AND', width: 1 },
          { id: 'c', name: 'c', kind: 'logic', op: 'OR', width: 1 },
        ],
        [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }],
      ),
    );
    // One dot for the one place a branch leaves the trunk; the trunk's own end is a bend.
    expect(html.match(/class="sc-junction"/g)).toHaveLength(1);
    expect(render(wire([{ id: 'a', name: 'a', kind: 'port', op: 'IN', width: 1, direction: 'in' }, { id: 'b', name: 'b', kind: 'logic', op: 'AND', width: 1 }], [{ from: 'a', to: 'b' }]))).not.toContain('sc-junction');
  });
});

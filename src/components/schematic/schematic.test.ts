// SPDX-License-Identifier: GPL-2.0-only
/**
 * The RTL schematic's two pure steps (PRD.md § 3.4, § 7.2): reading the backend's body
 * and putting its blocks in columns. The drawing itself is not pinned here — the rules
 * that decide what is drawn are.
 */
import { describe, expect, it } from 'vitest';
import { layoutSchematic, nodeSummary, outlineOf, parseSchematic, shapeOf, sizeOf, type PlacedNode, type SchematicNode, type SchematicWire } from './schematic';

const node = (id: string, extra: Partial<SchematicNode> = {}): SchematicNode => ({
  id,
  name: id,
  kind: 'logic',
  op: 'AND',
  width: 1,
  ...extra,
});

const body = (nodes: SchematicNode[], edges: readonly [string, string][], extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ top: 'demo', nodes, edges: edges.map(([from, to]) => ({ from, to })), ...extra });

/** A body that is known to parse, so a layout test says what it means when parsing breaks. */
function parse(text: string): SchematicWire {
  const wire = parseSchematic(text);
  if (wire === undefined) throw new Error('expected the body to parse');
  return wire;
}

/** One straight run of a routed wire. */
interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** A block's outline, in the pane's coordinates. */
interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** The straight runs of an `M x y L x y …` path. */
function segmentsOf(d: string): Segment[] {
  const numbers = (d.match(/-?\d+/g) ?? []).map(Number);
  const segments: Segment[] = [];
  for (let i = 2; i + 1 < numbers.length; i += 2) {
    segments.push({ x1: numbers[i - 2], y1: numbers[i - 1], x2: numbers[i], y2: numbers[i + 1] });
  }
  return segments;
}

const strictlyInside = (value: number, low: number, high: number): boolean => value > low && value < high;

/** Whether a run passes through a box rather than stopping at its edge. */
function crosses(segment: Segment, box: Box): boolean {
  return segment.y1 === segment.y2
    ? strictlyInside(segment.y1, box.top, box.bottom) && Math.max(segment.x1, segment.x2) > box.left && Math.min(segment.x1, segment.x2) < box.right
    : strictlyInside(segment.x1, box.left, box.right) && Math.max(segment.y1, segment.y2) > box.top && Math.min(segment.y1, segment.y2) < box.bottom;
}

describe('parseSchematic', () => {
  it('drops a wire that points at a block the body does not carry', () => {
    // An edge to nowhere would otherwise draw a line into the margin.
    const wire = parseSchematic(body([node('a'), node('b')], [['a', 'b'], ['a', 'ghost']]));
    expect(wire?.edges).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('refuses a body that is not a schematic, and one whose top is missing', () => {
    expect(parseSchematic('not json')).toBeUndefined();
    expect(parseSchematic(JSON.stringify({ nodes: [] }))).toBeUndefined();
  });

  it('carries the omitted count only when the backend left blocks out', () => {
    expect(parseSchematic(body([node('a')], [], { omitted: 12 }))?.omitted).toBe(12);
    expect(parseSchematic(body([node('a')], [], { omitted: 0 }))?.omitted).toBeUndefined();
  });

  it('keeps a block only when its required fields are there and its kind is one we draw', () => {
    const wire = parseSchematic(
      JSON.stringify({
        top: 'demo',
        nodes: [node('good'), { id: 'no-op', name: 'x', kind: 'logic', width: 1 }, node('bad-kind', { kind: 'gizmo' as never })],
        edges: [],
      }),
    );
    expect(wire?.nodes.map((entry) => entry.id)).toEqual(['good']);
  });
});

describe('layoutSchematic', () => {
  it('puts a block to the right of everything it reads, and joins two adjacent rows flat', () => {
    const layout = layoutSchematic(parse(body([node('in1', { kind: 'port', op: 'IN' }), node('logic')], [['in1', 'logic']])));
    const placed = (id: string): PlacedNode | undefined => layout.nodes.find((entry) => entry.node.id === id);
    const source = placed('in1');
    const target = placed('logic');
    if (source === undefined || target === undefined) throw new Error('expected both blocks to be drawn');
    expect(target.x).toBeGreaterThan(source.x);
    // Edge to edge, so the wire never runs across the two blocks it joins.
    expect(layout.edges[0]?.d).toBe(`M ${source.x + sizeOf(source.node).width / 2} ${source.y} L ${target.x - sizeOf(target.node).width / 2} ${target.y}`);
  });

  it('draws no wire across a block, wherever its rows are', () => {
    // The shape the Bab 3 full adder elaborates to: one input read by blocks in two
    // different columns, and two rows sharing a column. A wire crossing a box is the
    // difference between a schematic and a tangle, so this is the rule worth pinning.
    const wire = parse(
      body(
        [
          node('a', { kind: 'port', op: 'IN' }),
          node('B', { kind: 'port', op: 'IN' }),
          node('Cin', { kind: 'port', op: 'IN' }),
          node('n2'),
          node('n4'),
          node('n6'),
          node('n3'),
          node('n7'),
          node('n5'),
        ],
        [['a', 'n2'], ['B', 'n2'], ['a', 'n4'], ['B', 'n4'], ['a', 'n6'], ['B', 'n6'], ['n2', 'n3'], ['n2', 'n7'], ['n3', 'n5'], ['n4', 'n5']],
      ),
    );
    const layout = layoutSchematic(wire);
    const boxes = layout.nodes.map((entry) => {
      const size = sizeOf(entry.node);
      return { left: entry.x - size.width / 2, right: entry.x + size.width / 2, top: entry.y - size.height / 2, bottom: entry.y + size.height / 2 };
    });
    for (const edge of layout.edges) {
      for (const segment of segmentsOf(edge.d)) {
        for (const box of boxes) {
          // A wire may touch a box's edge (that is where it attaches) but not run through it.
          expect(crosses(segment, box)).toBe(false);
        }
      }
    }
  });

  it('loops a wire that goes backwards clear of the block it re-enters', () => {
    // A counter reads its own next value: the wire must not be drawn back across the text.
    const layout = layoutSchematic(parse(body([node('a'), node('b')], [['b', 'a']])));
    const x = (id: string): number => layout.nodes.find((entry) => entry.node.id === id)?.x ?? -1;
    const xs = (layout.edges[0]?.d.match(/-?\d+/g) ?? []).map(Number).filter((_, index) => index % 2 === 0);
    expect(Math.max(...xs)).toBeGreaterThan(x('b') + sizeOf(node('b')).width / 2);
  });

  it('gives up on a feedback loop instead of measuring it forever', () => {
    // A counter reads its own next value: the cycle must read as one column, not hang.
    const layout = layoutSchematic(parse(body([node('a'), node('b')], [['a', 'b'], ['b', 'a']])));
    expect(layout.nodes).toHaveLength(2);
    expect(layout.width).toBeGreaterThan(0);
  });

  it('draws a design with no blocks as an empty canvas rather than a zero-sized one', () => {
    const layout = layoutSchematic({ top: 'empty', nodes: [], edges: [] });
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe('nodeSummary', () => {
  it('names the direction only on a port, and says bits rather than bit', () => {
    expect(nodeSummary(node('seg', { kind: 'port', op: 'OUT', width: 7, direction: 'out' }))).toBe('OUT → OUT · 7 bits');
    expect(nodeSummary(node('flag', { width: 1 }))).toBe('AND · 1 bit');
  });
});

describe('shapeOf', () => {
  it('draws a logic block driven by a gate as that gate, and everything else as a box', () => {
    expect(shapeOf(node('y', { op: 'AND' }))).toBe('and');
    expect(shapeOf(node('y', { op: 'OR' }))).toBe('or');
    expect(shapeOf(node('y', { op: 'XOR' }))).toBe('xor');
    expect(shapeOf(node('y', { op: 'NOT' }))).toBe('not');
    // A register and an adder are one cell with one output: a gate outline would misstate them.
    expect(shapeOf(node('q', { op: 'REG', kind: 'reg' }))).toBe('box');
    expect(shapeOf(node('y', { op: 'LOGIC' }))).toBe('box');
    // A port carries no logic, whatever its op says.
    expect(shapeOf(node('sw', { op: 'AND', kind: 'port', direction: 'in' }))).toBe('box');
  });

  it('gives only a gate an outline, since a box is drawn from its size', () => {
    expect(outlineOf('box')).toBeUndefined();
    for (const shape of ['and', 'or', 'xor', 'not'] as const) {
      expect(outlineOf(shape)?.path).toMatch(/^M/);
    }
    // The exclusive poles: only the XOR carries the second back edge.
    expect(outlineOf('xor')?.extra).toBeDefined();
    expect(outlineOf('or')?.extra).toBeUndefined();
    expect(outlineOf('and')?.extra).toBeUndefined();
  });
});

describe('gate pins', () => {
  it('gives a two-input gate a pin per input, so the wires stay apart as they do on the symbol', () => {
    const layout = layoutSchematic(
      parse(body([node('a', { kind: 'port', op: 'IN' }), node('B', { kind: 'port', op: 'IN' }), node('y', { op: 'AND' })], [['a', 'y'], ['B', 'y']])),
    );
    const ends = layout.edges.map((edge) => Number((edge.d.match(/-?\d+/g) ?? []).at(-1)));
    expect(new Set(ends).size).toBe(2);
    // Both land inside the gate's drawn height, one above its centre and one below.
    const gate = layout.nodes.find((entry) => entry.node.id === 'y');
    if (gate === undefined) throw new Error('expected the gate to be drawn');
    for (const y of ends) expect(Math.abs(y - gate.y)).toBeLessThan(sizeOf(gate.node).height / 2);
  });
});

describe('wire shape', () => {
  it('turns at the pin instead of diving to a lane band, so a wire reads as one net', () => {
    // Vivado draws an input as a trunk in the gutter and one elbow into the pin. A wire
    // that dives to a shared lane and climbs back draws the staircase the pane used to.
    const layout = layoutSchematic(
      parse(body([node('a', { kind: 'port', op: 'IN' }), node('B', { kind: 'port', op: 'IN' }), node('y')], [['a', 'y'], ['B', 'y']])),
    );
    const elbows = (d: string): number => {
      const points = (d.match(/-?\d+/g) ?? []).map(Number);
      const coords: Array<[number, number]> = [];
      for (let index = 0; index + 1 < points.length; index += 2) coords.push([points[index] ?? 0, points[index + 1] ?? 0]);
      return Math.max(0, coords.length - 2);
    };
    for (const edge of layout.edges) expect(elbows(edge.d)).toBeLessThanOrEqual(2);
  });
});

describe('junction dot', () => {
  it('marks where a branch leaves another wire, and never a bare bend or a crossing', () => {
    // A dot means connected, so it belongs on the corner a fan-out taps its net from — and
    // not on a bend, nor where two wires merely cross.
    const layout = layoutSchematic(
      parse(body([node('a', { op: 'IN' }), node('b'), node('c'), node('y')], [['a', 'b'], ['a', 'c'], ['b', 'y'], ['c', 'y']])),
    );
    const dotted = layout.edges.filter((edge) => edge.junction !== undefined);
    expect(dotted).toHaveLength(1);
    const tap = dotted[0]?.junction;
    if (tap === undefined) throw new Error('expected one junction');
    // The rule behind the dot: it is a corner of one wire that another wire's run passes
    // through. Anything else — a bend, or a crossing — stays unmarked.
    const corners = (d: string): Array<[number, number]> => {
      const coords = (d.match(/-?\d+/g) ?? []).map(Number);
      const pairs: Array<[number, number]> = [];
      for (let at = 0; at + 1 < coords.length; at += 2) pairs.push([coords[at] ?? 0, coords[at + 1] ?? 0]);
      return pairs.slice(1, -1);
    };
    const others = layout.edges.filter((edge) => edge.from !== 'a' || edge.to !== 'b').flatMap((edge) => corners(edge.d));
    expect(others).toContainEqual(tap);
  });
});

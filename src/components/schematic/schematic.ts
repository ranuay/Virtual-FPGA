// SPDX-License-Identifier: GPL-2.0-only
/**
 * The RTL schematic as the pane draws it (PRD.md § 3.4, § 7.2: RTL ANALYSIS → Open
 * Elaborated Design → Schematic). The backend sends the netlist it read as nodes and
 * edges (`server/src/engines/netlist.ts`); this module parses that body and puts the
 * blocks in columns, so the drawing is a pure function of the frame and a unit test
 * pins the layout rules rather than a screenshot.
 *
 * A block driven by `and`/`or`/`xor`/`not` is drawn as the gate symbol, the way Vivado
 * draws a cell, and everything else as a labelled box: a port has no logic to draw, and
 * an `ADD`/`MUX`/`REG` has a shape of its own that a gate outline would misstate.
 */

/** One block: a design signal and what drives it. Mirrors the backend's `SchematicNode`. */
export interface SchematicNode {
  readonly id: string;
  readonly name: string;
  readonly kind: 'port' | 'logic' | 'reg';
  readonly op: string;
  readonly width: number;
  readonly direction?: 'in' | 'out' | 'inout';
  /** The source line GHDL attributes the assignment to, when it says. */
  readonly file?: string;
  readonly line?: number;
}

/** One wire: `to` reads `from`. */
export interface SchematicEdge {
  readonly from: string;
  readonly to: string;
}

/** The whole drawing, as the backend sent it. */
export interface SchematicWire {
  readonly top: string;
  readonly nodes: readonly SchematicNode[];
  readonly edges: readonly SchematicEdge[];
  /** Blocks the backend left out, when the netlist was too large to draw whole. */
  readonly omitted?: number;
}

/** A block with its place in the drawing, in the pane's own coordinates. */
export interface PlacedNode {
  readonly node: SchematicNode;
  readonly x: number;
  readonly y: number;
}

/** A wire, routed from the right edge of the block it reads to a pin on the left of the
 *  block that reads it, with its elbows inside the empty gutters and row gaps. */
export interface PlacedEdge {
  readonly from: string;
  readonly to: string;
  /** The SVG path of the wire, in the pane's own coordinates. */
  readonly d: string;
  /** Where a fan-out branches off its net's trunk: marked with a dot, as Vivado marks it. */
  readonly junction?: readonly [number, number];
}

export interface SchematicLayout {
  readonly nodes: readonly PlacedNode[];
  readonly edges: readonly PlacedEdge[];
  readonly width: number;
  readonly height: number;
}

/** A column is this wide and a row this tall: fixed, so the layout has no measurement step. */
const COLUMN_WIDTH = 180;
const ROW_HEIGHT = 96;
/** Every block is centred on this line of its row. */
const ROW_CENTRE = 32;
/** A labelled block (a port or a register), and the symbol a gate is drawn as. */
const BOX_WIDTH = 132;
const BOX_HEIGHT = 36;
const GATE_WIDTH = 44;
const GATE_HEIGHT = 40;

const KINDS: readonly string[] = ['port', 'logic', 'reg'];
const DIRECTIONS: readonly string[] = ['in', 'out', 'inout'];

/** The fields every block must carry: everything but the optional direction and source line. */
function hasCoreFields(node: SchematicNode): boolean {
  return (
    typeof node.id === 'string' &&
    typeof node.name === 'string' &&
    typeof node.op === 'string' &&
    KINDS.includes(node.kind) &&
    typeof node.width === 'number'
  );
}

const isNode = (value: unknown): value is SchematicNode => {
  const node = value as SchematicNode;
  return typeof value === 'object' && node !== null && hasCoreFields(node) && (node.direction === undefined || DIRECTIONS.includes(node.direction));
};

const isEdge = (value: unknown): value is SchematicEdge => {
  const edge = value as SchematicEdge;
  return typeof value === 'object' && edge !== null && typeof edge.from === 'string' && typeof edge.to === 'string';
};

/** The parsed body, or undefined when it is not a schematic at all. */
function wireOf(parsed: unknown): SchematicWire | undefined {
  const wire = parsed as SchematicWire;
  if (typeof wire !== 'object' || wire === null || typeof wire.top !== 'string' || !Array.isArray(wire.nodes)) return undefined;
  const nodes = wire.nodes.filter(isNode);
  const ids = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(wire.edges) ? wire.edges.filter(isEdge).filter((edge) => ids.has(edge.from) && ids.has(edge.to)) : [];
  return {
    top: wire.top,
    nodes,
    edges,
    ...(typeof wire.omitted === 'number' && wire.omitted > 0 ? { omitted: wire.omitted } : {}),
  };
}

export function parseSchematic(text: string): SchematicWire | undefined {
  try {
    return wireOf(JSON.parse(text));
  } catch {
    return undefined;
  }
}

/** How a block is drawn: a gate carries its symbol, everything else a labelled box. */
export type Shape = 'and' | 'or' | 'xor' | 'not' | 'box';

/** The operator a block's assignment came from decides whether it reads as a gate. */
export function shapeOf(node: SchematicNode): Shape {
  if (node.kind !== 'logic') return 'box';
  switch (node.op) {
    case 'AND':
      return 'and';
    case 'OR':
      return 'or';
    case 'XOR':
      return 'xor';
    case 'NOT':
      return 'not';
    default:
      return 'box';
  }
}

/** A block's drawn size, which is also where its wires attach. */
export function sizeOf(node: SchematicNode): { readonly width: number; readonly height: number } {
  return shapeOf(node) === 'box' ? { width: BOX_WIDTH, height: BOX_HEIGHT } : { width: GATE_WIDTH, height: GATE_HEIGHT };
}

/** Half a gate's drawn size, for the symbol's own coordinates (its centre is 0, 0). */
const GATE_HALF_WIDTH = GATE_WIDTH / 2;
const GATE_HALF_HEIGHT = GATE_HEIGHT / 2;

/**
 * A gate's symbol in coordinates relative to its centre, so a wire that attaches at the
 * block's edge lands on the symbol's edge: the body, and any extra stroke the symbol
 * needs (`xor`'s second back, `not`'s bubble). `box` has no symbol.
 */
export function outlineOf(shape: Shape): { readonly path: string; readonly extra?: string } | undefined {
  const halfWidth = GATE_HALF_WIDTH;
  const halfHeight = GATE_HALF_HEIGHT;
  switch (shape) {
    case 'and':
      // Flat back and a semicircular nose, which is the outline the textbook draws.
      return { path: `M${-halfWidth},${-halfHeight} H2 A${halfWidth - 2},${halfHeight} 0 0 1 2,${halfHeight} H${-halfWidth} Z` };
    case 'or':
      // Concave back and a pointed nose: the AND body without the arc's bulge. The back
      // sits on the block's edge, which is where a wire attaches.
      return { path: `M${-halfWidth},${-halfHeight} Q 12,${-halfHeight + 2} ${halfWidth},0 Q 12,${halfHeight - 2} ${-halfWidth},${halfHeight} Q -12,0 ${-halfWidth},${-halfHeight} Z` };
    case 'xor':
      // ...and one more back edge in front of it, which is what makes it exclusive: the
      // extra stroke is the leftmost one, so the block's edge and the wire meet it.
      return {
        path: `M-18,${-halfHeight} Q 12,${-halfHeight + 2} ${halfWidth},0 Q 12,${halfHeight - 2} -18,${halfHeight} Q -8,0 -18,${-halfHeight} Z`,
        extra: `M${-halfWidth},${-halfHeight} Q -10,0 ${-halfWidth},${halfHeight}`,
      };
    case 'not':
      // Triangle and bubble: the inversion is the bubble, not a missing side.
      return { path: `M${-halfWidth},${-halfHeight} L12,0 L${-halfWidth},${halfHeight} Z`, extra: 'M12,0 a5,5 0 1 0 10,0 a5,5 0 1 0 -10,0' };
    default:
      return undefined;
  }
}

/**
 * Puts each block in a column one past its longest path from an input: a signal sits to
 * the right of everything it reads, which is the order the source is read in. Cycles (a
 * counter feeding itself) stop at the column they reached, so this always terminates.
 */
export function layoutSchematic(wire: SchematicWire): SchematicLayout {
  const depth = depthsOf(wire);
  const { placed, nodes, rows } = placeColumns(wire, depth);
  const edges = placeEdges(wire, placed);
  const columnCount = Math.max(1, ...nodes.map((entry) => Math.floor(entry.x / COLUMN_WIDTH) + 1));
  return { nodes, edges, width: columnCount * COLUMN_WIDTH, height: Math.max(1, rows) * ROW_HEIGHT };
}

/** Each block's column: one past the deepest input it reads, cycles reading as 0. */
function depthsOf(wire: SchematicWire): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const node of wire.nodes) incoming.set(node.id, []);
  for (const edge of wire.edges) incoming.get(edge.to)?.push(edge.from);
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    // A cycle back to a block still being measured reads as depth 0, not as a hang.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const sources = incoming.get(id) ?? [];
    const measured = sources.length === 0 ? 0 : 1 + Math.max(...sources.map(depthOf));
    visiting.delete(id);
    depth.set(id, measured);
    return measured;
  };
  for (const node of wire.nodes) depthOf(node.id);
  return depth;
}

/** The blocks in their columns, in name order inside each, and the tallest column. */
function placeColumns(wire: SchematicWire, depth: Map<string, number>): { placed: Map<string, PlacedNode>; nodes: PlacedNode[]; rows: number } {
  const columns = new Map<number, SchematicNode[]>();
  for (const node of wire.nodes) {
    const column = depth.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }
  const placed = new Map<string, PlacedNode>();
  const nodes: PlacedNode[] = [];
  let rows = 0;
  for (const [column, entries] of [...columns].sort((left, right) => left[0] - right[0])) {
    entries.sort((left, right) => left.name.localeCompare(right.name));
    rows = Math.max(rows, entries.length);
    entries.forEach((node, row) => {
      const entry = { node, x: column * COLUMN_WIDTH + COLUMN_WIDTH / 2, y: row * ROW_HEIGHT + ROW_CENTRE };
      placed.set(node.id, entry);
      nodes.push(entry);
    });
  }
  return { placed, nodes, rows };
}

/** Spacing of the parallel tracks, so two wires never share a line. */
const TRACK = 10;
/** The empty band under a row the wires cross in before climbing into a pin. */
const LANE = 46;
const LANE_STEP = 8;

/** Each wire's route, dropped when either block is not drawn. */
function placeEdges(wire: SchematicWire, placed: Map<string, PlacedNode>): PlacedEdge[] {
  // A gate with two inputs has two pins on its left edge, so the wires stay apart the
  // way they do on the symbol: counted first, then handed out in the order they arrive.
  const inputCount = new Map<string, number>();
  for (const edge of wire.edges) inputCount.set(edge.to, (inputCount.get(edge.to) ?? 0) + 1);
  const handedOut = new Map<string, number>();

  const trunk = trunksOf(wire, placed);

  const boxes = [...placed.values()].map((entry) => {
    const size = sizeOf(entry.node);
    return { left: entry.x - size.width / 2, right: entry.x + size.width / 2, top: entry.y - size.height / 2, bottom: entry.y + size.height / 2 };
  });

  const geometry: Geometry = { boxes, trunk };
  const routed = wire.edges.flatMap((edge) => {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (from === undefined || to === undefined) return [];
    const index = handedOut.get(edge.to) ?? 0;
    handedOut.set(edge.to, index + 1);
    const pin = pinOf(to, index, inputCount.get(edge.to) ?? 1);
    const lane = to.y + LANE + index * LANE_STEP;
    return [{ ...edge, d: routeOf({ from, to, pin, lane }, geometry) }];
  });
  return junctionsOf(routed);
}

/** One straight run of a routed wire, as the path format writes it. */
interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** The corners and straight runs of a path, so one wire can be tested against another. */
function pointsOf(d: string): Array<[number, number]> {
  const numbers = (d.match(/-?\d+/g) ?? []).map(Number);
  const points: Array<[number, number]> = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) points.push([numbers[index] ?? 0, numbers[index + 1] ?? 0]);
  return points;
}

const isOn = (segment: Segment, [x, y]: readonly [number, number]): boolean =>
  segment.x1 === segment.x2
    ? x === segment.x1 && y >= Math.min(segment.y1, segment.y2) && y <= Math.max(segment.y1, segment.y2)
    : y === segment.y1 && x >= Math.min(segment.x1, segment.x2) && x <= Math.max(segment.x1, segment.x2);

/**
 * Where two wires meet: a corner of one wire that sits on a run of another is a connection,
 * and the drawing marks it with a dot the way the reference does. A corner with no other
 * wire through it is a bend, and crossing wires that only pass over each other are not
 * connected, so neither gets a dot.
 */
function junctionsOf(edges: readonly PlacedEdge[]): PlacedEdge[] {
  const runs = edges.map((edge) => {
    const points = pointsOf(edge.d);
    const segments: Segment[] = [];
    for (let index = 0; index + 1 < points.length; index += 1) {
      const [x1 = 0, y1 = 0] = points[index] ?? [];
      const [x2 = 0, y2 = 0] = points[index + 1] ?? [];
      segments.push({ x1, y1, x2, y2 });
    }
    // Only a corner can be dotted: the two ends land on a block's edge.
    return { edge, segments, corners: points.slice(1, -1) };
  });
  return runs.map(({ edge, corners }, index) => {
    const others = runs.filter((_, other) => other !== index).flatMap((run) => run.segments);
    const junction = corners.find((corner) => others.some((segment) => isOn(segment, corner)));
    return junction === undefined ? edge : { ...edge, junction };
  });
}

/**
 * Where each net's trunk runs: the vertical line in the gutter right of the column it
 * leaves. The wires of one net branch off a single trunk the way Vivado draws a fan-out,
 * instead of each starting its own staircase, and two nets never share one.
 */
function trunksOf(wire: SchematicWire, placed: Map<string, PlacedNode>): Map<string, number> {
  const halfOf = (entry: PlacedNode): number => sizeOf(entry.node).width / 2;
  const columnOf = (entry: PlacedNode): number => Math.round((entry.x - COLUMN_WIDTH / 2) / COLUMN_WIDTH);
  /** Where the empty gutter right of a column ends: the leftmost edge of anything past it. */
  const gutterEnd = (column: number): number => {
    const lefts = [...placed.values()].filter((entry) => columnOf(entry) > column).map((entry) => entry.x - halfOf(entry));
    return lefts.length === 0 ? (column + 1) * COLUMN_WIDTH : Math.min(...lefts);
  };

  const sources = [...new Set(wire.edges.map((edge) => edge.from))].filter((id) => placed.has(id));
  sources.sort((left, right) => {
    const from = placed.get(left);
    const to = placed.get(right);
    if (from === undefined || to === undefined) return left.localeCompare(right);
    return columnOf(from) - columnOf(to) || from.y - to.y || left.localeCompare(right);
  });

  const trunk = new Map<string, number>();
  const perColumn = new Map<number, number>();
  for (const id of sources) {
    const entry = placed.get(id);
    if (entry === undefined) continue;
    const column = columnOf(entry);
    const index = perColumn.get(column) ?? 0;
    perColumn.set(column, index + 1);
    trunk.set(id, Math.min(entry.x + halfOf(entry) + TRACK * (index + 1), gutterEnd(column) - TRACK / 2));
  }
  return trunk;
}


/** A wire's endpoints and the two numbers routing needs for it: its pin and its lane. */
interface RouteInput {
  readonly from: PlacedNode;
  readonly to: PlacedNode;
  readonly pin: number;
  readonly lane: number;
}

/** A block's outline in the pane's coordinates, for the runs that must not cross it. */
interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** What routing reads: the trunk of each net, and the blocks a run must not cross. */
interface Geometry {
  readonly boxes: ReadonlyArray<Box>;
  readonly trunk: ReadonlyMap<string, number>;
}
/** The point on a block's left edge a wire attaches to, one per input of the block. */
function pinOf(to: PlacedNode, index: number, pins: number): number {
  const height = sizeOf(to.node).height;
  return to.y - height / 2 + (height * (index + 1)) / (pins + 1);
}

/** Whether a straight run between two points passes through a block. */
function crossesBox({ from, to, boxes }: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly boxes: ReadonlyArray<Box> }): boolean {
  const left = Math.min(from[0], to[0]);
  const right = Math.max(from[0], to[0]);
  const top = Math.min(from[1], to[1]);
  const bottom = Math.max(from[1], to[1]);
  return boxes.some((box) => left < box.right && right > box.left && top < box.bottom && bottom > box.top);
}


/**
 * The path of one wire: out of the right edge of the block it reads, along the net's trunk
 * in the gutter, then a single turn down to the pin and straight into it. A fan-out shares
 * the trunk, so the wires read as one net branching rather than as paths drawn on top of
 * one another. Centre to centre would draw the wire across the blocks it joins, so the
 * trunk is the only place it turns — and where that turn would run a wire through a block,
 * the wire takes the empty band under the row instead and climbs its own track back in.
 */
function routeOf(wire: RouteInput, geometry: Geometry): string {
  const { from, to, pin: pinY, lane: laneY } = wire;
  const { boxes, trunk } = geometry;
  const points: Array<[number, number]> = [];
  const walk = (x: number, y: number): void => {
    const last = points[points.length - 1];
    if (last !== undefined && last[0] === Math.round(x) && last[1] === Math.round(y)) return;
    points.push([Math.round(x), Math.round(y)]);
  };

  const halfFrom = sizeOf(from.node).width / 2;
  const halfTo = sizeOf(to.node).width / 2;
  const source = from.x + halfFrom;
  const target = to.x - halfTo;
  const trunkX = trunk.get(from.node.id) ?? source;
  const entryX = target - TRACK;

  walk(source, from.y);
  // The straight run is the one the reference draws: out of the block, along the trunk,
  // then across at the pin's own row. It gives way to the empty band under the row only
  // when that row would otherwise carry the wire through a block.
  const clear =
    !crossesBox({ from: [trunkX, from.y], to: [trunkX, pinY], boxes }) &&
    !crossesBox({ from: [trunkX, pinY], to: [target, pinY], boxes });
  if (to.x > from.x && clear) {
    walk(trunkX, from.y);
    walk(trunkX, pinY);
  } else if (to.x > from.x) {
    walk(trunkX, from.y);
    walk(trunkX, laneY);
    walk(entryX, laneY);
    walk(entryX, pinY);
  } else {
    // Backwards (a counter reading its own next value): loop right of both blocks.
    walk(Math.max(trunkX, to.x + halfTo + TRACK), from.y);
    walk(Math.max(trunkX, to.x + halfTo + TRACK), laneY);
    walk(entryX, laneY);
    walk(entryX, pinY);
  }
  walk(target, pinY);
  return format(points);
}


/**
 * An `M`/`L` path through the given points, without the corners that turn nothing: a run
 * of three points on one line is one segment, so a path says where it bends and no more.
 */
function format(points: ReadonlyArray<readonly [number, number]>): string {
  const kept = points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (previous === undefined || next === undefined) return true;
    return !(
      (previous[0] === point[0] && point[0] === next[0]) ||
      (previous[1] === point[1] && point[1] === next[1])
    );
  });
  return kept.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

/** The text under a block's name: what it does, and how wide it is. */
export function nodeSummary(node: SchematicNode): string {
  const bits = `${node.width} bit${node.width === 1 ? '' : 's'}`;
  return node.direction === undefined ? `${node.op} · ${bits}` : `${node.direction.toUpperCase()} → ${node.op} · ${bits}`;
}

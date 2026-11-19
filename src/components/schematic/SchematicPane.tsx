// SPDX-License-Identifier: GPL-2.0-only
/**
 * The RTL schematic view (PRD.md § 3.4, § 7.2: RTL ANALYSIS → Open Elaborated Design →
 * Schematic): the elaborated design drawn the way Vivado draws a cell — a gate for an
 * `and`/`or`/`xor`/`not`, a labelled block for a port, a register, an adder or a mux —
 * with each wire leaving the edge of the block it reads and entering a pin on the block
 * that reads it. It fills the editor area the way the waveform view does, and a block
 * that has a source line opens that line.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { CloseButton } from '../workbench/CloseButton';
import { ScrollArea } from '../workbench/ScrollArea';
import { layoutSchematic, nodeSummary, outlineOf, shapeOf, sizeOf, type PlacedNode, type SchematicWire, type Shape } from './schematic';
import './SchematicPane.css';

export interface SchematicPaneProps {
  /** The backend's latest `SCHEMATIC` frame; null before one arrives. */
  schematic: SchematicWire | null;
  /** The step is running: the view says so instead of drawing an empty canvas. */
  busy: boolean;
  /** The click on a block with a source line. Absent when the block has none. */
  onOpenSource?: (file: string, line: number) => void;
  onClose: () => void;
}

type SchematicNode = SchematicWire['nodes'][number];
type OpenSource = (file: string, line: number) => void;

const KIND_LABEL: Readonly<Record<SchematicNode['kind'], string>> = {
  port: 'port',
  logic: 'logic',
  reg: 'register',
};

/** A labelled block is drawn inset by this much, and its two text lines sit here. */
const INSET = 8;
const NAME_Y = -2;
const OP_Y = 11;
/** A gate's label sits just outside its outline, above and below. */
const GATE_NAME_Y = 8;
const GATE_OP_Y = 14;
/** A gate's symbol, drawn from the module's pure geometry so the outline is pinned by a test. */
function Glyph({ shape }: { readonly shape: Exclude<Shape, 'box'> }) {
  const outline = outlineOf(shape);
  if (outline === undefined) return null;
  return (
    <>
      {/* The outline is the hit area too: that is where a wire attaches. */}
      <path className="sc-gate-shape" d={outline.path} />
      {outline.extra !== undefined && <path className="sc-gate-shape" d={outline.extra} />}
    </>
  );
}

/** The source line a block came from, when GHDL named one. */
function lineOf(node: SchematicNode): { file: string; line: number } | undefined {
  return node.file !== undefined && node.line !== undefined ? { file: node.file, line: node.line } : undefined;
}

/** What the block says on hover, and to a screen reader: its name, op, and source line. */
function titleOf(node: SchematicNode): string {
  const target = lineOf(node);
  const where = target === undefined ? KIND_LABEL[node.kind] : `${KIND_LABEL[node.kind]}, ${target.file}:${target.line}`;
  return `${node.name}: ${nodeSummary(node)} (${where})`;
}

/** Enter or Space activates a block the way a button does, since an `svg` group is not one. */
function keyHandler(open: (() => void) | undefined) {
  return open === undefined
    ? undefined
    : (event: KeyboardEvent<SVGGElement>): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
      };
}

/** A port or a register: a box with its name and its summary in it. */
function LabelBox({ node, width, height }: { readonly node: SchematicNode; readonly width: number; readonly height: number }) {
  return (
    <>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={4} />
      <text className="sc-node-name" x={-width / 2 + INSET} y={NAME_Y}>{node.name}</text>
      <text className="sc-node-op" x={-width / 2 + INSET} y={OP_Y}>{nodeSummary(node)}</text>
    </>
  );
}

/** An `and`/`or`/`xor`/`not` cell: its gate symbol, with the name above and the op below. */
function GateSymbol({ node, shape, height }: { readonly node: SchematicNode; readonly shape: Exclude<Shape, 'box'>; readonly height: number }) {
  return (
    <>
      <Glyph shape={shape} />
      <text className="sc-gate-name" x={0} y={-height / 2 - GATE_NAME_Y}>{node.name}</text>
      <text className="sc-gate-op" x={0} y={height / 2 + GATE_OP_Y}>{nodeSummary(node)}</text>
    </>
  );
}

/** One block: a gate symbol or a labelled box, and a click through to its source line. */
function NodeBox({ entry, onOpenSource }: { readonly entry: PlacedNode; readonly onOpenSource?: OpenSource }) {
  const { node, x, y } = entry;
  const target = lineOf(node);
  const shape = shapeOf(node);
  const { width, height } = sizeOf(node);
  const open = target === undefined || onOpenSource === undefined ? undefined : () => onOpenSource(target.file, target.line);
  const className = ['sc-node', `sc-node--${node.kind}`, shape === 'box' ? '' : 'sc-node--gate', open === undefined ? '' : 'sc-node--linked']
    .filter((name) => name !== '')
    .join(' ');
  const body: ReactNode = shape === 'box' ? <LabelBox node={node} width={width} height={height} /> : <GateSymbol node={node} shape={shape} height={height} />;
  return (
    <g
      className={className}
      transform={`translate(${x} ${y})`}
      role={open === undefined ? undefined : 'button'}
      tabIndex={open === undefined ? undefined : 0}
      onClick={open}
      onKeyDown={keyHandler(open)}
    >
      <title>{titleOf(node)}</title>
      {body}
    </g>
  );
}

/** What the canvas shows when there is no drawing: why not, in the student's terms. */
function emptyText(busy: boolean): string {
  return busy ? 'Elaborating the design…' : 'Run Open Elaborated Design first: the schematic is of a design that elaborated.';
}

/** Vivado's count line: what the elaborated design is made of, above the drawing. */
function Counts({ schematic }: { readonly schematic: SchematicWire }) {
  const inputs = schematic.nodes.filter((node) => node.direction === 'in').length;
  const outputs = schematic.nodes.filter((node) => node.direction === 'out').length;
  return (
    <span className="sc-counts">
      {schematic.nodes.length - inputs - outputs} cells · {inputs + outputs} I/O ports · {schematic.edges.length} nets
    </span>
  );
}

/** The drawing itself: the wires under the blocks, so a block covers the wire's elbow. */
function Canvas({ schematic, onOpenSource }: { readonly schematic: SchematicWire; readonly onOpenSource?: OpenSource }) {
  const layout = layoutSchematic(schematic);
  return (
    <div className="sc-canvas">
      <ScrollArea>
        <svg width={layout.width} height={layout.height} role="img" aria-label={`RTL schematic of ${schematic.top}`}>
          <g className="sc-edges">
            {layout.edges.map((edge) => (
              <path key={`${edge.from}->${edge.to}`} d={edge.d} />
            ))}
            {layout.edges.map((edge) =>
              edge.junction === undefined ? undefined : (
                <circle key={`junction-${edge.from}->${edge.to}`} className="sc-junction" cx={edge.junction[0]} cy={edge.junction[1]} r={2.5} />
              ),
            )}
          </g>
          {layout.nodes.map((entry) => (
            <NodeBox key={entry.node.id} entry={entry} onOpenSource={onOpenSource} />
          ))}
        </svg>
      </ScrollArea>
    </div>
  );
}

export function SchematicPane({ schematic, busy, onOpenSource, onClose }: SchematicPaneProps) {
  return (
    <section className="sc-pane" aria-label="RTL schematic">
      <header className="sc-head">
        <span className="sc-title">{schematic === null ? 'Open Elaborated Design' : schematic.top}</span>
        <span className="sc-subtitle">Schematic</span>
        {schematic !== null && <Counts schematic={schematic} />}
        <CloseButton label="Close the schematic" hint="Back to the code (Esc)" onClick={onClose} />
      </header>
      {schematic === null ? <p className="sc-note">{emptyText(busy)}</p> : <Canvas schematic={schematic} onOpenSource={onOpenSource} />}
      {schematic?.omitted !== undefined && (
        <p className="sc-note">{schematic.omitted} more blocks are not drawn: the netlist is too large for one view.</p>
      )}
    </section>
  );
}

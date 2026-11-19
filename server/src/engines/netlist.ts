// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy
/**
 * The RTL schematic's data, read out of the netlist GHDL's synthesiser writes
 * (`ghdl synth --out=vhdl`, PRD.md § 3.4: RTL ANALYSIS → Open Elaborated Design →
 * Schematic).
 *
 * Why the VHDL netlist and not `--out=dot`: the DOT output is bit-blasted — one
 * gate per bit — so an 8-bit ALU arrives as ~150 nodes, which is the *synthesised*
 * view and unreadable as an RTL block diagram. The VHDL netlist keeps one
 * statement per source assignment, at word level, which is the shape a student
 * can check against their own code. Each statement also carries the `-- file:line`
 * comment GHDL writes above it, so a block can point back at its source line.
 *
 * The netlist is not VHDL a human wrote: GHDL renames ports to `wrap_<port>`,
 * invents `n<number>` signals, and lowers `+`/`and`/`case` onto them. This reader
 * collapses the renames so the ports stay recognisable, and labels each remaining
 * assignment by the operator it came from.
 */

/** One block of the schematic: a design signal and what drives it. */
export interface SchematicNode {
  /** The signal as the netlist names it, after alias collapsing. */
  readonly id: string;
  /** What the block shows: the port's name, or `n<number>` for an invented signal. */
  readonly name: string;
  readonly kind: 'port' | 'logic' | 'reg';
  /** The operator the block stands for: `IN`, `OUT`, `ADD`, `MUX`, `REG`, … */
  readonly op: string;
  /** Bits. */
  readonly width: number;
  /** Direction, for the ports only. */
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

/** The whole drawing. */
export interface SchematicWire {
  readonly top: string;
  readonly nodes: readonly SchematicNode[];
  readonly edges: readonly SchematicEdge[];
}

/** A signal's kind, from its declaration. */
interface Decl {
  readonly width: number;
  readonly direction?: 'in' | 'out' | 'inout';
}

/** `std_logic_vector (7 downto 0)` → 8, `std_logic_vector (0 to 3)` → 4, `std_logic` → 1. */
function widthOf(type: string): number {
  const range = /\(\s*(\d+)\s+(?:downto|to)\s+(\d+)\s*\)/.exec(type);
  if (range === null) return 1;
  const left = Number(range[1]);
  const right = Number(range[2]);
  return Math.abs(left - right) + 1;
}

/**
 * What a right-hand side computes, in the words the block shows. Ordered: the
 * lowering rewrites most operators onto `unsigned(...)`, so the operator itself is
 * matched before the call that wraps it.
 */
function operatorOf(rhs: string): string {
  if (/\bwhen\b[\s\S]*\belse\b/.test(rhs)) return 'MUX';
  if (/^\s*with\b[\s\S]*\bselect\b/.test(rhs) || /\bwhen\s+(?:"|others)/.test(rhs)) return 'MUX';
  if (/[^-]\+\s*unsigned|unsigned\s*\([^)]*\)\s*\+/.test(rhs) || /\+/.test(rhs)) return 'ADD';
  if (/-/.test(rhs)) return 'SUB';
  if (/&/.test(rhs)) return 'CONCAT';
  if (/\bnot\b/.test(rhs)) return 'NOT';
  if (/\band\b/.test(rhs)) return 'AND';
  if (/\bor\b/.test(rhs)) return 'OR';
  if (/\bxor\b/.test(rhs)) return 'XOR';
  if (/=/.test(rhs)) return 'EQ';
  return 'LOGIC';
}

/** Every identifier the expression reads, in order of first appearance. */
function identifiersIn(expression: string): readonly string[] {
  const found: string[] = [];
  const pattern = /[A-Za-z_]\w*/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(expression)) !== null) {
    const word = match[0];
    if (!found.includes(word)) found.push(word);
  }
  return found;
}

/** A concurrent statement: its target, its right-hand side, and where it came from. */
interface Statement {
  readonly target: string;
  readonly rhs: string;
  readonly file?: string;
  readonly line?: number;
  readonly clocked: boolean;
}

/** Comments that only wrap another statement are dropped; the ones carrying a line stay. */
const SOURCE_COMMENT = /^\s*--\s*(\S+\.vhd[l]?):(\d+)(?::\d+)?\s*$/i;

/**
 * Splits the architecture body into statements. A statement ends at a `;` that is
 * not inside parentheses, so the `with … select` and `when … else` forms that GHDL
 * spreads over several lines arrive whole.
 */
/** Drops a trailing `--` comment, leaving a `--` inside a quoted literal alone. */
function stripComment(line: string): string {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') quoted = !quoted;
    else if (!quoted && character === '-' && line[index + 1] === '-') return line.slice(0, index);
  }
  return line;
}

function statements(body: string): readonly Statement[] {
  const result: Statement[] = [];
  let source: { file: string; line: number } | undefined;
  let clocked = false;
  let buffer = '';
  let depth = 0;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\r$/, '');
    // The provenance comment is read before the line is stripped: it *is* a comment.
    const comment = SOURCE_COMMENT.exec(line);
    if (comment !== null) {
      source = { file: comment[1] as string, line: Number(comment[2]) };
      continue;
    }
    const trimmed = stripComment(line).trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('process')) {
      clocked = false;
      continue;
    }
    if (/^if\s+rising_edge\s*\(/i.test(trimmed)) {
      clocked = true;
      continue;
    }
    if (/^(begin|end\s+if|else|elsif|end\s+process)\b/i.test(trimmed)) continue;
    buffer += (buffer === '' ? '' : ' ') + trimmed;
    for (const character of trimmed) {
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
    }
    if (depth > 0 || !buffer.endsWith(';')) continue;
    const text = buffer.slice(0, -1).trim();
    buffer = '';
    depth = 0;
    const arrow = text.indexOf('<=');
    if (arrow === -1) continue;
    const target = text.slice(0, arrow).trim();
    if (!/^[A-Za-z_]\w*$/.test(target)) continue;
    result.push({ target, rhs: text.slice(arrow + 2).trim(), ...source, clocked });
    if (!clocked) source = undefined;
  }
  return result;
}

/**
 * Reads a synthesised netlist into the schematic's nodes and edges. Pure: the
 * caller supplies the netlist text, so the rules above are pinned by a unit test
 * rather than by whatever GHDL happened to print.
 */
export function parseNetlist(vhdl: string, top: string): SchematicWire {
  const declarations = new Map<string, Decl>();
  const declarationsOnly = /^\s*(?:subtype\s+(\w+)\s+is\s+(.+?);|signal\s+([\w, ]+?)\s*:\s*(.+?);|(\w+(?:\s*,\s*\w+)*)\s*:\s*(in|out|inout)\s+(.+?)(?:;|$))/gim;
  let declared: RegExpExecArray | null;
  while ((declared = declarationsOnly.exec(vhdl)) !== null) {
    const [, , subtypeBody, signalNames, signalType, portNames, direction, portType] = declared;
    if (subtypeBody !== undefined && signalNames === undefined) continue;
    const names = (signalNames ?? portNames ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => /^[A-Za-z_]\w*$/.test(name));
    const type = (signalType ?? portType ?? '').trim();
    if (type === '') continue;
    const width = widthOf(type);
    for (const name of names) {
      declarations.set(name, { width, ...(direction === undefined ? {} : { direction: direction as Decl['direction'] }) });
    }
    void subtypeBody;
  }
  const architecture = vhdl.slice(vhdl.search(/^\s*architecture\b/im));
  const parsed = statements(architecture);

  // GHDL's renames: every port gets a working copy named `wrap_<port>`, and the port is
  // handed to it (`wrap_a <= typ_wrap_a(a)`) and back (`y <= std_logic_vector(wrap_y)`).
  // Those are not logic, they are the same signal; collapsing them leaves the port's own
  // name on every block that touches it.
  const alias = new Map<string, string>();
  for (const name of declarations.keys()) {
    if (!name.startsWith('wrap_')) continue;
    const port = name.slice('wrap_'.length);
    if (declarations.get(port)?.direction !== undefined) alias.set(name, port);
  }
  const resolve = (name: string): string => alias.get(name) ?? name;
  const nodes = new Map<string, SchematicNode>();
  for (const [name, declaration] of declarations) {
    const port = declaration.direction !== undefined;
    nodes.set(name, {
      id: name,
      name,
      kind: port ? 'port' : 'logic',
      op: port ? (declaration.direction === 'out' ? 'OUT' : declaration.direction === 'in' ? 'IN' : 'INOUT') : 'LOGIC',
      width: declaration.width,
      ...(declaration.direction === undefined ? {} : { direction: declaration.direction }),
    });
  }

  const edges: SchematicEdge[] = [];
  const addEdge = (from: string, to: string): void => {
    if (from === to) return;
    if (edges.some((edge) => edge.from === from && edge.to === to)) return;
    edges.push({ from, to });
  };

  for (const statement of parsed) {
    const target = resolve(statement.target);
    const reads = identifiersIn(statement.rhs)
      .map(resolve)
      .filter((name) => nodes.has(name) && name !== target);
    if (reads.length === 0) continue;
    const current = nodes.get(target);
    if (current === undefined) continue;
    // A port's block already exists; an assignment into it is the output's driver.
    if (current.kind === 'port' && current.direction !== 'out') continue;
    const op = statement.clocked ? 'REG' : operatorOf(statement.rhs);
    nodes.set(target, {
      ...current,
      ...(current.direction === 'out' ? { op: 'OUT' } : { op }),
      ...(current.kind === 'port' ? {} : { kind: statement.clocked ? 'reg' : 'logic' }),
      ...(statement.file === undefined ? {} : { file: statement.file }),
      ...(statement.line === undefined ? {} : { line: statement.line }),
    });
    for (const from of reads) addEdge(from, target);
  }

  const drawn = new Set<string>();
  for (const edge of edges) {
    drawn.add(edge.from);
    drawn.add(edge.to);
  }
  return {
    top,
    nodes: [...nodes.values()].filter((node) => node.kind === 'port' || drawn.has(node.id)),
    edges,
  };
}

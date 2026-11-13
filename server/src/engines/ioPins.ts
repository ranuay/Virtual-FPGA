// SPDX-License-Identifier: GPL-2.0-only
/**
 * Which board port each design port is wired to (PRD.md § 7.6): the name match the
 * testbenches always made, plus the pin the student chose instead. Pure — no files, no
 * simulator — so the rules can be tested on their own and both languages get the same
 * answer.
 *
 * § 7.6's last bullet is the reason this exists: the assignment must decide the wiring,
 * not just fill a table. A pinned port connects to the board port the student picked and
 * leaves the name-matched one free; without a pin the old name match still applies, which
 * is why a design that needs none behaves exactly as before.
 */
import { boardBindings, type BoardBinding, type BoardIo } from './boardPorts.js';

/** A port of the student's top, as far as pinning cares. */
export interface PinPort {
  /** As the design spells it. */
  readonly name: string;
  /** `in`/`out`/`inout`; undefined when the reader could not tell. */
  readonly direction?: string;
  /** Bits; undefined when HDLBoard cannot read the subtype. */
  readonly width?: number;
}

/** One wire: the design port, as spelled, and the board port it drives. */
export interface ConnectPort {
  /** The design port's name, lower case, for matching. */
  readonly key: string;
  /** As the design spells it. */
  readonly name: string;
  readonly binding: BoardBinding;
}

export interface ConnectResult {
  /** In board-table order, which is the order both testbenches connect ports in. */
  readonly connected: readonly ConnectPort[];
  /** § 7.6's validation: a pin on no such board port, a duplicate, a direction or width that does not fit. */
  readonly errors: readonly string[];
}

/**
 * One board port a design port may be pinned to — or, for a multiplexed display whose
 * segments the board spells as separate scalars (`CA`, `CB`, …), the whole word, so one
 * 8-bit design port can drive seven segments and the decimal point (§ 7.6).
 */
export interface PinChoice {
  /** What `FLOW-PIN` carries: the board port's key, or the word's. */
  readonly key: string;
  /** What the table shows: `CA`, or `CA…DP` for the word. */
  readonly label: string;
  /** The board ports its bits land on, least significant first. */
  readonly bits: readonly BoardBinding[];
}

/**
 * The student's choice, `design port name (lower case) -> board port name (lower case)`.
 * A design port without an entry is matched by name, as before.
 */
export type PinMap = ReadonlyMap<string, string>;

/**
 * The board ports a pin may name, each alone — plus, for a multiplexed display, the
 * segment word with and without the decimal point, so a 7-bit and an 8-bit design port
 * both have a choice.
 */
export function pinTargets(board: BoardIo): readonly PinChoice[] {
  const singles: PinChoice[] = boardBindings(board).map((binding) => ({ key: binding.key, label: binding.name, bits: [binding] }));
  const keys = new Set(singles.map((single) => single.key));
  const words: PinChoice[] = [];
  for (const word of segmentWords(board)) {
    // A board that already names a port `CA…DP` keeps it: two choices may not share a key.
    if (keys.has(word.key)) continue;
    keys.add(word.key);
    words.push(word);
  }
  return [...singles, ...words];
}

/**
 * The multiplexed display's segments as one word, least significant bit first: `CA…CG` and,
 * when the board has a decimal point, `CA…DP` — a 7-bit design port and an 8-bit one each
 * have a choice. A board that already spells the segments as one vector needs neither: its
 * own port is the word.
 */
function segmentWords(board: BoardIo): readonly PinChoice[] {
  const displays = board.sevenSegment;
  if (displays.kind !== 'multiplexed' || displays.segments.kind !== 'scalars') return [];
  const rows = boardBindings(board);
  const segments = rows.filter((binding) => binding.role.startsWith('segment'));
  const point = rows.find((binding) => binding.role === 'decimalPoint');
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (first === undefined || last === undefined || segments.length < 2) return [];
  const words: PinChoice[] = [{ key: `${first.name}…${last.name}`.toLowerCase(), label: `${first.name}…${last.name}`, bits: segments }];
  if (point !== undefined) {
    const label = `${first.name}…${point.name}`;
    words.push({ key: label.toLowerCase(), label, bits: [...segments, point] });
  }
  return words;
}

const bits = (width: number): string => `${width} bit${width === 1 ? '' : 's'}`;

const choiceWidth = (choice: PinChoice): number => choice.bits.reduce((sum, binding) => sum + binding.width, 0);

/** § 7.6: an output cannot drive a switch. `inout` is taken as either. */
function directionError(port: PinPort, choice: PinChoice): string | undefined {
  const direction = choice.bits[0]?.direction;
  if (port.direction === undefined || port.direction === 'inout' || port.direction === direction) return undefined;
  const wanted = direction === 'in' ? 'an input' : 'an output';
  return `${port.name} is ${port.direction === 'in' ? 'an input' : 'an output'}, and ${choice.label} is ${wanted} on this board.`;
}

function widthError(port: PinPort, choice: PinChoice): string | undefined {
  const width = choiceWidth(choice);
  if (port.width === undefined || port.width === width) return undefined;
  return `${port.name} is ${bits(port.width)}, and ${choice.label} is ${bits(width)} on this board.`;
}

/**
 * The wires of a board run: the pins first (they win over the name match), then the name
 * match for every board port no pin claimed. An invalid pin is reported and left out
 * rather than wired wrongly, so the port stays unconnected and Generate Bitstream's DRC
 * names it (§ 7.5).
 *
 * A pin on a word (the display's segments) is one wire per bit, all with the same design
 * port: the testbench generators join a run of wires for one port into one association.
 */
export function connectPorts(ports: readonly PinPort[], board: BoardIo, pins: PinMap = new Map()): ConnectResult {
  const bindings = boardBindings(board);
  const targets = new Map(pinTargets(board).map((choice) => [choice.key, choice]));
  const declared = new Map(ports.map((port) => [port.name.toLowerCase(), port]));
  /** Board key -> the design port pinned to it, and § 7.6's complaints about the rest. */
  const { pinnedTo, errors } = applyPins(declared, targets, pins);

  const moved = new Set([...pinnedTo.values()].map((port) => port.name.toLowerCase()));
  const connected = bindings.flatMap((binding): ConnectPort[] => {
    const pinned = pinnedTo.get(binding.key);
    if (pinned !== undefined) return [{ key: pinned.name.toLowerCase(), name: pinned.name, binding }];
    const match = declared.get(binding.key);
    // A port a pin moved somewhere else must not keep the wire it moved off.
    if (match === undefined || moved.has(binding.key)) return [];
    return [{ key: match.name.toLowerCase(), name: match.name, binding }];
  });
  return { connected, errors };
}

/** The pins that survive § 7.6's checks, as board key -> the port pinned to it. */
function applyPins(
  declared: ReadonlyMap<string, PinPort>,
  targets: ReadonlyMap<string, PinChoice>,
  pins: PinMap,
): { pinnedTo: Map<string, PinPort>; errors: string[] } {
  const errors: string[] = [];
  const pinnedTo = new Map<string, PinPort>();
  for (const [portKey, pin] of pins) {
    const port = declared.get(portKey);
    // A pin for a port the design no longer has is stale, not wrong: the source edit
    // removed the port, and the choice goes with it.
    if (port === undefined) continue;
    const choice = targets.get(pin);
    if (choice === undefined) {
      errors.push(`${port.name} is pinned to ${pin}, which this board does not have.`);
      continue;
    }
    const clash = choice.bits.find((binding) => pinnedTo.has(binding.key));
    if (clash !== undefined) {
      errors.push(`${clash.name} is assigned to more than one port.`);
      continue;
    }
    const problem = directionError(port, choice) ?? widthError(port, choice);
    if (problem !== undefined) {
      errors.push(problem);
      continue;
    }
    for (const binding of choice.bits) pinnedTo.set(binding.key, port);
  }
  return { pinnedTo, errors };
}

/** The board ports a pin for `port` may go on: § 7.6's direction and width rules. */
export function pinChoices(port: PinPort, board: BoardIo): readonly PinChoice[] {
  return pinTargets(board).filter((choice) => directionError(port, choice) === undefined && widthError(port, choice) === undefined);
}

/** A run of wires for one design port: `bits` is one board port, or a word's bits, LSB first. */
export interface PortWire {
  readonly key: string;
  readonly name: string;
  readonly bits: readonly BoardBinding[];
}

/** `connected` as one wire per design port, in board-table order (a word pin stays one wire). */
export function portWires(connected: readonly ConnectPort[]): readonly PortWire[] {
  const wires: PortWire[] = [];
  for (const { key, name, binding } of connected) {
    const last = wires[wires.length - 1];
    if (last !== undefined && last.key === key) wires[wires.length - 1] = { key, name, bits: [...last.bits, binding] };
    else wires.push({ key, name, bits: [binding] });
  }
  return wires;
}

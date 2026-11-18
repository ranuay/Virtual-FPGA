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
 * The student's choice, `design port name (lower case) -> board port (lower case)`.
 * A design port without an entry is matched by name, as before.
 *
 * A handout's XDC pins individual bits, which no single board port names (`a[0]` on
 * `SW[0]`, `pos_seg[3]` on `AN[3]`), so an entry may also be a comma-separated list of
 * bit keys in the design port's own bit order: `sw[0],sw[1],sw[2]`. The order is the
 * port's, not the board's, because `sel[0]` on `SW[15]` is how the Bab 7 handout pins it.
 */
export type PinMap = ReadonlyMap<string, string>;

/** A board port as one bit: `SW` width 16 gives `sw[0]`…`sw[15]`; a scalar is its own bit. */
export interface BoardBit {
  /** What a bit pin names: `sw[3]`, or `ca` for a one-bit port. */
  readonly key: string;
  /** The binding to connect, with `index` set for a vector's bit. */
  readonly binding: BoardBinding;
}

/** Every bit of every board port, in board-table order. */
export function boardBits(board: BoardIo): readonly BoardBit[] {
  return boardBindings(board).flatMap((binding) => {
    if (binding.index !== undefined || binding.width === 1) return [{ key: binding.key, binding }];
    return Array.from({ length: binding.width }, (_, index) => ({
      key: `${binding.key}[${index}]`,
      binding: { ...binding, index },
    }));
  });
}

/**
 * What a pin resolves to: the wires to make, or why § 7.6 refuses it. `kind` is `port` for
 * a board port or a display word — whose bits the board table already lists in order — and
 * `bits` for a comma-separated list of bits, whose order the pin itself decides.
 */
export type PinResolution =
  | { readonly ok: true; readonly kind: 'port' | 'bits'; readonly label: string; readonly bits: readonly BoardBinding[]; readonly width: number }
  | { readonly ok: false; readonly reason: string };

/**
 * `pin` as the wires it makes. A board port's own key (or a display word's) is one wire; a
 * comma-separated list of bit keys is one wire per bit, in the order written.
 */
export function resolvePin(pin: string, board: BoardIo): PinResolution {
  const choice = pinTargets(board).find((candidate) => candidate.key === pin);
  if (choice !== undefined) return { ok: true, kind: 'port', label: choice.label, bits: choice.bits, width: choiceWidth(choice) };
  const wanted = pin.split(',').map((part) => part.trim());
  if (wanted.some((part) => part === '')) return { ok: false, reason: `${pin} names no board bit.` };
  const bits = new Map(boardBits(board).map((bit) => [bit.key, bit.binding]));
  const resolved: BoardBinding[] = [];
  for (const part of wanted) {
    const binding = bits.get(part);
    if (binding === undefined) return { ok: false, reason: `${part} is not a board bit on this board.` };
    if (resolved.some((taken) => bitKeyOf(taken) === part)) return { ok: false, reason: `${part} is pinned to more than one bit.` };
    resolved.push(binding);
  }
  return { ok: true, kind: 'bits', label: wanted.join(','), bits: resolved, width: resolved.length };
}

/** The bit key of one binding: `sw[3]` for a vector's bit, `ca` for a scalar. */
function bitKeyOf(binding: BoardBinding): string {
  return binding.index === undefined ? binding.key : `${binding.key}[${binding.index}]`;
}

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
/** What § 7.6's checks need to know about the thing a pin lands on. */
interface PinSpan {
  readonly label: string;
  readonly bits: readonly BoardBinding[];
  readonly width: number;
}
/** § 7.6: an output cannot drive a switch. `inout` is taken as either. */
function directionError(port: PinPort, span: PinSpan): string | undefined {
  const direction = span.bits[0]?.direction;
  if (port.direction === undefined || port.direction === 'inout' || port.direction === direction) return undefined;
  const wanted = direction === 'in' ? 'an input' : 'an output';
  return `${port.name} is ${port.direction === 'in' ? 'an input' : 'an output'}, and ${span.label} is ${wanted} on this board.`;
}
function widthError(port: PinPort, span: PinSpan): string | undefined {
  if (port.width === undefined || port.width === span.width) return undefined;
  return `${port.name} is ${bits(port.width)}, and ${span.label} is ${bits(span.width)} on this board.`;
}

/**
 * The wires of a board run: the pins first (they win over the name match), then the name
 * match for every board port no pin claimed. An invalid pin is reported and left out
 * rather than wired wrongly, so the port stays unconnected and Generate Bitstream's DRC
 * names it (§ 7.5).
 *
 * A pin on a word (the display's segments) is one wire per bit, all with the same design
 * port: the testbench generators join a run of wires for one port into one association.
 * A pin on individual bits (a handout's XDC: `a[0]` on `SW[0]`) is the same shape, emitted
 * after the board-order wires so that its bits stay in the order the pin wrote them —
 * `sel[0]` on `SW[15]` comes before `sel[1]` on `SW[14]`, which board order would reverse.
 */
export function connectPorts(ports: readonly PinPort[], board: BoardIo, pins: PinMap = new Map()): ConnectResult {
  const bindings = boardBindings(board);
  const declared = new Map(ports.map((port) => [port.name.toLowerCase(), port]));
  const { pinnedTo, bitWires, bitClaimed, claimed, errors } = applyPins(declared, board, pins);
  /** A port a pin moved somewhere else must not keep the wire it moved off. */
  const moved = new Set([...pinnedTo.values()].map((port) => port.name.toLowerCase()));
  const connected = bindings.flatMap((binding): ConnectPort[] => {
    // A bit a pin listed on its own is in `bitWires`, in the order the pin wrote it: the
    // board-order run would attach it a second time, which VHDL reads as a duplicate
    // association for one formal (`led_seg(8) => dp_sig` twice).
    if (bitClaimed.has(binding.key)) return [];
    const pinned = pinnedTo.get(binding.key);
    if (pinned !== undefined) return [{ key: pinned.name.toLowerCase(), name: pinned.name, binding }];
    const match = declared.get(binding.key);
    // A board port whose bits a pin claimed is wired by those pins, not by the name match.
    if (match === undefined || moved.has(binding.key) || claimed.has(binding.key)) return [];
    return [{ key: match.name.toLowerCase(), name: match.name, binding }];
  });
  return { connected: [...connected, ...bitWires], errors };
}
/** The first key of `keys` another pin already took, which § 7.6 refuses. */
function takenClash(keys: readonly string[], taken: ReadonlySet<string>): string | undefined {
  return keys.find((key) => taken.has(key));
}

/** `resolution`'s keys: a board port or word is keyed by its own key, a bit list per bit. */
function resolutionKeys(resolution: Extract<PinResolution, { ok: true }>): string[] {
  return resolution.kind === 'port' ? resolution.bits.map((binding) => binding.key) : resolution.bits.map(bitKeyOf);
}

/** What one pin means for the board: the keys it takes, or why § 7.6 refused it. */
type PinCheck = { readonly keys: string[]; readonly resolution: Extract<PinResolution, { ok: true }> } | { readonly error: string };

/**
 * Whether `pin` may wire `port` on `board`, given the keys other pins already took, or why it
 * may not: a board port the board does not have, a key taken twice, a direction/width mismatch.
 */
function checkPin(port: PinPort, pin: string, { board, taken }: { readonly board: BoardIo; readonly taken: ReadonlySet<string> }): PinCheck {
  const resolution = resolvePin(pin, board);
  if (!resolution.ok) return { error: `${port.name} is pinned to ${pin}, which this board does not have.` };
  const keys = resolutionKeys(resolution);
  const clash = takenClash(keys, taken);
  if (clash !== undefined) return { error: `${clash} is assigned to more than one port.` };
  const problem = directionError(port, resolution) ?? widthError(port, resolution);
  return problem === undefined ? { keys, resolution } : { error: problem };
}

/** What `applyPins` is building, so `recordPin` can add to it without a graph of references. */
interface PinTable {
  readonly pinnedTo: Map<string, PinPort>;
  readonly bitWires: ConnectPort[];
  /** The board bits a bit-list pin wired on its own, which board order must not wire again. */
  readonly bitClaimed: Set<string>;
  readonly claimed: Set<string>;
  readonly taken: Set<string>;
}

/** Books `check`'s keys onto `port`, and its bit wires when the pin named bits one at a time. */
function recordPin(check: Extract<PinCheck, { keys: string[] }>, port: PinPort, table: PinTable): void {
  for (const key of check.keys) {
    table.taken.add(key);
    table.pinnedTo.set(key, port);
  }
  for (const binding of check.resolution.bits) table.claimed.add(binding.key);
  // A word's bits sit next to each other in the board table, so board order keeps them in the
  // port's order; individual bits need not (`sel[0]` on `SW[15]`), so they are listed.
  if (check.resolution.kind !== 'bits') return;
  table.bitWires.push(...check.resolution.bits.map((binding) => ({ key: port.name.toLowerCase(), name: port.name, binding })));
  for (const binding of check.resolution.bits) table.bitClaimed.add(binding.key);
}

/**
 * The pins that survive § 7.6's checks, as board bit key -> the port pinned to it. A pin on
 * a word or a whole board port lands under that port's own key; a pin on bits lands under
 * `sw[3]`, and its wire is returned separately because board order cannot express it.
 */
function applyPins(
  declared: ReadonlyMap<string, PinPort>,
  board: BoardIo,
  pins: PinMap,
): { pinnedTo: Map<string, PinPort>; bitWires: ConnectPort[]; bitClaimed: Set<string>; claimed: Set<string>; errors: string[] } {
  const errors: string[] = [];
  const table: PinTable = {
    pinnedTo: new Map(),
    bitWires: [],
    bitClaimed: new Set(),
    claimed: new Set(),
    taken: new Set(),
  };
  for (const [portKey, pin] of pins) {
    // A pin for a port the design no longer has is stale, not wrong: the source edit
    // removed the port, and the choice goes with it.
    const port = declared.get(portKey);
    if (port === undefined) continue;
    const check = checkPin(port, pin, { board, taken: table.taken });
    if ('error' in check) errors.push(check.error);
    else recordPin(check, port, table);
  }
  return { ...table, errors };
}
/** The board ports a pin for `port` may go on: § 7.6's direction and width rules. */
export function pinChoices(port: PinPort, board: BoardIo): readonly PinChoice[] {
  return pinTargets(board).filter(
    (choice) => directionError(port, { ...choice, width: choiceWidth(choice) }) === undefined && widthError(port, { ...choice, width: choiceWidth(choice) }) === undefined,
  );
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

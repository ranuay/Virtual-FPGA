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
 * The student's choice, `design port name (lower case) -> board port name (lower case)`.
 * A design port without an entry is matched by name, as before.
 */
export type PinMap = ReadonlyMap<string, string>;

/** § 7.6: an output cannot drive a switch. `inout` is taken as either. */
function directionError(port: PinPort, binding: BoardBinding): string | undefined {
  if (port.direction === undefined || port.direction === 'inout' || port.direction === binding.direction) return undefined;
  const wanted = binding.direction === 'in' ? 'an input' : 'an output';
  return `${port.name} is ${port.direction === 'in' ? 'an input' : 'an output'}, and ${binding.name} is ${wanted} on this board.`;
}

const bits = (width: number): string => `${width} bit${width === 1 ? '' : 's'}`;

function widthError(port: PinPort, binding: BoardBinding): string | undefined {
  if (port.width === undefined || port.width === binding.width) return undefined;
  return `${port.name} is ${bits(port.width)}, and ${binding.name} is ${bits(binding.width)} on this board.`;
}

/**
 * The wires of a board run: the pins first (they win over the name match), then the name
 * match for every board port no pin claimed. An invalid pin is reported and left out
 * rather than wired wrongly, so the port stays unconnected and Generate Bitstream's DRC
 * names it (§ 7.5).
 */
export function connectPorts(ports: readonly PinPort[], board: BoardIo, pins: PinMap = new Map()): ConnectResult {
  const bindings = boardBindings(board);
  const byKey = new Map(bindings.map((binding) => [binding.key, binding]));
  const declared = new Map(ports.map((port) => [port.name.toLowerCase(), port]));
  /** Board key -> the design port pinned to it, and § 7.6's complaints about the rest. */
  const { pinnedTo, errors } = applyPins(declared, byKey, pins);

  const moved = new Set([...pinnedTo.values()].map((port) => port.name.toLowerCase()));
  const connected = bindings.flatMap((binding) => {
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
function applyPins(declared: ReadonlyMap<string, PinPort>, byKey: ReadonlyMap<string, BoardBinding>, pins: PinMap): { pinnedTo: Map<string, PinPort>; errors: string[] } {
  const errors: string[] = [];
  const pinnedTo = new Map<string, PinPort>();
  for (const [portKey, boardKey] of pins) {
    const port = declared.get(portKey);
    // A pin for a port the design no longer has is stale, not wrong: the source edit
    // removed the port, and the choice goes with it.
    if (port === undefined) continue;
    const binding = byKey.get(boardKey);
    if (binding === undefined) {
      errors.push(`${port.name} is pinned to ${boardKey}, which this board does not have.`);
      continue;
    }
    if (pinnedTo.has(binding.key)) {
      errors.push(`${binding.name} is assigned to more than one port.`);
      continue;
    }
    const problem = directionError(port, binding) ?? widthError(port, binding);
    if (problem !== undefined) {
      errors.push(problem);
      continue;
    }
    pinnedTo.set(binding.key, port);
  }
  return { pinnedTo, errors };
}

/** The board ports a pin for `port` may go on: § 7.6's direction and width rules. */
export function pinChoices(port: PinPort, board: BoardIo): readonly BoardBinding[] {
  return boardBindings(board).filter((binding) => directionError(port, binding) === undefined && widthError(port, binding) === undefined);
}
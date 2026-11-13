// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * A board's `pins` (PRD.md § 4.2, § 7.6): the package pin of every bit of every port
 * that has a part on the board, so I/O Planning can show the pin a student would wire
 * on the real board.
 *
 *   "pins": { "CLK100MHZ": ["E3"], "SW": ["J15", "L16", …], "AN": ["J17", …] }
 *
 * One entry per bit, least significant first, exactly as the vendor's master XDC lists
 * them. A board without a pin table loads and runs as before; I/O Planning then shows
 * only the board port.
 */

import { isObject } from '../project/jsonValue';
import { fail, quoted } from './boardFileReader';
import type { BoardPins, BoardPorts, PortGroup } from './types';

/** A vendor pin name: `E3`, `J15`, `AB12`. */
const PACKAGE_PIN = /^[A-Z]{1,2}\d{1,2}$/;

/** The pins of each port of `ports`, by the name the board spells; throws on the first problem. */
export function readPins(value: unknown, ports: BoardPorts): BoardPins {
  if (value === undefined) return {};
  if (!isObject(value)) fail('pins must be an object of port name to pin list', 'pins');
  const widths = pinWidths(ports);
  const seen = new Map<string, string>();
  const pins: Record<string, readonly string[]> = {};
  for (const [name, list] of Object.entries(value)) {
    const port = [...widths.keys()].find((key) => key.toLowerCase() === name.toLowerCase());
    if (port === undefined) {
      fail(`pins.${name} is not a port of this board (the ports are ${[...widths.keys()].join(', ')})`, `pins.${name}`);
    }
    pins[port] = readBits(name, list, widths.get(port) ?? 1).map((pin, index) => {
      const path = `pins.${name}[${index}]`;
      const other = seen.get(pin);
      if (other !== undefined) fail(`${path} ${pin} is also ${other} on this board`, path);
      seen.set(pin, port);
      return pin;
    });
  }
  return pins;
}
/** The pin names of one port, checked for shape: a list of exactly `width` pin names. */
function readBits(name: string, value: unknown, width: number): string[] {
  if (!Array.isArray(value)) fail(`pins.${name} must be an array of pin names`, `pins.${name}`);
  if (value.length !== width) {
    fail(`pins.${name} has ${value.length} pins, and ${name} has ${width} ${width === 1 ? 'bit' : 'bits'}`, `pins.${name}`);
  }
  return value.map((pin, index) => {
    const path = `pins.${name}[${index}]`;
    if (typeof pin !== 'string' || !PACKAGE_PIN.test(pin)) fail(`${path} ${quoted(pin)} is not a pin name like J15`, path);
    return pin;
  });
}

/** The bits of every port a physical pin can land on, by the name the board spells. */
function pinWidths(ports: BoardPorts): Map<string, number> {
  const widths = new Map<string, number>([[ports.clock.port, 1]]);
  const addGroup = (group: PortGroup): void => {
    if (group.kind === 'vector') widths.set(group.port, group.count);
    else for (const name of group.ports) widths.set(name, 1);
  };
  if (ports.switches.count > 0) widths.set(ports.switches.port, ports.switches.count);
  addGroup(ports.pushbuttons.group);
  if (ports.resetButton !== undefined) widths.set(ports.resetButton.port, 1);
  widths.set(ports.leds.port, ports.leds.count);
  const displays = ports.sevenSegment;
  if (displays.kind === 'independent') {
    for (const name of displays.ports) widths.set(name, displays.width);
  } else {
    addGroup(displays.segments);
    if (displays.decimalPoint !== undefined) widths.set(displays.decimalPoint, 1);
    widths.set(displays.digitEnables, displays.digits);
  }
  return widths;
}


/**
 * The package pins of one board port as a design port of `width` bits uses it: one pin
 * per bit, or undefined when the board names that port no pins or the widths differ.
 */
export function pinsOf(pins: BoardPins, boardPort: string | undefined, width: number | undefined): readonly string[] | undefined {
  if (boardPort === undefined) return undefined;
  const list = pins[boardPort];
  if (list === undefined || width === undefined || list.length !== width) return undefined;
  return list;
}
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy
/**
 * A design's own constraints file, read back into I/O Planning's pins (`PRD.md` § 7.6).
 *
 * The handout examples pin their ports in Vivado, not on this board's port names: `seg`
 * on `CA`…`CG`, `pos_seg` on `AN[7]`…`AN[0]`, `a` on `SW[0]`…`SW[2]`. The package pin is
 * what both sides share, so the file is read as package pin -> design bit, and the board's
 * own `pins` table turns each package pin into the board bit it is. What comes out is a pin
 * spec in the form the server takes for one design port: a board key (`SW`), a display word
 * (`CA…CG`), or comma-separated bits in the port's bit order (`sw[0],sw[1],sw[2]`).
 *
 * Both shapes Vivado 2020.2 writes are read — `set_property -dict { … } [get_ports …]` and
 * the separate `set_property PACKAGE_PIN …` / `IOSTANDARD …` lines — including the vendor
 * master files' commented-out template lines, which are what a handout ships. Nothing here
 * decides whether a design is correct: it reports what it could not place and leaves the
 * port unassigned, which is the state I/O Planning already shows.
 */
import type { BoardPins } from './types';

/** One design port's pin, as I/O Planning takes it, plus what could not be read. */
export interface XdcPin {
  /** The design port as the XDC spells it, with any bit index stripped: `seg`, `pos_seg`. */
  readonly port: string;
  /** The board bits, in the design port's own bit order: `sw[0],sw[1],sw[2]` or `ca…cg`. */
  readonly spec: string;
  /** The package pins behind it, for the log line. */
  readonly packagePins: readonly string[];
}

export interface XdcImport {
  readonly pins: readonly XdcPin[];
  /** What the file said that could not become a pin, one line each. */
  readonly problems: readonly string[];
  /** The I/O standards the file names (`LVCMOS33`, `LVCMOS18`), in file order, without repeats. */
  readonly iostandards: readonly string[];
}

/**
 * `[get_ports {led_seg[0]}]`, `[get_ports clk]`, `[get_ports {SW[0] SW[1]}]`: the names.
 * The bit index is inside the braces, so a `]` there does not end the command — the closing
 * `}]` or the bare `]` after a scalar name does.
 */
const GET_PORTS = /\[get_ports\s+\{([^}]*)\}\]|\[get_ports\s+([A-Za-z_]\w*(?:\[\d+\])?)\]/;
/** A design bit as an XDC writes it: `led_seg[0]` or `clk`. */
const DESIGN_BIT = /^([A-Za-z_]\w*?)(?:\[(\d+)\])?$/;
/** `set_property -dict { PACKAGE_PIN E3 IOSTANDARD LVCMOS33 } [get_ports { SW[0] }]`. */
const DICT_LINE = /^\s*set_property\s+-dict\s*\{([^}]*)\}\s*(\[get_ports.*)$/;

/**
 * The pins `text` assigns, one per design port that names more than one bit, and one per
 * scalar port as its own board key. Package pins the board does not have are reported, not
 * guessed: a pin table is the only thing that can say what a package pin means.
 */
/** A board bit a package pin turns out to be, keyed by the lower-case board port name. */
interface BoardBit {
  readonly key: string;
  readonly bit: number;
  readonly width: number;
}

/** Design port -> bit index (or `scalar`) -> the package pin the file put it on. */
type Declared = Map<string, Map<number | 'scalar', string>>;

/** What the file has been read into so far: the board it is read against, and what it said. */
interface Scan {
  readonly byPackage: ReadonlyMap<string, BoardBit>;
  readonly widths: ReadonlyMap<string, number>;
  readonly declared: Declared;
  readonly problems: string[];
  readonly iostandards: string[];
}

const IOSTANDARD = /IOSTANDARD\s+([A-Za-z0-9_]+)/i;
const PACKAGE_PIN = /PACKAGE_PIN\s+([A-Za-z]{1,2}\d{1,2})\b/i;

export function readXdc(text: string, pins: BoardPins): XdcImport {
  const scan = newScan(pins);
  for (const statement of statements(text)) readStatement(scan, statement);
  const resolved: XdcPin[] = [];
  for (const [port, bits] of scan.declared) {
    const placed = placePort(port, bits, scan);
    scan.problems.push(...placed.problems);
    if (placed.pin !== undefined) resolved.push(placed.pin);
  }
  return { pins: resolved, problems: scan.problems, iostandards: scan.iostandards };
}

/** The board's package pins, and the empty result the file is read into. */
function newScan(pins: BoardPins): Scan {
  const byPackage = new Map<string, BoardBit>();
  for (const [key, packagePins] of Object.entries(pins)) {
    packagePins.forEach((packagePin, bit) => byPackage.set(packagePin.toUpperCase(), { key: key.toLowerCase(), bit, width: packagePins.length }));
  }
  const widths = new Map(Object.entries(pins).map(([key, packagePins]) => [key.toLowerCase(), packagePins.length] as const));
  return { byPackage, widths, declared: new Map(), problems: [], iostandards: [] };
}

/**
 * The `set_property` statements in `text`, each with its `-dict` rewritten to the separate
 * form so one reader handles both shapes Vivado 2020.2 writes.
 *
 * A commented-out statement is how the vendor master files ship their templates, and how a
 * student uncomments the lines they use: a commented line assigns nothing on the board
 * either, but it is the only statement of intent held.
 */
function* statements(text: string): Generator<string> {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*#\s*(?=set_property)/, '');
    if (!/^\s*set_property\b/.test(line)) continue;
    const dict = DICT_LINE.exec(line);
    yield dict === null ? line : `${line.slice(0, dict.index)}set_property ${dict[1]} ${dict[2]}`;
  }
}

/** One statement's pins, and the I/O standard it names. */
function readStatement(scan: Scan, statement: string): void {
  // § 7.6: both the Vivado 2020.2 default (`LVCMOS18`) and the Nexys A7's own
  // (`LVCMOS33`) are valid here, so the standard is recorded and never checked.
  const standard = IOSTANDARD.exec(statement)?.[1];
  if (standard !== undefined && !scan.iostandards.includes(standard.toUpperCase())) scan.iostandards.push(standard.toUpperCase());
  const packagePin = PACKAGE_PIN.exec(statement);
  const ports = GET_PORTS.exec(statement);
  if (packagePin === null || ports === null) return;
  const pin = packagePin[1].toUpperCase();
  for (const name of (ports[1] ?? ports[2]).split(/[\s,]+/).filter((part) => part !== '')) recordBit(scan, name, pin);
}

/** One `[get_ports]` name on the package pin the same statement gives it. */
function recordBit(scan: Scan, name: string, packagePin: string): void {
  const parsed = DESIGN_BIT.exec(name);
  if (parsed === null) {
    scan.problems.push(`${name} is not a port name this tool can place.`);
    return;
  }
  const [, port, index] = parsed;
  const bits = scan.declared.get(port) ?? new Map<number | 'scalar', string>();
  bits.set(index === undefined ? 'scalar' : Number(index), packagePin);
  scan.declared.set(port, bits);
}

/** One design port as I/O Planning takes it, or why it cannot be placed. */
function placePort(port: string, bits: ReadonlyMap<number | 'scalar', string>, scan: Scan): { pin?: XdcPin; problems: string[] } {
  const scalar = bits.get('scalar');
  if (scalar === undefined) return placeVector(port, bits, scan);
  const boardBit = scan.byPackage.get(scalar);
  if (boardBit === undefined) return { problems: [`${port} is on package pin ${scalar}, which this board does not have.`] };
  return { pin: { port, spec: bitKey(boardBit), packagePins: [scalar] }, problems: [] };
}

/** A vector port's bits, in the port's own bit order — which is the order the pin keeps. */
function placeVector(port: string, bits: ReadonlyMap<number | 'scalar', string>, scan: Scan): { pin?: XdcPin; problems: string[] } {
  const keys: string[] = [];
  const used: string[] = [];
  const problems: string[] = [];
  const indexes = [...bits.keys()].filter((key): key is number => key !== 'scalar').sort((a, b) => a - b);
  for (const index of indexes) {
    const packagePin = bits.get(index) as string;
    const boardBit = scan.byPackage.get(packagePin);
    if (boardBit === undefined) {
      problems.push(`${port}[${index}] is on package pin ${packagePin}, which this board does not have.`);
      continue;
    }
    keys.push(bitKey(boardBit));
    used.push(packagePin);
  }
  // A port whose bits are exactly one whole board port is that port, so I/O Planning shows
  // `an` rather than eight bit keys. A slice (`a` on `SW[0]`…`SW[2]`) keeps the bit form:
  // `sw` would be 16 bits and the port is 3, which § 7.6 refuses.
  if (keys.length === 0) return { problems };
  return { pin: { port, spec: collapse(keys, scan.widths), packagePins: used }, problems };
}

/** `sw[3]` for a vector's bit, `ca` for a one-bit port. */
function bitKey(bit: BoardBit): string {
  return bit.width === 1 ? bit.key : `${bit.key}[${bit.bit}]`;
}



/** `sw[0]`,`sw[1]`,… as `sw` when they are all of it; anything else as a comma-separated list. */
function collapse(keys: readonly string[], widths: ReadonlyMap<string, number>): string {
  const parsed = keys.map((key) => /^([^[\]]+)(?:\[(\d+)\])?$/.exec(key));
  const base = parsed[0]?.[1];
  const whole =
    base !== undefined &&
    base !== parsed[0]?.[0] &&
    widths.get(base) === keys.length &&
    parsed.every((part, index) => part !== null && part[1] === base && part[2] !== undefined && Number(part[2]) === index);
  return whole && base !== undefined ? base : keys.join(',');
}
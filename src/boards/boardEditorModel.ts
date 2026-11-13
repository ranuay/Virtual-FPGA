// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy
import { isObject } from '../project/jsonValue';
import { parseBoardFile } from './parseBoards';

export interface BoardDocument extends Record<string, unknown> {
  version: 2;
  boards: Record<string, unknown>[];
}
export type BoardPath = readonly (string | number)[];
export function valueAt(value: unknown, path: BoardPath): unknown {
  return path.reduce<unknown>((item, key) => {
    if (Array.isArray(item)) return item[Number(key)];
    return isObject(item) ? item[String(key)] : undefined;
  }, value);
}
/** Copy only the edited branch; never normalize the saved document. */
export function changeAt(value: unknown, path: BoardPath, next: unknown): unknown {
  const changed = copyAt(value, path, next);
  return path[0] === 'ports' || path[0] === 'pins' ? withMatchingPins(changed) : changed;
}
function copyAt(value: unknown, path: BoardPath, next: unknown): unknown {
  if (path.length === 0) return next;
  const [key, ...rest] = path;
  if (Array.isArray(value)) return value.map((item, index) => index === key ? copyAt(item, rest, next) : item);
  const object = isObject(value) ? value : {};
  const copy = { ...object };
  if (next === undefined && rest.length === 0) delete copy[key];
  else copy[key] = copyAt(object[key], rest, next);
  return copy;
}
/** The port names the raw version-2 ports vocabulary can still spell, whatever the draft's state. */
function rawPortNames(board: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value === 'string') names.add(value.toLowerCase());
    else if (Array.isArray(value)) value.forEach(add);
  };
  const ports = isObject(board.ports) ? board.ports : {};
  add(ports.clock); add(ports.clock500Hz);
  for (const role of ['switches', 'leds']) add(valueAt(ports, [role, 'port']));
  add(valueAt(ports, ['pushbuttons', 'port']));
  add(valueAt(ports, ['pushbuttons', 'ports']));
  add(Object.values(isObject(valueAt(ports, ['pushbuttons', 'cross'])) ? valueAt(ports, ['pushbuttons', 'cross']) as object : {}));
  add(valueAt(ports, ['resetButton', 'port']));
  add(valueAt(ports, ['sevenSegment', 'ports']));
  add(valueAt(ports, ['sevenSegment', 'decimalPoint']));
  add(valueAt(ports, ['sevenSegment', 'digitEnables']));
  add(valueAt(ports, ['sevenSegment', 'segments']));
  return names;
}
/**
 * `pins` is keyed by port name, so an edit that renames or removes a port leaves a key
 * the board no longer has. The parser rejects a board for such a key, so a stale one
 * would make the whole board vanish; drop it instead. Pins of a renamed port are lost:
 * they were the old part's, and the editor asks for the new ones.
 */
function withMatchingPins(board: unknown): unknown {
  if (!isObject(board) || !isObject(board.pins)) return board;
  const names = rawPortNames(board);
  const kept = Object.entries(board.pins).filter(([port]) => names.has(port.toLowerCase()));
  if (kept.length === Object.keys(board.pins).length) return board;
  return { ...board, pins: Object.fromEntries(kept) };
}
const FIELDS: Record<string, readonly string[]> = {
  '': ['id', 'name', 'description', 'ports', 'labels', 'resources', 'pins'],
  ports: ['clock', 'clockMHz', 'clock500Hz', 'switches', 'pushbuttons', 'resetButton', 'leds', 'sevenSegment'],
  'ports.switches': ['port', 'count'], 'ports.leds': ['port', 'count'],
  'ports.pushbuttons': ['port', 'count', 'ports', 'cross', 'activeLow'],
  'ports.pushbuttons.cross': ['centre', 'up', 'left', 'right', 'down'],
  'ports.resetButton': ['port', 'activeLow'],
  'ports.sevenSegment': ['kind', 'ports', 'width', 'segments', 'decimalPoint', 'digitEnables', 'digits', 'activeLow', 'digitEnablesActiveLow'],
  labels: ['switches', 'pushbuttons', 'leds', 'sevenSegment'], resources: ['label', 'url'],
};
/** Extensions survive in raw JSON; validate just the vocabulary this app understands. */
export function knownBoard(value: unknown, path = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => knownBoard(item, path));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => FIELDS[path]?.includes(key) ?? true)
    .map(([key, item]) => [key, knownBoard(item, path ? `${path}.${key}` : key)]));
}
export function parsedDocument(file: BoardDocument) {
  return parseBoardFile(JSON.stringify({ version: 2, boards: file.boards.map((board) => knownBoard(board)) }),
    { fileName: 'Saved board settings', origin: 'user' });
}
export function readDocument(text: string): BoardDocument {
  const value: unknown = JSON.parse(text);
  if (!isObject(value) || value.version !== 2 || !Array.isArray(value.boards) || !value.boards.every(isObject)) {
    throw new Error('Board editing requires a version-2 board file. The original file has not been changed.');
  }
  return value as BoardDocument;
}
export function replaceBoard(file: BoardDocument, board: Record<string, unknown>, replacingId = String(board.id)): BoardDocument {
  return { ...file, boards: file.boards.map((other) => other.id === replacingId ? board : other) };
}
export function appendBoard(file: BoardDocument, board: Record<string, unknown>): BoardDocument {
  return { ...file, boards: [...file.boards, board] };
}

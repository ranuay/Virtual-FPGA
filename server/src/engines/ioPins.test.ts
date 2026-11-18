// SPDX-License-Identifier: GPL-2.0-only
/**
 * What a pin names (PRD.md § 7.6). A handout's `.xdc` pins individual bits — `a[0]` on
 * `SW[0]` and, in Bab 7, `sel[0]` on `SW[15]` — which no single board port names, so the
 * pin is a list of bit keys in the design port's own bit order. These pin the two things
 * that order decides: which wires are made, and what a pin that names nothing is refused
 * with.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePin, boardBits } from './ioPins.js';
import { NEXYS_A7_BOARD_IO } from '../testSupport/boards.js';

test('a board port resolves to its own bits, in board order', () => {
  const resolved = resolvePin('sw', NEXYS_A7_BOARD_IO);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.kind, 'port');
  assert.equal(resolved.width, 16);
});

test('a bit list resolves bit by bit, keeping the order the pin wrote', () => {
  // `bab7_alu.xdc` pins `sel[0]` on `SW[15]` and `sel[1]` on `SW[14]`: descending, which is
  // the design's order and not the board's. The wires follow the pin, never the board table.
  const resolved = resolvePin('sw[15],sw[14]', NEXYS_A7_BOARD_IO);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.kind, 'bits');
  assert.deepEqual(resolved.bits.map((bit) => bit.index), [15, 14]);
  assert.equal(resolved.width, 2);
});

test('a display word pins its own bits: seg is CA…CG as the design spells them', () => {
  const resolved = resolvePin('ca…cg', NEXYS_A7_BOARD_IO);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.width, 7);
});

test('a pin naming a bit the board does not have is refused, naming the bit', () => {
  const resolved = resolvePin('sw[0],sw[99]', NEXYS_A7_BOARD_IO);
  assert.equal(resolved.ok, false);
  if (resolved.ok) return;
  assert.match(resolved.reason, /sw\[99\]/);
});

test('a pin naming the same bit twice is refused rather than wiring it twice', () => {
  const resolved = resolvePin('sw[0],sw[0]', NEXYS_A7_BOARD_IO);
  assert.equal(resolved.ok, false);
  if (resolved.ok) return;
  assert.match(resolved.reason, /more than one bit/);
});

test('every board bit is listed once, a scalar port under its own name', () => {
  const keys = boardBits(NEXYS_A7_BOARD_IO).map((bit) => bit.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('sw[3]'));
  assert.ok(keys.includes('ca'));
  assert.ok(!keys.includes('sw'));
});
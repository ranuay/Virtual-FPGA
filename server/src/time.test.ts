// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * The `TIME` frame (PRD.md § 10.3): simulated time and the real time it took, so the
 * frontend can show the ratio. Pinned here rather than only in the pane test, because
 * the two packages share no code — this is the only place both ends' parsing is checked.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { decodeServerFrame, encodeServerFrame, type ServerFrame } from './protocol.js';

describe('TIME', () => {
  test('round-trips the pair the readout needs', () => {
    const frames: ServerFrame[] = [
      { verb: 'TIME', simMs: 168, wallMs: 72_000 },
      { verb: 'TIME', simMs: 0, wallMs: 0 },
      { verb: 'TIME', simMs: 1_234_567, wallMs: 9_876 },
    ];
    for (const frame of frames) assert.deepEqual(decodeServerFrame(encodeServerFrame(frame)), frame);
  });

  test('is one line, so it cannot be confused with a body-carrying frame', () => {
    assert.equal(encodeServerFrame({ verb: 'TIME', simMs: 5, wallMs: 10 }), 'TIME 5 10');
  });

  test('refuses a payload that is not two non-negative numbers', () => {
    // A negative or unparseable span would reach the pane as "—" at best; refuse it at
    // the edge so the ratio is never computed from garbage.
    for (const text of ['TIME', 'TIME 5', 'TIME 5 x', 'TIME -1 10', 'TIME 5 -10', 'TIME NaN 10']) {
      assert.ok('message' in decodeServerFrame(text), text);
    }
  });
});

// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * ACSL lab code compiles and runs as handed out (PRD § 8.1): the sources import
 * `ieee.std_logic_arith` and `ieee.std_logic_unsigned`, the legacy Synopsys packages
 * GHDL refuses unless `-fsynopsys` is passed — and it refuses at each of the three
 * stages separately, because every stage re-reads the `use` clauses:
 *
 *     ghdl -a  only:  -a passes, -e fails with the same message
 *     ghdl -a -e:     -e passes, -r fails with the same message
 *
 * So one board run here pins all three at once: analysis of the student's file, analysis
 * and elaboration of the generated testbench, and the persistent run. The batch case
 * pins the other `-r` (the student's own testbench, run directly). The student's source
 * is not rewritten — that is the point of the flag.
 */

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { requireTool } from '../testSupport/requireTool.js';
import { startTestBackend, type TestBackend } from '../testSupport/testBackend.js';
import { ACSL_STD_LOGIC_ARITH_VHDL, ACSL_STD_LOGIC_UNSIGNED_VHDL } from '../testSupport/vhdlSources.js';
import { playBoardScenario } from '../testSupport/playScenario.js';
import { startRun, withSession as withSessionOn } from '../testSupport/withSession.js';
import type { WsTestClient } from '../testSupport/WsTestClient.js';

const ghdl = requireTool('ghdl');

/** `LEDR <= SW + 1` on a 10-bit `std_logic_vector`, which needs `std_logic_unsigned`. */
const SW_PLUS_ONE = [
  { name: 'zero plus one', sw: '0000000000', key: '1111', expect: { ledr: '0000000001' } },
  { name: 'odd value plus one carries', sw: '1111111111', key: '1111', expect: { ledr: '0000000000' } },
  { name: 'mixed bits plus one', sw: '1010101010', key: '1111', expect: { ledr: '1010101011' } },
];

describe('ACSL lab code that uses the Synopsys packages', { skip: ghdl.skip }, () => {
  let backend: TestBackend;

  before(async () => {
    backend = await startTestBackend({ ghdlExe: ghdl.exe ?? undefined });
  });

  after(() => backend.stop());

  const withSession = (body: (client: WsTestClient) => Promise<void>) => withSessionOn(backend.port, body);

  test('a board design using std_logic_unsigned analyses, elaborates and runs unmodified', () =>
    withSession(async (client) => {
      await startRun(client, [{ name: 'acsl_adder.vhdl', content: ACSL_STD_LOGIC_UNSIGNED_VHDL }], 'acsl_adder.vhdl');
      const failure = client.frames.find((frame) => frame.verb === 'ERROR');
      assert.equal(failure, undefined, failure?.verb === 'ERROR' ? failure.text : '');
      await playBoardScenario(client, SW_PLUS_ONE);
    }));

  test('a testbench using std_logic_arith runs with its conv_integer intact', () =>
    withSession(async (client) => {
      await startRun(client, [{ name: 'acsl_conv.vhdl', content: ACSL_STD_LOGIC_ARITH_VHDL }], 'acsl_conv.vhdl');
      const done = await client.until((frame) => frame.verb === 'DONE');
      assert.deepEqual(done, { verb: 'DONE', reason: 'completed' });
      const logged = client.frames.flatMap((frame) => (frame.verb === 'LOG' ? [frame.text] : [])).join('\n');
      assert.match(logged, /conv_integer\(a\)=3/);
      assert.doesNotMatch(logged, /needs the -fsynopsys option/);
    }));
});

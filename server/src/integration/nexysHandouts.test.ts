// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy
/**
 * The ACSL handouts on the Nexys A7 board (`PRD.md` § 4, § 7.6, § 20 Rule 5).
 *
 * A handout is the student's code and is never edited. Two of its real habits used to
 * stop the virtual board instead of driving it:
 *
 * 1. A counter that runs past its subtype's range. GHDL stops with a `bound check
 *    failure`; the board the student plugs in has no such check and simply wraps. The
 *    run is rebuilt from the synthesised netlist, which is exactly what hardware is.
 * 2. A design that drives `seg` and never `AN` - a static digit (the Bab 5 push button
 *    handout is one). With the digit enables resting at their *off* level every digit
 *    stays dark; the anodes rest enabled instead, so the pattern the design drives is
 *    the pattern the board shows.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { stateFields, displayWordWidth } from '../engines/boardShape.js';
import { NEXYS_A7_BOARD_IO } from '../testSupport/boards.js';
import { requireTool } from '../testSupport/requireTool.js';
import { startTestBackend, type TestBackend } from '../testSupport/testBackend.js';
import { withSession } from '../testSupport/withSession.js';
import type { WsTestClient } from '../testSupport/WsTestClient.js';

const ghdl = requireTool('ghdl');
const READY_TIMEOUT_MS = 120_000;
const STATE_TIMEOUT_MS = 10_000;

/** Bab 5 "Up/Down Counter menggunakan Push Button": counts 0..9 and wraps on 9 -> 0. */
const UPDOWN_COUNTER_VHDL = `
library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_unsigned.all;

entity updown_counter is
    port (
        clk        : in  std_logic;
        count_up   : in  std_logic;
        count_down : in  std_logic;
        seg        : out std_logic_vector(6 downto 0));
end updown_counter;

architecture rtl of updown_counter is
    signal nilai : std_logic_vector(3 downto 0) := "0000";
begin
    process (clk)
    begin
        if rising_edge(clk) then
            if count_up = '1' and nilai < 9 then
                nilai <= nilai + 1;
            elsif count_down = '1' and nilai > 0 then
                nilai <= nilai - 1;
            end if;
        end if;
    end process;

    seg <= "1000000" when nilai = 0 else "1111001";
end rtl;
`;

/**
 * The same counter with its guards removed: `nilai + 1` at 15 leaves the 4-bit subtype, which
 * GHDL's runtime checks report and the board itself cannot - the wire just wraps to 0.
 */
const WRAPPING_COUNTER_VHDL = UPDOWN_COUNTER_VHDL.replace(' and nilai < 9', '').replace(' and nilai > 0', '');

/** A static digit: drives `seg` only, never `AN` or `DP`. */
const STATIC_SEGMENT_VHDL = `
library ieee;
use ieee.std_logic_1164.all;

entity static_segment is
    port (
        sw  : in  std_logic_vector(15 downto 0);
        seg : out std_logic_vector(6 downto 0));
end static_segment;

architecture rtl of static_segment is
begin
    seg <= "1000000" when sw(0) = '0' else "1111001";
end rtl;
`;

/** The display-`index` field of a `STATE` bit string, split exactly as the backend builds it. */
function displayBits(bits: string, index: number): string {
  let at = 0;
  for (const field of stateFields(NEXYS_A7_BOARD_IO)) {
    if (field.role === 'display' && field.index === index) return bits.slice(at, at + field.width);
    at += field.width;
  }
  throw new Error(`the Nexys A7 has no display ${index}`);
}


describe('ACSL handouts on the Nexys A7 board', { skip: ghdl.skip }, () => {
  let backend: TestBackend;

  before(async () => {
    backend = await startTestBackend({ ghdlExe: ghdl.exe ?? undefined });
  });

  after(() => backend.stop());

  /**
   * What `bab5_pushbutton.xdc` places, in I/O Planning's terms: the handout's own port
   * names, through the package pins Vivado would put them on. `clk` is the 100 MHz
   * oscillator, `count_up`/`count_down` are two buttons, `seg` is the segment word - the
   * board spells the segments one at a time (`CA`…`CG`), so the seven of them are one pin.
   */
  const PUSHBUTTON_PINS: readonly (readonly [string, string])[] = [
    ['clk', 'clk100mhz'],
    ['count_up', 'btnu'],
    ['count_down', 'btnd'],
    ['seg', 'ca…cg'],
  ];

  /** One handout, its source and the pins its `.xdc` carries. */
  interface Handout {
    readonly name: string;
    readonly content: string;
    readonly pins: readonly (readonly [string, string])[];
  }

  /**
   * A handout run the way the panel runs it: Synthesis first (I/O Planning needs the port
   * list), then the pins its `.xdc` carries, then the run itself.
   */
  const runPinned = async (client: WsTestClient, { name, content, pins }: Handout): Promise<void> => {
    client.board(NEXYS_A7_BOARD_IO);
    const files = [{ name, content }];
    client.sendFrame({ verb: 'FLOW-RUN', step: 'synthesis', files, topFile: name });
    const synthesised = await client.until(
      (frame) => frame.verb === 'LOG' && frame.text.startsWith('Synthesis finished'),
      READY_TIMEOUT_MS,
    );
    assert.equal(synthesised.verb, 'LOG');
    for (const [port, boardPort] of pins) client.sendFrame({ verb: 'FLOW-PIN', port, boardPort });
    client.run(files, name);
  };

  test('a counter that wraps past its subtype still runs, as it does on the board', () =>
    withSession(backend.port, async (client) => {
      await runPinned(client, { name: 'wrapping_counter.vhdl', content: WRAPPING_COUNTER_VHDL, pins: PUSHBUTTON_PINS });
      const ready = await client.until((frame) => frame.verb === 'READY' || frame.verb === 'ERROR', READY_TIMEOUT_MS);
      assert.equal(ready.verb, 'READY', ready.verb === 'ERROR' ? ready.text : 'no READY frame');
      // The recovered run drives the display: a lit segment, not a blank digit.
      const state = await client.until((frame) => frame.verb === 'STATE', STATE_TIMEOUT_MS);
      assert.equal(state.verb, 'STATE');
      if (state.verb !== 'STATE') return;
      // Active low, so a lit segment reads `0` and a blank digit is all `1`s.
      assert.match(displayBits(state.bits, 0), /0/, `no segment is lit: display 0 reads ${displayBits(state.bits, 0)}`);
    }));

  // Static digit: it drives `seg` only, never `AN` or `DP`, so the anodes are what rest
  // enabled. `sw` is pinned to the switches the design reads its pattern from.
  test('a design that drives only seg lights its digit, though it never drives AN', () =>
    withSession(backend.port, async (client) => {
      await runPinned(client, {
        name: 'static_segment.vhdl',
        content: STATIC_SEGMENT_VHDL,
        pins: [
          ['sw', 'sw'],
          ['seg', 'ca…cg'],
        ],
      });
      const ready = await client.until((frame) => frame.verb === 'READY' || frame.verb === 'ERROR', READY_TIMEOUT_MS);
      assert.equal(ready.verb, 'READY', ready.verb === 'ERROR' ? ready.text : 'no READY frame');
      // An unconnected anode rests enabled, so the decoder latches the pattern the design
      // drives on every digit rather than leaving all eight dark.
      const state = await client.until((frame) => frame.verb === 'STATE', STATE_TIMEOUT_MS);
      assert.equal(state.verb, 'STATE');
      if (state.verb !== 'STATE') return;
      const word = displayBits(state.bits, 0);
      assert.equal(word.length, displayWordWidth(NEXYS_A7_BOARD_IO));
      assert.match(word, /0/, `no digit shows the pattern: display 0 reads ${word}`);
    }));
});
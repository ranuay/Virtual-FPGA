// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { boardPortKeys, DEFAULT_BOARD_IO, type BoardIo } from './engines/boardPorts.js';
import { generateTestbench } from './tbTemplate.js';
import {
  BASYS3_BOARD_IO,
  DE10_LITE_BOARD_IO,
  DE1_SOC_BOARD_IO,
  MUX_NO_POINT_BOARD_IO,
  NEXYS_A7_BOARD_IO,
  VIDEO_CLOCK_BOARD_IO,
} from './testSupport/boards.js';
import { readFixture } from './testSupport/fixture.js';

const DEFAULT_TOP_PORTS = new Set(['clock_50', 'sw', 'key_n', 'ledr', 'hex0_n', 'hex1_n', 'hex2_n', 'hex3_n', 'hex4_n', 'hex5_n']);
const DE1_SOC_TOP_PORTS = new Set(['clock_50', 'sw', 'key', 'ledr', 'hex0', 'hex1', 'hex2', 'hex3', 'hex4', 'hex5']);

describe('generateTestbench', () => {
  // Captured from the generator before boards were configurable: the Default board must not change a byte.
  test('on the Default board is the testbench it always was', () => {
    assert.equal(generateTestbench('DE1_SoC', DEFAULT_TOP_PORTS, DEFAULT_BOARD_IO), readFixture('vhdl', 'golden/hdl_board_tb.DE1_SoC.vhdl'));
  });

  test('wires the legacy rst from the first pushbutton, as it always did', () => {
    const ports = new Set(['clock_500hz', 'key_n', 'rst', 'ledr']);
    const options = { pacingFromStdin: true, tiedInputs: [{ name: 'dummy', value: "'0'" }] };
    assert.equal(generateTestbench('legacy', ports, DEFAULT_BOARD_IO, options), readFixture('vhdl', 'golden/hdl_board_tb.legacy_rst.vhdl'));
  });

  test('on the DE1-SoC connects KEY and HEX0…HEX5', () => {
    assert.equal(generateTestbench('DE1_SoC', DE1_SOC_TOP_PORTS, DE1_SOC_BOARD_IO), readFixture('vhdl', 'golden/hdl_board_tb.de1-soc.vhdl'));
  });

  test('on the DE1-SoC leaves the Default names unconnected', () => {
    const text = generateTestbench('top', new Set(['key_n', 'hex0_n', 'sw']), DE1_SOC_BOARD_IO);
    assert.match(text, /sw => sw_sig/);
    assert.doesNotMatch(text, /key_n =>|hex0_n =>/);
  });

  test('ties rst off on a board whose pushbuttons the entity lacks', () => {
    assert.match(generateTestbench('top', new Set(['key_n', 'rst']), DE1_SOC_BOARD_IO), /rst_sig <= '0';/);
    assert.match(generateTestbench('top', new Set(['key', 'rst']), DE1_SOC_BOARD_IO), /rst_sig <= not key_sig\(0\);/);
  });
});

describe('generateTestbench on boards of other shapes (docs/board_io_v2_spec.md § 7.2)', () => {
  const everyPort = (board: BoardIo): ReadonlySet<string> => boardPortKeys(board, { legacyReset: true });
  const tops: Array<[string, string, BoardIo]> = [
    ['de10-lite', 'de10_top', DE10_LITE_BOARD_IO],
    ['basys3', 'basys_top', BASYS3_BOARD_IO],
    ['nexys-a7', 'nexys_top', NEXYS_A7_BOARD_IO],
  ];
  for (const [id, top, board] of tops) {
    test(`on the ${id} is its golden testbench`, () => {
      assert.equal(generateTestbench(top, everyPort(board), board), readFixture('vhdl', `golden/hdl_board_tb.${id}.vhdl`));
    });
  }

  test('connects scalar ports to one bit of their testbench vector', () => {
    const text = generateTestbench('top', new Set(['btnc', 'btnd', 'ca', 'cg']), NEXYS_A7_BOARD_IO);
    assert.match(text, /btnc => key_sig\(0\),\n\s+btnd => key_sig\(4\)/);
    assert.match(text, /ca => seg_sig\(0\),\n\s+cg => seg_sig\(6\)/);
  });

  test('rests active-high buttons at 0 and an active-low reset button at 1', () => {
    const text = generateTestbench('top', new Set(['btnc']), NEXYS_A7_BOARD_IO);
    assert.match(text, /signal key_sig {4}: std_logic_vector\(4 downto 0\) := \(others => '0'\);/);
    assert.match(text, /signal rstbtn_sig : std_logic := '1';/);
  });

  test('drives the legacy rst from the reset button, else from an active-high button 0, and says so', () => {
    assert.match(generateTestbench('top', new Set(['rst']), NEXYS_A7_BOARD_IO), /rst_sig <= not rstbtn_sig; -- legacy rst: asserted while CPU_RESETN is pressed/);
    assert.match(generateTestbench('top', new Set(['rst', 'btnc']), BASYS3_BOARD_IO), /rst_sig <= key_sig\(0\); -- legacy rst/);
    assert.match(generateTestbench('top', new Set(['rst']), BASYS3_BOARD_IO), /rst_sig <= '0';/);
  });

  test('clocks a 100 MHz board at 5 ns, and a 74.25 MHz one to the picosecond', () => {
    assert.match(generateTestbench('top', new Set(['clk']), BASYS3_BOARD_IO), /clk_sig <= '0'; wait for 5 ns;/);
    assert.match(generateTestbench('top', new Set(['pixel_clk']), VIDEO_CLOCK_BOARD_IO), /clk_sig <= '0'; wait for 6734 ps;/);
  });

  test('decodes a multiplexed display without a decimal point in 7-bit words', () => {
    const text = generateTestbench('top', new Set(['seg', 'an']), MUX_NO_POINT_BOARD_IO);
    // The capture reads every digit after the ones a change switches off settle (§ 7.4),
    // which takes a second evaluation, not the implicit list `process (seg_sig, an_sig)`.
    assert.match(text, /mux_capture : process\n/);
    assert.match(text, /wait on seg_sig, an_sig;/);
    assert.match(text, /digit_word\(d\) <= seg_sig;/);
    assert.match(text, /now_bits\(9 \+ d \* 7 to 8 \+ \(d \+ 1\) \* 7\)/);
    assert.doesNotMatch(text, /dp_sig/);
  });

  // § 7.6: one 8-bit design port pinned to the display's segment word. VHDL rejects an
  // expression as the actual of an `out` port, so the bits are named one by one.
  test('wires a port pinned to the segment word one bit at a time', () => {
    const text = generateTestbench('top', new Set(['seg8']), NEXYS_A7_BOARD_IO, { pins: new Map([['seg8', 'ca…dp']]) });
    assert.match(text, /seg8\(0\) => seg_sig\(0\),\n\s+seg8\(1\) => seg_sig\(1\)/);
    assert.match(text, /seg8\(7\) => dp_sig\n/);
    assert.doesNotMatch(text, /seg8 => /);
  });

  // A handout's `.xdc` pins bits one by one (`led_seg[7]` on `DP`), which I/O Planning turns
  // into a comma-separated list. The board-order run of the same bits must not attach them a
  // second time: VHDL reads a repeated association for one formal as an out-of-range choice
  // (`led_seg(8) => dp_sig`, `choice is out of index range`) and the board never starts.
  test('wires a port pinned to bits once, in the pin order, with no duplicate association', () => {
    const pins = new Map([['led_seg', 'ca,cb,cc,cd,ce,cf,cg,dp'], ['pos_seg', 'an[0],an[1],an[2]']]);
    const text = generateTestbench('top', new Set(['led_seg', 'pos_seg']), NEXYS_A7_BOARD_IO, { pins });
    const assoc = (name: string): string[] =>
      text
        .split('\n')
        .filter((line) => line.trim().startsWith(`${name}(`))
        .map((line) => line.trim().replace(/[,\s]+$/, ''));
    assert.deepEqual(assoc('led_seg'), [
      'led_seg(0) => seg_sig(0)',
      'led_seg(1) => seg_sig(1)',
      'led_seg(2) => seg_sig(2)',
      'led_seg(3) => seg_sig(3)',
      'led_seg(4) => seg_sig(4)',
      'led_seg(5) => seg_sig(5)',
      'led_seg(6) => seg_sig(6)',
      'led_seg(7) => dp_sig',
    ]);
    assert.deepEqual(assoc('pos_seg'), ['pos_seg(0) => an_sig(0)', 'pos_seg(1) => an_sig(1)', 'pos_seg(2) => an_sig(2)']);
  });

  // A handout may declare `a : in bit` (Bab 1 behavioral). IEEE 1164 has no conversion
  // between `bit` and `std_logic` for a port map, so the testbench gives each such port a
  // `bit` signal and converts on the board side of it - in the port's own direction.
  test('bridges a port declared bit through a bit signal, converting on the board side', () => {
    const text = generateTestbench('behavioral', new Set(['a', 'b', 's']), NEXYS_A7_BOARD_IO, {
      pins: new Map([
        ['a', 'sw[0]'],
        ['b', 'sw[1]'],
        ['s', 'led[0]'],
      ]),
      bitPorts: new Set(['a', 'b', 's']),
    });
    assert.match(text, /signal a_bit_sig : bit;/);
    assert.match(text, /signal s_bit_sig : bit;/);
    assert.match(text, /a => a_bit_sig/);
    assert.match(text, /s => s_bit_sig/);
    // An input converts board -> bit; an output converts bit -> board.
    assert.match(text, /a_bit_sig <= '1' when sw_sig\(0\) = '1' else '0';/);
    assert.match(text, /ledr_sig\(0\) <= '1' when s_bit_sig = '1' else '0';/);
  });
});

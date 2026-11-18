// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/** A handout's `.xdc` as I/O Planning takes it (PRD.md § 7.6). */

import { describe, expect, it } from 'vitest';
import { builtInBoard } from './boardCatalog';
import { readXdc } from './xdcImport';

const PINS = builtInBoard('nexys-a7').pins;

/** `bab7_alu.xdc` as the lab hands it out: separate `PACKAGE_PIN` and `IOSTANDARD` lines. */
const ALU_XDC = `
set_property IOSTANDARD LVCMOS18 [get_ports {a[2]}]
set_property IOSTANDARD LVCMOS18 [get_ports c]
set_property PACKAGE_PIN J15 [get_ports {a[0]}]
set_property PACKAGE_PIN L16 [get_ports {a[1]}]
set_property PACKAGE_PIN M13 [get_ports {a[2]}]
set_property PACKAGE_PIN R15 [get_ports {b[0]}]
set_property PACKAGE_PIN R17 [get_ports {b[1]}]
set_property PACKAGE_PIN T18 [get_ports {b[2]}]
set_property PACKAGE_PIN H17 [get_ports {result[0]}]
set_property PACKAGE_PIN K15 [get_ports {result[1]}]
set_property PACKAGE_PIN J13 [get_ports {result[2]}]
set_property PACKAGE_PIN N14 [get_ports {result[3]}]
set_property PACKAGE_PIN R18 [get_ports {result[4]}]
set_property PACKAGE_PIN V17 [get_ports {result[5]}]
set_property PACKAGE_PIN V10 [get_ports {sel[0]}]
set_property PACKAGE_PIN U11 [get_ports {sel[1]}]
set_property PACKAGE_PIN U18 [get_ports c]
`;

/** `bab5_seven_segment.xdc`: the display's two words, pinned bit by bit. */
const SEVEN_SEGMENT_XDC = `
set_property PACKAGE_PIN H15 [get_ports {led_seg[7]}]
set_property PACKAGE_PIN L18 [get_ports {led_seg[6]}]
set_property PACKAGE_PIN T11 [get_ports {led_seg[5]}]
set_property PACKAGE_PIN P15 [get_ports {led_seg[4]}]
set_property PACKAGE_PIN K13 [get_ports {led_seg[3]}]
set_property PACKAGE_PIN K16 [get_ports {led_seg[2]}]
set_property PACKAGE_PIN R10 [get_ports {led_seg[1]}]
set_property PACKAGE_PIN T10 [get_ports {led_seg[0]}]
set_property PACKAGE_PIN U13 [get_ports {pos_seg[7]}]
set_property PACKAGE_PIN K2 [get_ports {pos_seg[6]}]
set_property PACKAGE_PIN T14 [get_ports {pos_seg[5]}]
set_property PACKAGE_PIN P14 [get_ports {pos_seg[4]}]
set_property PACKAGE_PIN J14 [get_ports {pos_seg[3]}]
set_property PACKAGE_PIN T9 [get_ports {pos_seg[2]}]
set_property PACKAGE_PIN J18 [get_ports {pos_seg[1]}]
set_property PACKAGE_PIN J17 [get_ports {pos_seg[0]}]
set_property PACKAGE_PIN E3 [get_ports clk]
`;

const specOf = (text: string, port: string): string | undefined => readXdc(text, PINS).pins.find((pin) => pin.port === port)?.spec;

describe('readXdc', () => {
  it('reads separate set_property lines, keeping each port’s bits in the order the pin wrote them', () => {
    const { pins, problems } = readXdc(ALU_XDC, PINS);
    expect(problems).toEqual([]);
    // `sel[0]` is on SW[15] and `sel[1]` on SW[14]: the port's order, not the board's.
    expect(specOf(ALU_XDC, 'sel')).toBe('sw[15],sw[14]');
    expect(specOf(ALU_XDC, 'a')).toBe('sw[0],sw[1],sw[2]');
    expect(specOf(ALU_XDC, 'b')).toBe('sw[3],sw[4],sw[5]');
    expect(specOf(ALU_XDC, 'result')).toBe('led[0],led[1],led[2],led[3],led[4],led[5]');
    expect(pins.map((pin) => pin.port).sort()).toEqual(['a', 'b', 'c', 'result', 'sel']);
  });

  it('reads a scalar port written without braces', () => {
    expect(specOf(ALU_XDC, 'c')).toBe('sw[6]');
  });

  it('reads the -dict form Vivado 2020.2 writes', () => {
    const text = 'set_property -dict { PACKAGE_PIN E3 IOSTANDARD LVCMOS33 } [get_ports { clk }]';
    expect(specOf(text, 'clk')).toBe('clk100mhz');
  });

  it('collapses a whole board port to its own name, and leaves a slice as bits', () => {
    const { pins } = readXdc(SEVEN_SEGMENT_XDC, PINS);
    const byPort = new Map(pins.map((pin) => [pin.port, pin.spec]));
    // All eight digit enables: the board port, so I/O Planning shows `an` rather than 8 bits.
    expect(byPort.get('pos_seg')).toBe('an');
    // Seven segments plus the decimal point is not one board port: `CA`…`DP` are scalars.
    expect(byPort.get('led_seg')).toBe('ca,cb,cc,cd,ce,cf,cg,dp');
    expect(byPort.get('clk')).toBe('clk100mhz');
  });

  it('accepts both LVCMOS18 and LVCMOS33, and reports them without refusing the file', () => {
    const text = `${ALU_XDC}\nset_property IOSTANDARD LVCMOS33 [get_ports c]`;
    const { problems, iostandards } = readXdc(text, PINS);
    expect(problems).toEqual([]);
    expect(iostandards).toEqual(['LVCMOS18', 'LVCMOS33']);
  });

  it('reports a package pin the board does not have instead of guessing a board port', () => {
    const { pins, problems } = readXdc('set_property PACKAGE_PIN ZZ99 [get_ports {a[0]}]', PINS);
    expect(pins).toEqual([]);
    expect(problems).toEqual(['a[0] is on package pin ZZ99, which this board does not have.']);
  });

  it('reads a commented-out set_property, which is how the master XDC ships its template', () => {
    expect(specOf('#set_property PACKAGE_PIN E3 [get_ports {clk}]', 'clk')).toBe('clk100mhz');
  });
});

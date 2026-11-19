// SPDX-License-Identifier: GPL-2.0-only
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseNetlist } from './netlist.js';

/** GHDL's own netlist for an 8-bit ALU, trimmed to the statements that matter. */
const ALU = `
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity alu8 is
  port (
    a, b: in std_logic_vector (7 downto 0);
    op: in std_logic_vector (2 downto 0);
    y: out std_logic_vector (7 downto 0);
    zero, carry: out std_logic
  );
end entity;
architecture rtl of alu8 is
  subtype typ_wrap_a is std_logic_vector (7 downto 0);
  signal wrap_a: typ_wrap_a;
  signal wrap_b: typ_wrap_b;
  signal wrap_op: typ_wrap_op;
  signal wrap_y: typ_wrap_y;
  signal wrap_zero: std_logic;
  signal wrap_carry: std_logic;
  signal sum : std_logic_vector (8 downto 0);
  signal n4 : std_logic_vector (8 downto 0);
  signal n13 : std_logic_vector (7 downto 0);
  signal n6 : std_logic_vector (8 downto 0);
  signal n7 : std_logic_vector (8 downto 0);
  signal n16 : std_logic_vector (7 downto 0);
  signal n34 : std_logic_vector (7 downto 0);
begin
  wrap_a <= typ_wrap_a(a);
  wrap_b <= typ_wrap_b(b);
  wrap_op <= typ_wrap_op(op);
  y <= std_logic_vector(wrap_y);
  zero <= wrap_zero;
  carry <= wrap_carry;
  wrap_y <= n34;
  -- alu8.vhd:11:10
  sum <= n7; -- (signal)
  -- alu8.vhd:13:30
  n7 <= std_logic_vector (unsigned (n4) + unsigned (n6));
  -- alu8.vhd:18:55
  n13 <= std_logic_vector (unsigned (wrap_a) - unsigned (wrap_b));
  -- alu8.vhd:19:28
  n16 <= wrap_a and wrap_b;
end rtl;
`;

/** GHDL's netlist for a clocked counter: the process body is a register. */
const COUNTER = `
library ieee;
use ieee.std_logic_1164.all;
entity counter_demo is
  port ( clk : in std_logic; en : in std_logic; cnt : out std_logic_vector(3 downto 0) );
end entity;
architecture rtl of counter_demo is
  signal wrap_clk: std_logic;
  signal wrap_en: std_logic;
  signal wrap_cnt: std_logic_vector (3 downto 0);
  signal c : std_logic_vector (3 downto 0);
  signal n6 : std_logic_vector (3 downto 0);
  signal n12 : std_logic_vector (3 downto 0);
begin
  wrap_clk <= clk;
  wrap_en <= en;
  cnt <= std_logic_vector(wrap_cnt);
  wrap_cnt <= c;
  -- counter.vhd:18:16
  n6 <= std_logic_vector (unsigned (c) + unsigned'("0001"));
  -- counter.vhd:11:10
  c <= n12; -- (isignal)
  process (wrap_clk)
  begin
    if rising_edge (wrap_clk) then
      n12 <= n6;
    end if;
  end process;
end rtl;
`;

describe('parseNetlist', () => {
  test('reads the design ports, with their directions and widths', () => {
    const wire = parseNetlist(ALU, 'alu8');
    const ports = wire.nodes.filter((node) => node.kind === 'port');
    assert.deepEqual(
      ports.map((port) => [port.name, port.op, port.width]),
      [
        ['a', 'IN', 8],
        ['b', 'IN', 8],
        ['op', 'IN', 3],
        ['y', 'OUT', 8],
        ['zero', 'OUT', 1],
        ['carry', 'OUT', 1],
      ],
    );
  });

  // GHDL hands each port to a working copy (`wrap_a`). Those are the port, not a block:
  // leaving them in draws every port twice and buries the logic in pass-through nodes.
  test("collapses GHDL's `wrap_` working copies onto the port", () => {
    const wire = parseNetlist(ALU, 'alu8');
    assert.equal(
      wire.nodes.some((node) => node.name.startsWith('wrap_')),
      false,
    );
    assert.ok(wire.edges.every((edge) => !edge.from.startsWith('wrap_') && !edge.to.startsWith('wrap_')));
  });

  test('labels a block by the operator its assignment came from', () => {
    const wire = parseNetlist(ALU, 'alu8');
    const opOf = (name: string) => wire.nodes.find((node) => node.name === name)?.op;
    assert.equal(opOf('n7'), 'ADD');
    assert.equal(opOf('n13'), 'SUB');
    assert.equal(opOf('n16'), 'AND');
  });

  // A clocked assignment is a register in the drawing, not a mux: the student needs to
  // see the storage boundary the process created.
  test('draws the statement inside rising_edge as a register', () => {
    const wire = parseNetlist(COUNTER, 'counter_demo');
    const register = wire.nodes.find((node) => node.name === 'n12');
    assert.equal(register?.kind, 'reg');
    assert.equal(register?.op, 'REG');
  });

  // The comment GHDL writes above a statement is the only link back to the student's code.
  test('keeps the source line GHDL attributes a block to', () => {
    const wire = parseNetlist(ALU, 'alu8');
    assert.deepEqual(
      { file: wire.nodes.find((node) => node.name === 'n13')?.file, line: wire.nodes.find((node) => node.name === 'n13')?.line },
      { file: 'alu8.vhd', line: 18 },
    );
  });

  // GHDL writes `-- (signal)` after a statement; reading the `--` as the start of a
  // comment that swallows the rest of the line is fine, but letting it end the statement
  // early loses the assignment entirely.
  test('reads a statement that carries a trailing comment', () => {
    const wire = parseNetlist(ALU, 'alu8');
    assert.ok(wire.edges.some((edge) => edge.from === 'n7' && edge.to === 'sum'));
  });

  // A signal nothing reads and nothing drives is not part of the picture; a port always is.
  test('drops signals that take part in no connection', () => {
    const wire = parseNetlist(`${ALU}\n-- nothing\n`, 'alu8');
    assert.deepEqual(
      wire.nodes.filter((node) => node.kind !== 'port' && !wire.edges.some((edge) => edge.from === node.name || edge.to === node.name)),
      [],
    );
  });

  test('names the design it drew', () => {
    assert.equal(parseNetlist(ALU, 'alu8').top, 'alu8');
  });
});

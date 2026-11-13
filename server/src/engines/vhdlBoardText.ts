// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * The parts of the VHDL board testbench that follow the board (docs/board_io_v2_spec.md
 * § 7.2, § 7.4): signal widths and rest levels, the port map's actuals, the legacy
 * `rst`, the clock period, the `STIM` parse and the `STATE` assembly, and the
 * multiplexed-display decoder. Every number is written out as a literal. With
 * `DEFAULT_BOARD_IO` each part is exactly the text it was before boards had shapes, so
 * the golden testbenches do not change. Pure.
 */

import {
  declaresGroup,
  LEGACY_RESET_PORT,
  type BoardBinding,
  type BoardIo,
  type MultiplexedDisplays,
  type SevenSegment,
} from './boardPorts.js';
import { SEGMENT_COUNT, SEGMENT_COUNT_WITH_POINT } from './boardLimits.js';
import { buttonCount, displayWordWidth, stimFields, type StimField } from './boardShape.js';
import { clockHalfPeriodPs, DISPLAY_PERSIST_MS, vhdlTime } from './boardTiming.js';

/** `'1'` for an active-low part at rest or off, else `'0'`. */
export const offLevel = (activeLow: boolean): string => (activeLow ? "'1'" : "'0'");

const vector = (width: number): string => `std_logic_vector(${width - 1} downto 0)`;

/** The actual of a port map association: `key_sig`, or `key_sig(0)` for a scalar port. */
export function vhdlActual({ signal, index }: BoardBinding): string {
  return index === undefined ? signal : `${signal}(${index})`;
}

function displaySignals(displays: SevenSegment): string[] {
  const off = offLevel(displays.activeLow);
  if (displays.kind === 'independent') {
    const names = displays.ports.map((_, index) => `hex${index}_sig`).join(', ');
    return [`  signal ${names}`, `    : ${vector(displays.width)} := (others => ${off});`];
  }
  const point = displays.decimalPoint === undefined ? [] : [`  signal dp_sig     : std_logic := ${off};`];
  return [
    `  signal seg_sig    : ${vector(SEGMENT_COUNT)} := (others => ${off});`,
    ...point,
    `  signal an_sig     : ${vector(displays.digits)} := (others => ${offLevel(displays.digitEnablesActiveLow)});`,
    ...decoderDeclarations(displays),
  ];
}

/** Every testbench-side board signal, at the level its part rests at or is off at. */
export function signalDeclarations(board: BoardIo): string {
  const reset = board.resetButton === undefined ? [] : [`  signal rstbtn_sig : std_logic := ${offLevel(board.resetButton.activeLow)};`];
  return [
    "  signal clk_sig    : std_logic := '0';",
    "  signal clk500_sig : std_logic := '0';",
    "  signal rst_sig    : std_logic := '0';",
    `  signal sw_sig     : ${vector(board.switches.count)} := (others => '0');`,
    `  signal key_sig    : ${vector(buttonCount(board))} := (others => ${offLevel(board.pushbuttons.activeLow)});`,
    ...reset,
    `  signal ledr_sig   : ${vector(board.leds.count)} := (others => '0');`,
    ...displaySignals(board.sevenSegment),
  ].join('\n');
}

/**
 * The legacy `rst` (§ 7.2): asserted while the reset button is pressed on a board with
 * one, else while button 0 is pressed — when the entity has the buttons to read it from.
 * Without a source it is held deasserted rather than left floating.
 */
export function legacyResetDrive(ports: ReadonlySet<string>, board: BoardIo): string {
  if (!ports.has(LEGACY_RESET_PORT)) return '';
  const { resetButton, pushbuttons } = board;
  if (resetButton !== undefined) {
    const level = resetButton.activeLow ? 'not rstbtn_sig' : 'rstbtn_sig';
    return `\n  rst_sig <= ${level}; -- legacy rst: asserted while ${resetButton.port} is pressed`;
  }
  if (!declaresGroup(ports, pushbuttons.group)) return `\n  rst_sig <= '0';`;
  if (pushbuttons.activeLow) return `\n  rst_sig <= not key_sig(0);`;
  return `\n  rst_sig <= key_sig(0); -- legacy rst: asserted while button 0 is pressed`;
}

/** `10 ns` at 50 MHz, `5 ns` at 100 MHz, `6734 ps` at 74.25 MHz. */
export function clockHalfPeriod(board: BoardIo): string {
  return vhdlTime(clockHalfPeriodPs(board.clock.mhz));
}

/** The statements that apply one `STIM` record, field by field (D5). */
export function stimApply(board: BoardIo): string {
  let offset = 1;
  return stimFields(board)
    .map((field) => {
      const text = applyField(field, offset);
      offset += field.width;
      return text;
    })
    .join('\n');
}

function applyField({ signal, width, role }: StimField, offset: number): string {
  const indent = '            ';
  if (role === 'reset') return `${indent}${signal} <= '1' when rec(${offset}) = '1' else '0';`;
  return [
    `${indent}for i in 0 to ${width - 1} loop`,
    `${indent}  ${signal}(${width - 1} - i) <= '1' when rec(${offset} + i) = '1' else '0';`,
    `${indent}end loop;`,
  ].join('\n');
}

const NOW_BITS = '      now_bits := ';
const FIRST_TERM = 'slv2str(ledr_sig)';
/** Each further line starts its `&` under the space after the first term. */
const CONTINUATION = ' '.repeat(NOW_BITS.length + FIRST_TERM.length + 1);
const TERMS_ON_FIRST_LINE = 3;
const TERMS_PER_LINE = 2;

/** `now_bits := slv2str(ledr_sig) & …;`, wrapped three terms then two per line, as it always was. */
function independentAssembly(displayCount: number): string {
  const terms = ['ledr_sig', ...Array.from({ length: displayCount }, (_, index) => `hex${index}_sig`)].map((signal) => `slv2str(${signal})`);
  const lines = [terms.slice(0, TERMS_ON_FIRST_LINE).join(' & ')];
  for (let at = TERMS_ON_FIRST_LINE; at < terms.length; at += TERMS_PER_LINE) lines.push(terms.slice(at, at + TERMS_PER_LINE).join(' & '));
  return `${NOW_BITS}${lines.join(`\n${CONTINUATION}& `)};`;
}

/**
 * The `STATE` bits, built on every poll: the LEDs, then each display's word. A
 * multiplexed board's poll starts from its own copies of the capture (§ 7.4), so
 * every digit of one `STATE` is decoded from the same instant.
 */
export function stateAssembly(board: BoardIo): string {
  const displays = board.sevenSegment;
  if (displays.kind === 'independent') return independentAssembly(displays.ports.length);
  return `${ioPollCopies(board)}${multiplexedAssembly(displays, board.leds.count, displayWordWidth(board))}`;
}

/** The io process's extra variable for the decoder: the word of the display being built. */
export function ioVariables(board: BoardIo): string {
  if (board.sevenSegment.kind !== 'multiplexed') return '';
  const digits = board.sevenSegment.digits;
  return [
    '',
    `    variable word : ${vector(displayWordWidth(board))};`,
    `    variable held : digit_words_t := (others => (others => SEG_OFF));`,
    `    variable seen : ${vector(digits)} := (others => '0');`,
    '    variable lit_at : digit_times_t := (others => 0 ns);',
  ].join('\n');
}

// --- The multiplexed-display decoder (§ 7.4) ---------------------------------------

/** `dp_sig & seg_sig`, or `seg_sig` alone without a decimal point. */
const liveWord = (displays: MultiplexedDisplays): string => (displays.decimalPoint === undefined ? 'seg_sig' : 'dp_sig & seg_sig');

function decoderDeclarations(displays: MultiplexedDisplays): string[] {
  const last = displays.digits - 1;
  const width = displays.decimalPoint === undefined ? SEGMENT_COUNT : SEGMENT_COUNT_WITH_POINT;
  return [
    `  constant DISPLAY_PERSIST : time := ${DISPLAY_PERSIST_MS} ms;`,
    `  constant AN_ON   : std_logic := ${displays.digitEnablesActiveLow ? "'0'" : "'1'"};`,
    `  constant SEG_OFF : std_logic := ${offLevel(displays.activeLow)};`,
    `  type digit_words_t is array (0 to ${last}) of ${vector(width)};`,
    `  type digit_times_t is array (0 to ${last}) of time;`,
    '  signal digit_word : digit_words_t := (others => (others => SEG_OFF));',
    '  signal digit_last : digit_times_t := (others => 0 ns);',
    `  signal digit_seen : ${vector(displays.digits)} := (others => '0');`,
  ];
}

/**
 * Latches the segments each digit last showed while it was enabled; empty for
 * independent displays. The capture waits one delta after a change: in the same delta
 * the enables and the segments a DUT drives are each partly old, and which of the two
 * the poll observes first is a property of the delta cycle, not of the board (§ 7.4).
 */
export function decoderProcess(board: BoardIo): string {
  const displays = board.sevenSegment;
  if (displays.kind !== 'multiplexed') return '';
  const sensitivity = displays.decimalPoint === undefined ? 'seg_sig, an_sig' : 'seg_sig, dp_sig, an_sig';
  return `

  -- A multiplexed display, decoded into stable digits (docs/board_io_v2_spec.md § 7.4):
  -- each digit keeps the segments it showed while enabled, for DISPLAY_PERSIST.
  mux_capture : process
    variable fired : boolean := false;
  begin
    if fired then
      fired := false;
      for d in 0 to ${displays.digits - 1} loop
        if an_sig(d) = AN_ON then
          digit_word(d) <= ${liveWord(displays)};
          digit_last(d) <= now;
          digit_seen(d) <= '1';
        end if;
      end loop;
    else
      fired := true;
      wait for 0 ns;
    end if;
    wait on ${sensitivity};
  end process;`;
}

/** The poll's copies of the capture's signals: one copy keeps the digits of one STATE consistent. */
export function ioPollCopies(board: BoardIo): string {
  if (board.sevenSegment.kind !== 'multiplexed') return '';
  return '      held := digit_word;\n      seen := digit_seen;\n      lit_at := digit_last;\n';
}

function multiplexedAssembly(displays: MultiplexedDisplays, ledCount: number, width: number): string {
  return `      now_bits(1 to ${ledCount}) := slv2str(ledr_sig);
      for d in 0 to ${displays.digits - 1} loop
        if seen(d) = '1' and now - lit_at(d) <= DISPLAY_PERSIST then
          word := held(d);
        else
          word := (others => SEG_OFF);
        end if;
        now_bits(${ledCount + 1} + d * ${width} to ${ledCount} + (d + 1) * ${width}) := slv2str(word);
      end loop;`;
}

// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * PRD.md § 10.3's readout. The backend paces a board run to real time, so a run GHDL
 * can hold reads `1.00×` and one it cannot reads below it; without the ratio beside
 * the simulated seconds, a slow design reads as a stalled one.
 */
import { describe, expect, it } from 'vitest';
import { formatSpan, formatSpeed, simulationReadout } from './simulationSpeed';

describe('formatSpan', () => {
  it('keeps a span in the unit that reads shortest', () => {
    expect(formatSpan(950)).toBe('950 ns');
    expect(formatSpan(12_500)).toBe('12.5 us');
    expect(formatSpan(1_680_000)).toBe('1.68 ms');
    expect(formatSpan(4_200_000_000)).toBe('4.2 s');
  });

  it('drops a trailing .0 rather than printing 1.0 us', () => {
    expect(formatSpan(1_000)).toBe('1 us');
    expect(formatSpan(1_000_000)).toBe('1 ms');
  });

  it('has no time for a value that is not one', () => {
    expect(formatSpan(-1)).toBe('—');
    expect(formatSpan(Number.NaN)).toBe('—');
  });
});

describe('formatSpeed', () => {
  it('reads 1x when the simulation keeps up with the wall clock', () => {
    expect(formatSpeed(1_000, 1_000)).toBe('1.00×');
  });

  it('reads a paced run at 1x, which is what the backend pacing produces', () => {
    // Observed on the Bab 6 FSM through the real backend: 59840 ms simulated in
    // 59837 ms of wall clock.
    expect(formatSpeed(59_840, 59_837)).toBe('1.00×');
  });

  it('reads a run GHDL cannot hold at real time below 1x', () => {
    expect(formatSpeed(168, 72_000)).toBe('0.002×');
  });

  it('says "< 0.001x" instead of rounding a slow run to zero', () => {
    expect(formatSpeed(1, 100_000)).toBe('< 0.001×');
  });

  it('distinguishes the fast end too, so a cached design is not "10x-ish"', () => {
    expect(formatSpeed(25_000, 1_000)).toBe('25×');
  });

  it('has no ratio before any time has passed, or after a run that did nothing', () => {
    // A zero would read as "infinitely fast" on the first frame of every run.
    expect(formatSpeed(0, 0)).toBe('—');
    expect(formatSpeed(0, 500)).toBe('—');
    expect(formatSpeed(10, 0)).toBe('—');
  });
});

describe('simulationReadout', () => {
  it('shows simulated time and the ratio together, never one alone', () => {
    expect(simulationReadout(59_840, 59_837)).toBe('59.84 s simulated · 1.00× real time');
  });

  it('rounds a sub-millisecond run to the microsecond', () => {
    expect(simulationReadout(0.02, 1_000)).toBe('20 us simulated · < 0.001× real time');
  });
});

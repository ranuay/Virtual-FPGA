// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * The simulated-time readout (PRD.md § 10.3): how far the design has run, and
 * how fast that is against the wall clock. Both are needed together, because
 * the backend paces a run to real time (§ 5.9 / § 5.13 of the implementation
 * plan): a design GHDL can hold at 1× reads `1.00×`, and one it cannot - the
 * 100 MHz blink of § 10.3 - reads below it, which is the number that tells a
 * student the run is not broken, just slow.
 *
 * Pure, so the roundings that make it readable are pinned by a test rather than
 * discovered in the pane.
 */

/** One time span, in the unit that keeps it short: `950 ns`, `12.5 us`, `1.7 ms`, `4.20 s`. */
export function formatSpan(ns: number): string {
  if (!Number.isFinite(ns) || ns < 0) return '—';
  if (ns < 1_000) return `${Math.round(ns)} ns`;
  if (ns < 1_000_000) return `${round(ns / 1_000, ns < 100_000 ? 1 : 0)} us`;
  if (ns < 1_000_000_000) return `${round(ns / 1_000_000, ns < 10_000_000 ? 2 : 1)} ms`;
  return `${round(ns / 1_000_000_000, 2)} s`;
}

/**
 * Simulated time against real time, as a factor: `1.00×` is real time, `0.25×` is
 * four times slower than the board (one real second buys a quarter second of the
 * design's own time). Below `0.001×` three decimals would all be zeroes, so it reads
 * `< 0.001×` instead of a rounded lie.
 */
export function formatSpeed(simMs: number, wallMs: number): string {
  if (!Number.isFinite(simMs) || !Number.isFinite(wallMs) || wallMs <= 0) return '—';
  const ratio = simMs / wallMs;
  if (ratio === 0) return '—';
  if (ratio < 0.001) return '< 0.001×';
  if (ratio < 0.01) return `${ratio.toFixed(3)}×`;
  if (ratio < 0.1) return `${ratio.toFixed(2)}×`;
  if (ratio < 10) return `${ratio.toFixed(2)}×`;
  return `${Math.round(ratio)}×`;
}

/**
 * The whole readout: `168 ms simulated · 1.00× real time`. `wallMs` covers the run
 * from its start, so the first frames read low - the simulator is still elaborating -
 * which is why `simMs === 0` shows the speed as `—` rather than `0×`.
 */
export function simulationReadout(simMs: number, wallMs: number): string {
  return `${formatSpan(simMs * 1_000_000)} simulated · ${formatSpeed(simMs, wallMs)} real time`;
}

/** `x` to `digits` places, without the trailing `.0` a round number would carry. */
function round(x: number, digits: number): string {
  const text = x.toFixed(digits);
  return digits > 0 && text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

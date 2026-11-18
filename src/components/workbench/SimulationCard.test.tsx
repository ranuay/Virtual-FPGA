// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * Start waits for Program Device (PRD.md § 7.5): the board flow runs the design, so
 * Start has nothing to run until the board is programmed. Stop is never locked, or a
 * run already going would be trapped.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityBarRun } from './ActivityBar';
import { SimulationCard } from './SimulationCard';

const card = (startBlocked?: string, status: 'stopped' | 'compiling' | 'running' = 'stopped'): string =>
  renderToStaticMarkup(
    <SimulationCard
      status={status}
      elapsedSeconds={0}
      topFile="nexys_a7.vhd"
      startBlocked={startBlocked}
      onStart={() => {}}
      onStop={() => {}}
    />,
  );

/** The card's own Start/Stop button, which is the first button in the section. */
const cardButton = (html: string): string => html.match(/<button[^>]*class="wb-simcard__button[^"]*"[^>]*>/)?.[0] ?? '';

const rail = (startBlocked?: string, status: 'stopped' | 'compiling' | 'running' = 'stopped'): string =>
  renderToStaticMarkup(<ActivityBarRun status={status} topFile="nexys_a7.vhd" startBlocked={startBlocked} onStart={() => {}} onStop={() => {}} />);

describe('Start waits for Program Device', () => {
  it('locks Start, and says so, when the board is not programmed', () => {
    const reason = 'Run Program Device in the Flow Navigator first.';
    const button = cardButton(card(reason));
    expect(button).toContain('disabled');
    expect(button).toContain(reason);
    expect(rail(reason)).toContain('disabled');
  });

  it('leaves Start enabled once the board is programmed', () => {
    const button = cardButton(card(undefined));
    expect(button).not.toContain('disabled');
    expect(rail(undefined)).not.toContain('disabled');
  });

  it('never locks Stop, so a run already going can always be stopped', () => {
    const reason = 'Program Device has not completed.';
    expect(cardButton(card(reason, 'running'))).not.toContain('disabled');
    expect(rail(reason, 'running')).not.toContain('disabled');
  });

  it('still locks both while compiling', () => {
    expect(cardButton(card(undefined, 'compiling'))).toContain('disabled');
    expect(rail(undefined, 'compiling')).toContain('disabled');
  });
});

// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import { useState } from 'react';
import { cx } from '../board';
import { pinsOf } from '../../boards/parsePins';
import type { BoardPins } from '../../boards/types';
import { Dialog } from './Dialog';
import { ChipIcon, PlayIcon } from './icons';
import content from './designFlowContent.json';
import {
  BOARD_STAGE_TEXT,
  FLOW_STEPS,
  STATUS_TEXT,
  STEP_LABEL,
  unmetPrerequisites,
  canRun,
  type FlowStep,
  type FlowStepRow,
  type FlowWire,
  type FlowWirePort,
} from './designFlow';
import './DesignFlowPanel.css';

const EXPLANATION: Readonly<Record<FlowStep, { vivado: string; why: string; here: string }>> = content;

export interface DesignFlowPanelProps {
  /** The backend's latest `FLOW` frame; null before the first one arrives. */
  flow: FlowWire | null;
  /** A step or a simulation is running: every button is locked until it finishes (§ 7.8). */
  busy: boolean;
  /** The board's package pins (PRD.md § 4.2), so each row can name the pin on the real part. */
  pins: BoardPins;
  onRun: (step: FlowStep) => void;
  /** I/O Planning's pin for one design port (§ 7.6); undefined goes back to the name match. */
  onPin: (port: string, boardPort: string | undefined) => void;
}

interface Jump {
  readonly step: FlowStep;
  readonly missing: readonly FlowStep[];
}

/**
 * § 7.5: a step whose prerequisites are missing asks first; the ones that can run are
 * asked for directly. Program Device is never asked for — its button is disabled instead.
 */
export function DesignFlowPanel({ flow, busy, pins, onRun, onPin }: DesignFlowPanelProps) {
  const [explained, setExplained] = useState<FlowStep | null>(null);
  const [jump, setJump] = useState<Jump | null>(null);
  const request = (step: FlowStep): void => {
    const missing = unmetPrerequisites(flow, step);
    if (missing.length > 0) setJump({ step, missing });
    else onRun(step);
  };
  return (
    <section className="wb-flow">
      <div className="wb-flow__header">
        <ChipIcon aria-hidden="true" />
        <h2 className="wb-flow__title">Design Flow</h2>
        {flow !== null && <span className={cx('wb-flow__board', `is-${flow.board}`)}>{BOARD_STAGE_TEXT[flow.board]}</span>}
      </div>
      <ol className="wb-flow__steps">
        {FLOW_STEPS.map((step) => (
          <FlowStepItem
            key={step}
            step={step}
            entry={flow?.steps.find((candidate) => candidate.step === step) ?? { step, status: 'not_run', educational: false }}
            open={explained === step}
            disabled={busy || (flow === null ? step === 'program' : !canRun(flow, step))}
            onToggle={() => setExplained(explained === step ? null : step)}
            onRun={() => request(step)}
          />
        ))}
      </ol>
      {flow !== null && flow.ports.length > 0 && <PortTable flow={flow} pins={pins} busy={busy} onPin={onPin} />}
      {jump !== null && <JumpDialog step={jump.step} missing={jump.missing} onRun={onRun} onClose={() => setJump(null)} />}
    </section>
  );
}

interface FlowStepItemProps {
  step: FlowStep;
  entry: FlowStepRow;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
  onRun: () => void;
}

/** One step: its status, its Run button, and — when opened — what it does in Vivado and here. */
function FlowStepItem({ step, entry, open, disabled, onToggle, onRun }: FlowStepItemProps) {
  return (
    <li className={cx('wb-flow__step', `is-${entry.status}`)}>
      <div className="wb-flow__row">
        <span className="wb-flow__dot" aria-hidden="true" />
        <button type="button" className="wb-flow__label" aria-expanded={open} onClick={onToggle}>
          {STEP_LABEL[step]}
        </button>
        <span className="wb-flow__status">{STATUS_TEXT[entry.status]}</span>
        {entry.educational && <span className="wb-flow__badge">Simulated</span>}
        <button type="button" className="wb-flow__run" aria-label={`Run ${STEP_LABEL[step]}`} disabled={disabled} onClick={onRun}>
          <PlayIcon aria-hidden="true" />
        </button>
      </div>
      {open && (
        <dl className="wb-flow__explain">
          <dt>In Vivado</dt>
          <dd>{EXPLANATION[step].vivado}</dd>
          <dt>Why it is needed</dt>
          <dd>{EXPLANATION[step].why}</dd>
          <dt>Here</dt>
          <dd>{EXPLANATION[step].here}</dd>
        </dl>
      )}
    </li>
  );
}

/**
 * § 7.6: the top-level ports, and the board port each is pinned to. A port with choices
 * gets a select: picking one sends the pin, and the empty option goes back to the name
 * match. A port the board offers no candidate for stays plain text.
 */
function PortTable({ flow, pins, busy, onPin }: { flow: FlowWire; pins: BoardPins; busy: boolean; onPin: DesignFlowPanelProps['onPin'] }) {
  const unpinned = flow.ports.filter((port) => (port.pin ?? port.constraint) === undefined).length;
  return (
    <div className="wb-flow__ports">
      <h3 className="wb-flow__ports-title">
        I/O ports
        {unpinned > 0 && <span className="wb-flow__ports-note">{unpinned} without a pin</span>}
      </h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Port</th>
            <th scope="col">Dir</th>
            <th scope="col">Bits</th>
            <th scope="col">Board port</th>
            <th scope="col">Package pin</th>
          </tr>
        </thead>
        <tbody>
          {flow.ports.map((port) => (
            <tr key={port.name}>
              <td>
                <code>{port.name}</code>
              </td>
              <td>{port.direction}</td>
              <td>{port.width ?? '—'}</td>
              <td>
                <PinCell port={port} busy={busy} onPin={onPin} />
              </td>
              <td>
                <code>{pinsText(pins, port)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The package pins a row's board port lands on: `N17` for one bit, `J15…V10` for a
 * vector, `—` when the board names no pins for it. Showed beside the board port so the
 * student can find the same pin on the real Nexys A7 and in the master XDC.
 */
function pinsText(pins: BoardPins, port: FlowWirePort): string {
  // A word pin's label is the run of board ports (`CA…DP`), which names no pins itself.
  const list =
    port.bits === undefined
      ? pinsOf(pins, port.pin ?? port.constraint, port.width ?? 1)
      : port.bits.flatMap((bit) => pins[bit] ?? []);
  if (list === undefined || list.length === 0) return '—';
  if (list.length === 1) return list[0] ?? '—';
  return `${list[0]}…${list[list.length - 1]}`;
}

/** One row's board port: a select when the board offers candidates, plain text otherwise. */
function PinCell({ port, busy, onPin }: { port: FlowWirePort; busy: boolean; onPin: DesignFlowPanelProps['onPin'] }) {
  if (port.choices === undefined || port.choices.length === 0) {
    return <>{(port.pin ?? port.constraint) ?? <span className="wb-flow__unpinned">unassigned</span>}</>;
  }
  return (
    <select
      aria-label={`Board port for ${port.name}`}
      value={port.pin ?? port.constraint ?? ''}
      disabled={busy}
      onChange={(event) => onPin(port.name, event.target.value === '' ? undefined : event.target.value)}
    >
      <option value="">unassigned</option>
      {port.choices.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </select>
  );
}

interface JumpDialogProps {
  step: FlowStep;
  missing: readonly FlowStep[];
  onRun: (step: FlowStep) => void;
  onClose: () => void;
}

/** § 7.5's dialog: name the missing steps, then offer to run them in order. */
function JumpDialog({ step, missing, onRun, onClose }: JumpDialogProps) {
  const count = missing.length === 1 ? 'one step' : `${missing.length} steps`;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${STEP_LABEL[step]} first needs ${count}`}
      subtitle="They run in flow order, then this step."
      icon={<ChipIcon />}
      describedBy="wb-flow-jump-list"
      footer={
        <div className="wb-dialog__actions">
          <button type="button" className="wb-dialog__secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="wb-dialog__close"
            autoFocus
            onClick={() => {
              onClose();
              onRun(step);
            }}
          >
            Run them
          </button>
        </div>
      }
    >
      <ul id="wb-flow-jump-list" className="wb-flow__jump-list">
        {missing.map((needed) => (
          <li key={needed}>{STEP_LABEL[needed]}</li>
        ))}
      </ul>
    </Dialog>
  );
}
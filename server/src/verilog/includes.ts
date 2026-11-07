// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

/**
 * Finding a circular `` `include `` before Icarus is asked to compile it
 * (docs/Verilog_implementation_plan.md § 5.4, measurement M23a). Icarus reports such a cycle
 * only once it has exhausted its file descriptors, and on 12.0 it does not exit at all: the
 * run then waits out the compile timeout and the student sees nothing. The cycle is
 * decidable from the files already in hand, so it is found here instead.
 *
 * Only cycles are reported, and only ones no conditional guards: a header that is not in the
 * project is left to Icarus, which reports it in milliseconds and names the file, and an
 * `` `include `` behind an `ifdef` is left to it too, because a false guard makes a cycle
 * legal and only the preprocessor knows which branch runs.
 *
 * Comments and string literals are skipped, so an `` `include `` inside either is not a
 * directive. A macro as the argument (`` `include `HEADER ``) is not followed: its value
 * is only known once the file has been preprocessed.
 *
 * Pure: it reads the text it is given and touches nothing.
 */

import type { VhdlFileInput } from '../protocol.js';

export type IncludeCheck = { readonly ok: true } | { readonly ok: false; readonly text: string };

interface Directive {
  /** The file the directive appears in, as the project names it. */
  readonly in: string;
  /** 1-based, as a student counts lines. */
  readonly line: number;
  /** The name between the quotes, verbatim. */
  readonly target: string;
}

/** Comments, string literals, then backtick directives — leftmost match wins, so code inside the first two is skipped. */
const TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"((?:[^"\\\n]|\\.)*)"?|`([A-Za-z_]\w*)([^\n]*)/g;
/** What follows the directive's name: optional spaces, then the quoted file. */
const QUOTED_ARGUMENT = /^\s+"([^"\n]+)"/;
const INCLUDE = 'include';

/** The file an `` `include `` names, or nothing for another directive or one without a quoted argument. */
function includeTarget(name: string | undefined, rest: string | undefined): string | undefined {
  return name === INCLUDE ? QUOTED_ARGUMENT.exec(rest ?? '')?.[1] : undefined;
}

/** How a directive changes the conditional nesting: opens one, closes one, or neither. */
function conditionalStep(name: string | undefined): number {
  if (name === 'ifdef' || name === 'ifndef' || name === 'if') return 1;
  return name === 'endif' ? -1 : 0;
}

/**
 * Every `` `include `` in `source` that is not behind a conditional, with the line it is on.
 * A conditional (`ifdef`, `ifndef`, `if` … `endif`) may be false at preprocess time, and only
 * the preprocessor knows: an `` `include `` inside one is left to Icarus, which accepts a cycle
 * there when the guard is not taken (measured: Icarus 13.0 compiles it in 59 ms). Counting the
 * nesting is enough — `else` and `elsif` change which branch runs, not whether one does.
 */
function directivesIn(source: string, file: string): Directive[] {
  const found: Directive[] = [];
  let line = 1;
  let scanned = 0;
  let conditionals = 0;
  for (const match of source.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    for (; scanned < index; scanned += 1) if (source[scanned] === '\n') line += 1;
    conditionals = Math.max(0, conditionals + conditionalStep(match[2]));
    const target = conditionals === 0 ? includeTarget(match[2], match[3]) : undefined;
    if (target !== undefined) found.push({ in: file, line, target });
  }
  return found;
}

/** The closing edge's position, then the whole loop: `b.vh:1: `include "a.vh" — the includes form a cycle: a.vh → b.vh → a.vh.` */
function cycleText(cycle: readonly Directive[]): string {
  const closing = cycle[cycle.length - 1] as Directive;
  const chain = [...cycle.map((directive) => directive.in), closing.target];
  return `${closing.in}:${closing.line}: \`include "${closing.target}" — the includes form a cycle: ${chain.join(' → ')}.`;
}

/**
 * The first cycle among the project's includes, or `{ ok: true }`. Every file is
 * searched, not only what the top reaches: Icarus preprocesses each one it is given, so a
 * cycle in a file the top never includes hangs it just the same.
 */
export function checkIncludes(files: readonly VhdlFileInput[], topFile: string): IncludeCheck {
  const edges = new Map<string, readonly Directive[]>();
  for (const file of files) edges.set(file.name, directivesIn(file.content, file.name));

  const finished = new Set<string>();
  const path: Directive[] = [];

  /** `<file>`'s own cycle if it has one, following each include depth-first. */
  const walk = (file: string): string | undefined => {
    // The file is already on the path: the directives from there on are the cycle.
    const repeat = path.findIndex((directive) => directive.in === file);
    if (repeat >= 0) return cycleText(path.slice(repeat));
    if (finished.has(file)) return undefined;
    for (const directive of edges.get(file) ?? []) {
      if (!edges.has(directive.target)) continue; // not a file of this project: Icarus's to report
      path.push(directive);
      const problem = walk(directive.target);
      path.pop();
      if (problem !== undefined) return problem;
    }
    finished.add(file);
    return undefined;
  };

  for (const file of [topFile, ...files.map(({ name }) => name).filter((name) => name !== topFile)]) {
    const problem = walk(file);
    if (problem !== undefined) return { ok: false, text: problem };
  }
  return { ok: true };
}

// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkIncludes } from './includes.js';
import type { VhdlFileInput } from '../protocol.js';

const file = (name: string, content: string): VhdlFileInput => ({ name, content });
const TOP = "`include \"a.vh\"\nmodule top(output [9:0] LEDR);\n  assign LEDR = 10'd0;\nendmodule\n";
const problemOf = (files: readonly VhdlFileInput[], topFile = 'top.v'): string => {
  const check = checkIncludes(files, topFile);
  assert.equal(check.ok, false, 'expected a problem');
  return check.ok ? '' : check.text;
};

describe('checkIncludes', () => {
  test('accepts a project whose includes resolve, and reports nothing', () => {
    const files = [file('top.v', TOP), file('a.vh', '`include "b.vh"\n'), file('b.vh', '`define X 1\n')];
    assert.deepEqual(checkIncludes(files, 'top.v'), { ok: true });
  });

  test('accepts a project with no includes at all', () => {
    assert.deepEqual(checkIncludes([file('top.v', "module top(output [9:0] LEDR);\n  assign LEDR = 10'd0;\nendmodule\n")], 'top.v'), {
      ok: true,
    });
  });

  test('reports a cycle, naming the closing include and the loop in order', () => {
    const files = [file('top.v', TOP), file('a.vh', '`include "b.vh"\n'), file('b.vh', '`include "a.vh"\n')];
    const text = problemOf(files);
    assert.match(text, /^b\.vh:1: `include "a\.vh"/);
    assert.match(text, /cycle: a\.vh → b\.vh → a\.vh/);
  });

  test('reports a file that includes itself', () => {
    const files = [file('top.v', TOP), file('a.vh', '`include "a.vh"\n')];
    assert.match(problemOf(files), /cycle: a\.vh → a\.vh/);
  });

  test('reports a cycle the top never reaches, because Icarus reads every file it is given', () => {
    const files = [
      file('top.v', "module top(output [9:0] LEDR);\n  assign LEDR = 10'd0;\nendmodule\n"),
      file('lonely.v', '`include "a.vh"\n'),
      file('a.vh', '`include "b.vh"\n'),
      file('b.vh', '`include "a.vh"\n'),
    ];
    assert.match(problemOf(files), /cycle/);
  });

  test('follows a diamond to the same header twice without calling it a cycle', () => {
    const files = [
      file('top.v', TOP),
      file('a.vh', '`include "b.vh"\n`include "c.vh"\n'),
      file('b.vh', '`include "d.vh"\n'),
      file('c.vh', '`include "d.vh"\n'),
      file('d.vh', '`define X 1\n'),
    ];
    assert.deepEqual(checkIncludes(files, 'top.v'), { ok: true });
  });

  test('leaves a missing include to Icarus, which reports it in milliseconds', () => {
    const files = [file('top.v', '`include "nowhere.vh"\nmodule top(output [9:0] LEDR);\n  assign LEDR = 10\'d0;\nendmodule\n')];
    assert.deepEqual(checkIncludes(files, 'top.v'), { ok: true });
  });

  test('ignores an include inside a line comment, a block comment, or a string', () => {
    const files = [
      file('top.v', "module top(output [9:0] LEDR);\n  assign LEDR = 10'd0;\nendmodule\n"),
      file('a.vh', '// `include "a.vh"\n/* `include "a.vh" */\n`define S "`include \\"a.vh\\""\n'),
    ];
    assert.deepEqual(checkIncludes(files, 'top.v'), { ok: true });
  });

  test('counts lines from 1, so the reported position matches the editor gutter', () => {
    const files = [file('top.v', TOP), file('a.vh', '\n\n`include "b.vh"\n'), file('b.vh', '`include "a.vh"\n')];
    assert.match(problemOf(files), /^b\.vh:1: /);
  });

  test('leaves an include behind a conditional to Icarus, which accepts a false guard', () => {
    // `ifdef PLATFORM_B` is never defined here, so Icarus compiles this and the cycle is not
    // one. The check cannot know which branch runs, so it does not count the edge at all.
    const files = [
      file('top.v', '`ifdef PLATFORM_B\n`include "a.vh"\n`endif\nmodule top(output [9:0] LEDR);\n  assign LEDR = 10\'d0;\nendmodule\n'),
      file('a.vh', '`include "top.v"\n'),
    ];
    assert.deepEqual(checkIncludes(files, 'top.v'), { ok: true });
  });
});

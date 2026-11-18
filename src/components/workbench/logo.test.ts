// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The logo must stay small enough for Vite to inline it, or the single-file
 * demo build breaks.
 *
 * `tools/bundle.mjs` (`npm run demo`) inlines the built app into one .html and
 * refuses to write it while the page still references `assets/...`. Vite
 * decides which way an imported image goes by size: under
 * `build.assetsInlineLimit` (4 KB by default) it becomes a data URI; over it,
 * `dist/assets/acsl_logo-<hash>.png` plus a URL, and the bundle check throws.
 *
 * So replacing the emblem with a better, larger one would break `npm run demo`
 * without breaking any other test, and only at bundle time. This pins the
 * constraint where it is enforced, on the file itself: a unit test cannot
 * assert the data URI, because Vitest resolves an image import to a path
 * rather than running Vite's asset pipeline.
 */
const LOGO_PATH = fileURLToPath(new URL('../../Images/acsl_logo.png', import.meta.url));

/** Vite's `build.assetsInlineLimit` default, which `vite.config.ts` does not override. */
const ASSET_INLINE_LIMIT = 4096;

describe('the logo', () => {
  const bytes = readFileSync(LOGO_PATH);

  test('is small enough for Vite to inline, so the single-file demo build stays self-contained', () => {
    expect(bytes.length).toBeLessThan(ASSET_INLINE_LIMIT);
  });

  test('is a PNG, which is what main.tsx declares the favicon to be', () => {
    // The data URI's own media type and the `<link type>` must agree, or the
    // icon claims to be something it is not.
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});

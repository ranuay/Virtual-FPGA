// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import logoPng from '../../Images/acsl_logo.png';

/**
 * The ACSL Virtual FPGA Lab's mark: the laboratory's own emblem, taken from
 * `fpga.acsl.my.id` (its `favicon-32x32.png`, resampled to 64 px and kept under
 * Vite's 4 KB asset-inline limit) so the app carries the logo the course
 * already uses rather than an invented one.
 *
 * The size is deliberate, not cosmetic. Vite inlines an imported asset only
 * while it is under `build.assetsInlineLimit` (4 KB by default); past that it
 * emits `dist/assets/acsl_logo-<hash>.png` and the import becomes a URL.
 * `tools/bundle.mjs` (`npm run demo`) asserts the built page references no
 * external asset paths at all, so a larger copy would break the single-file
 * build. One data URI, computed once here, is reused for the header mark
 * (`Header.tsx`), the About dialog and the favicon (`main.tsx`).
 */
export const LOGO_DATA_URI = logoPng;

/**
 * The header's rendering of the mark. The emblem is a raster, so this is the
 * same image rather than retraced path data: tracing it would be a second,
 * slightly different copy of the laboratory's logo to keep in step by hand.
 */
export function HeaderLogo() {
  return <img className="wb-header__logo" src={LOGO_DATA_URI} alt="" aria-hidden="true" />;
}

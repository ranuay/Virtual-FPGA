// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import type { ReactNode } from 'react';
import { HeaderLogo } from './logo';
import { GearIcon } from './icons';
import { APP_NAME, APP_TAGLINE } from './project';
import './Header.css';

export interface HeaderProps {
  /** Opens the Settings dialog. */
  onSettings?: () => void;
  /** Opens the Help dialog. */
  onHelp?: () => void;
  /** Shown left of the chrome actions, with a divider: the save/share split button. */
  gitHubActions?: ReactNode;
  /** Shown between Help and About: the update bell (UpdateBell), when there is something to tell. */
  notifications?: ReactNode;
}

/**
 * The workbench's top bar — the product name and tagline, reading as the
 * same one line the window title bar carries, and the chrome actions
 * (Settings, Help), each of which opens a dialog owned by `<Workbench>`.
 * GitHub sign-in and the About box are reached elsewhere (the Projects
 * overlay and `ABOUT_EVENT`); the top bar keeps only what a lab session needs.
 */
export function Header({ onSettings, onHelp, gitHubActions, notifications }: HeaderProps) {
  return (
    <header className="wb-header">
      <div className="wb-header__brand">
        <HeaderLogo />
        <span className="wb-header__title">{APP_NAME}</span>
        <span className="wb-header__tagline">&mdash; {APP_TAGLINE}</span>
      </div>
      <div className="wb-header__actions">
        {gitHubActions}
        {gitHubActions && <span className="wb-header__divider" aria-hidden="true" />}
        <button type="button" className="wb-header__action" onClick={onSettings}>
          <span className="wb-icon wb-icon--gear" aria-hidden="true">
            <GearIcon />
          </span>
          Settings
        </button>
        <button type="button" className="wb-header__action" onClick={onHelp}>
          <span className="wb-icon wb-icon--help" aria-hidden="true">
            ?
          </span>
          Help
        </button>
        {notifications}
      </div>
    </header>
  );
}

export default Header;

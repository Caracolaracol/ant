# Changelog

All notable changes to Ant are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

To publish a new version: bump the version in `package.json`, `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml`, add its section here and push the `vX.Y.Z` tag. The
`.github/workflows/release.yml` workflow builds for macOS, Windows and Linux and publishes the
release with that section as its notes, so this file is always written in English.

## [Unreleased]

## [0.2.0] - 2026-11-20

### Changed

- Ant is now in English by default: menus, sidebar, dialogs and Settings. Spanish can be chosen
  in Settings → General → Language.

### Added

- **Compile and Export** (File → Compile and Export…, Cmd+Shift+E): joins the notes of a folder
  as the chapters of a book and exports it to **Word** or **PDF**, with no external programs.
  Choose which notes go in and in what order, the title, the author and the style: **standard
  manuscript** (Times 12, double spacing, "Surname / Title / page" header, title page with word
  count) or **book** (A5, justified, page number in the footer). Each chapter's title comes from
  the note's first `#` heading or from the file name; `***` marks a scene break; anything between
  `%% … %%` is left out; and the typography of the whole text can be fixed on export. Ant
  remembers the options for each folder.
- Settings split into areas: **General** (language and working folder), **Editor**, **Diary**
  and **Appearance** (Cmd+,).
- Writer mode (Settings → Editor, on by default): typography as you type (curly quotes “ ” or
  « » depending on the language, `--` → em dash `—`, `...` → `…`, `<<` `>>` → `« »`, `->` `<-` →
  `→ ←`; Backspace right after undoes the change, and nothing changes inside code), a serif book
  font in a narrower column, and spell checking. Each part can be turned off separately.
- The sidebar can be made wider or narrower by dragging its right edge (the pointer changes to
  ↔); the width is remembered, and double-clicking the edge restores the default.
- Diary mode (Settings → Diary): shows a calendar at the top of the sidebar. Clicking a day opens
  its note, `Daily/YYYY-MM-DD.md` inside the working folder; if the note or the `Daily` folder
  don't exist, they are created; if there is already a `Daily` folder (even spelled `daily`), that
  one is used. Days with a note show a dot. In this mode the `Daily` folder is hidden from the
  tree: daily notes are reached from the calendar, and the open ones are listed below it.
- Colors (Settings → Appearance): ready-made themes (Dark, Ant, Night, Paper and Sepia) and each
  color separately. Changes show instantly in every window.

## [0.1.0] - 2026-11-18

First public release.

### Added

- Markdown editor built on CodeMirror 6: text is saved exactly as written, as `.md` files on
  disk, with no database or accounts.
- Highlighting for Markdown and code blocks.
- Find and replace (Cmd+F), undo and redo with per-note history.
- Sidebar (`Cmd+\`) with:
  - "Pinned": notes and folders pinned to the top with a right-click;
  - "Open": notes outside the folder or not yet saved;
  - the working folder's tree, with collapsible folders;
  - the active note's headings, to jump between sections.
- Several notes open at once; switch between them with Cmd+Shift+] and Cmd+Shift+[.
- Status bar with words, lines and characters.
- Settings window (Cmd+,) to choose the working folder.
- Atomic saving: the note is written to a temporary file and then renamed, so it is never left
  half-saved.
- Custom menu in Spanish. Cmd+W doesn't close the main window, so an unsaved note isn't lost.
- Selecting by dragging to the edge scrolls the text on every screen frame, faster and without
  jumps (a CodeMirror patch in `patches/`).
- Icon: a yellow ant face (`#e5ea15`) on a dark background (`#1d1d20`).
- Downloads for macOS (universal: Apple Silicon and Intel), Windows and Linux.
- Website and documentation in English and Spanish: https://caracolaracol.github.io/ant/
- MIT license.

[Unreleased]: https://github.com/Caracolaracol/ant/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Caracolaracol/ant/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Caracolaracol/ant/releases/tag/v0.1.0

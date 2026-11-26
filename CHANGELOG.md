# Changelog

All notable changes to Ant are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

To publish a new version: bump the version in `package.json`, `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml`, add its section here and push the `vX.Y.Z` tag. The
`.github/workflows/release.yml` workflow builds for macOS, Windows and Linux and publishes the
release with that section as its notes, so this file is always written in English.

## [Unreleased]

### Added

- **Images in notes**: drag images onto a note or paste them (a screenshot, a copied image), and
  they show up right below their line. Images from outside the anthill are copied to an `Images`
  folder next to the note; one that is already in the anthill is linked where it is. The note
  keeps a plain Markdown link (`![](Images/photo.png)`). Obsidian-style `![[photo.png]]` embeds
  show too. Dropping a note file on the window opens it.
- **Shortcuts in Settings**: a new Shortcuts area lists every action with its shortcut. Click one
  and press the new keys to change it; Ant warns when the keys are already taken by another action,
  the editor or the system, and each change can go back to the default. The editor's fixed
  shortcuts are listed too.

### Changed

- **Editor settings per chamber**: each chamber has its own editor settings (Settings → Editor).
  Three quick presets (**Writer**, **Programmer**, **Simple**) check a set of options at once, and
  every option can then be changed on its own, so a chamber can be a writer's and a programmer's
  at the same time. New code options: type ``` and Enter and the code block closes itself,
  brackets close themselves, the matching bracket is highlighted, and code blocks stand out.
- **Markdown view** (part of the Writer preset, each piece with its own checkbox): text looks the
  way it ends up, without its marks. Headings without `#`; bold, italic and strikethrough without
  `**`, `*` or `~~`; inline code without backticks; links showing only their text; quotes with a
  line; bullets in lists; checkboxes in tasks that you click to check; `---` as a line; and images.
  On the line where the cursor is, the marks show again so you can edit them. Bold text is also a
  bit brighter, so it stands out in the book font.
- **No empty note out of nowhere**: Ant opens the last note you had open. If there is none (or you
  close the last one), the editor shows an invitation to start a new note, with a button that
  creates it at the root of the open chamber.

## [0.3.0] - 2026-11-21

### Added

- **Welcome**: the first time you open Ant, a short tour in the style of the website, chamber by
  chamber along a tunnel, that ends by choosing your anthill and digging your first chamber. It
  can be seen again from Ant → Welcome to Ant….
- **Anthill and chambers**: all your notes live in one anthill, a folder on your computer (a new
  one, or one you already have, like an Obsidian vault). Inside it, each chamber is a folder for
  one context: your personal notes, everything about one novel, your work and its projects. The
  sidebar shows one chamber at a time, with its own pins and its own Daily folder. Switch chambers
  from the chamber name at the top of the sidebar (or in Settings → General, where you can also
  change the anthill), and dig a new one from that list, File → New Chamber… or
  Cmd+Shift+N. Loose notes at the root of the anthill are the **Entrance**, a
  chamber that only shows up while there are loose notes. If you already had a working folder, it
  becomes your anthill and Ant asks you to pick or dig its first chamber.
- **Encrypted chambers**: a chamber can be encrypted with a password (Settings → General →
  Chambers → Encrypt…), for example to keep passwords. Every note and image in it is stored
  encrypted on disk with the standard age format, so whoever uses your computer or gets into the
  cloud where you sync it can't read them. Ant asks for the password to open it and locks it again
  when you close Ant, switch chambers or choose Lock now. Before encrypting, Ant warns clearly:
  if you forget the password, everything in that chamber is lost. Encryption can be removed later
  with the password. Note and folder names stay visible on disk.
- **The `.ant` folder**: pins, their icons and the Compile and Export options now live inside the
  anthill, in a hidden `.ant/` folder (like `.obsidian/` in a vault) with one file per chamber and
  paths relative to it. They travel with your notes when you move, sync or back up the anthill.
  What you had pinned before moves there by itself the first time you open each chamber.
- **Right-click menu**: Ant's own menu in the sidebar, with icons, keyboard navigation and the
  options that make sense where you click. On a note or folder: new note, new folder (next to it
  or inside), pin, and show in its folder; on the empty space, create in the chamber. Empty
  folders now show in the tree so you can fill them.
- **New note** (Cmd+N or right-click → New note…): asks for a name and creates the note right
  away next to the note you are reading (or in the chamber), so it is saved automatically from
  the first word. It never overwrites a note with the same name.
- **Pinned icons**: pins are now a grid of icons, like pinned tabs in Zen or Arc, with the name
  in a tooltip when you hover. Each one starts with the icon of its kind (folder, note or
  chapter); right-click → Change icon… to pick another from about a hundred (Lucide icons). A
  pinned folder unfolds below the grid.
- Chapters can be pinned too: right-click a heading under the open note → Pin to top. Clicking
  the pin opens the note at that heading.

### Changed

- **Ant theme by default**: the yellow-on-dark theme of the app icon is now the default one.

- **Automatic saving**: notes are saved a moment after you stop typing, and also when you open
  another note, leave the window or quit Ant. Only a new note that was never saved still needs
  Cmd+S the first time.
- One note at a time: opening a note replaces the one that was open (it is saved first), instead
  of leaving every note you opened highlighted in the sidebar. Coming back to a note keeps its
  cursor position and its undo history.
- Typing stays fast in very long notes (a whole novel in one note): the word count and the
  headings in the sidebar update a moment after you pause, instead of on every key. Large
  chambers are read in the background, so the window never freezes while Ant reads them.
- If a note changes outside Ant (in another app, or through a sync service), Ant shows the new
  text when you come back to the window. If it also has changes in Ant, Ant never overwrites the
  file: it warns in the status bar, and Cmd+S keeps your version.
- Settings are saved safely (written to a temporary file first), and if the settings file is ever
  damaged, Ant keeps a copy of it (`ajustes-ilegibles.json`) instead of losing your anthill and the rest of your settings.
- The sidebar has no separator lines: sections are separated by space only.
- Settings open inside the main window instead of a separate window. Escape, Cmd+W or a click
  outside closes them.
- The blank note Ant opens with no longer shows up in the sidebar as "Untitled" under "Open"; it
  appears there only once you start writing in it.

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

[Unreleased]: https://github.com/Caracolaracol/ant/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Caracolaracol/ant/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Caracolaracol/ant/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Caracolaracol/ant/releases/tag/v0.1.0

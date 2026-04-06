# GB Mod Manager

GB Mod Manager is a desktop mod manager for popular gacha games that pulls mods directly from GameBanana, lets you browse and search them in a clean UI, and installs them into the correct game-specific folders in one click.

The app is built with Electron, React, and TypeScript, and is focused on making shader/texture modding less painful for games that don’t have a native mod loader.

> Currently supports: Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves, and Arknights: Endfield.

---

## Features

- **GameBanana integration**
  - Browse popular mods per game.
  - Search by name and filter results.
  - View mod metadata, author, download counts, likes, and last update date.
  - Open the original GameBanana page in your browser.

- **One‑click install**
  - Downloads the selected mod’s latest file.
  - Uses a central cache directory under `%APPDATA%\GB Mod Manager\mods`.
  - Extracts the mod into the configured per‑game `Mods` folder.
  - Cleans up temporary ZIPs and extract folders after install.

- **Installed mod library**
  - Shows all mods installed via the manager.
  - Detects mods already present in per‑game folders.
  - Tracks basic info: game, name, install path, timestamps, GameBanana IDs.
  - Supports uninstalling mods (removes the folder and the library entry).

- **Per‑game configuration**
  - Configure a Mod install folder for each supported game.
  - Configure the game’s executable directory for ReShade operations.
  - Open configured folders directly from the UI.

- **ReShade helper**
  - Run the bundled ReShade installer (with or without addon).
  - Check ReShade install status per game.
  - Manage ReShade presets: list, create, import, delete, set active.
  - Quickly open the presets directory in your file explorer.

- **Safe defaults**
  - Optional hiding of NSFW / mature mods.
  - No symlinks required for new installs (mods are extracted directly into the game’s Mods directory).
  - Defensive error handling for failed downloads, broken paths, or partially installed mods.

---

## Architecture

### High‑level overview

- **Electron main process**
  - Creates the main `BrowserWindow` and loads the React UI.
  - Owns all filesystem and network operations.
  - Exposes a typed IPC API to the renderer for mod management, game paths, ReShade, and GameBanana requests.
  - Uses Electron’s `net` module to call GameBanana APIs.

- **Preload script**
  - Bridges main and renderer with a safe, narrowed API.
  - Attaches a `modApi` object (and related APIs) to `window` for the React app.
  - Handles progress events for installs (download progress) and forwards them to the UI.

- **Renderer (React)**
  - Built with React + TypeScript, styled with Tailwind (or your utility classes).
  - Renders:
    - Browse page (GameBanana search & install).
    - Installed mods library.
    - Game and ReShade settings.
  - Uses hooks to call the preload API (`window.modApi.*`) and manage UI state.

---

## Installation (Development)

### Prerequisites

- Node.js (LTS recommended)
- pnpm / npm / yarn
- Git

### Clone and install

```bash
git clone https://github.com/<your-name>/gamebanana-mod-manager.git
cd gamebanana-mod-manager
pnpm install           # or npm install / yarn
```

### Run in development

```bash
pnpm dev               # or the script you’ve defined to start React + Electron
```

This typically starts the React dev server and launches Electron with hot reload.

### Build for production

```bash
pnpm build             # builds the renderer bundle
pnpm dist              # or whatever script runs electron-builder / forge
```

Check the `package.json` scripts in the repo for the exact commands.

---

## Configuration

### Mods directory

By default, GB Mod Manager uses:

```text
%APPDATA%\GB Mod Manager\mods
```

as its cache directory for downloaded ZIPs and temporary extraction.

You don’t need to configure this manually. The app will create the directory on first run if it doesn’t exist.

### Per‑game mod paths

Each supported game needs a **Mod install folder** set before you can install mods from GameBanana.

1. Open the **Settings** or **Game Paths** section in the app.
2. For each game (Genshin, HSR, ZZZ, etc.), pick the folder where that launcher expects mods.
3. The manager will:
   - Download ZIPs to the global `%APPDATA%\GB Mod Manager\mods` cache.
   - Extract into a temp folder there.
   - Copy the extracted mod into the per‑game mod path.

If the folder doesn’t exist yet, GB Mod Manager will create it when you install the first mod.

### Game executable paths (ReShade)

ReShade features need the directory that contains the game executable (`.exe`):

1. In settings, set the **Game exe directory** for each game you want ReShade support on.
2. The app uses this path to:
   - Run the ReShade installer.
   - Check whether ReShade is installed.
   - Find and manage ReShade preset files.

---

## Mod installation pipeline

1. User selects a mod in the **Browse** view and clicks **Install**.
2. Renderer calls the main process via IPC: `mod:install`.
3. Main process:
   - Resolves `modsRoot` (`%APPDATA%\GB Mod Manager\mods`).
   - Resolves the per‑game `gamePath` from the store.
   - Calls `installMod` in `downloader.ts` with:
     - GameBanana download URL.
     - Mod ID, file name, and display name.
     - `modsRoot` and `gamePath`.
4. `installMod`:
   - Downloads the ZIP into `modsRoot`.
   - Extracts into `modsRoot/tmp_<id>_<timestamp>`.
   - Copies the extracted folder into `<gamePath>/<sanitized-mod-name>_<id>`.
   - Deletes the temp extract folder and the ZIP.
5. Main process stores an `InstalledMod` entry:
   - `id`, `name`, `gameId`, `gameName`
   - `fileId`, `fileName`, `downloadUrl`
   - `installPath`
   - `installedTimestamp`
   - `enabled` flag
6. Renderer updates UI to show the mod as installed.

---

## Uninstall pipeline

1. User clicks **Uninstall** in the installed mods library.
2. Renderer calls `mod:uninstall` with the mod ID.
3. Main process:
   - Looks up the mod entry in the store.
   - Attempts to delete the `installPath` directory (recursive, forced).
   - Removes the entry from the store even if the directory was already gone.
4. Renderer refreshes the installed list; the mod disappears.

---

## GameBanana API usage

The main process uses GameBanana’s public API endpoints to:

- Search for mods by game and query.
- Fetch mod details and the list of available files.
- Check for updates to installed mods by comparing timestamps and file IDs.

All GameBanana requests are proxied through the main process; the renderer never hits the API directly.

---

## ReShade integration

For games where you enable ReShade in the manager:

- **Install ReShade / Addon**
  - Launches the bundled ReShade installer with or without the addon.
  - Uses the configured game exe directory as the target.
  - After running, checks whether ReShade is installed.

- **Preset management**
  - Lists available presets in the game’s ReShade directory.
  - Imports `.ini` preset files.
  - Creates new presets.
  - Deletes presets.
  - Switches the active preset.

---

## Development notes

- **TypeScript everywhere** — main, preload, and renderer are all typed for safer refactors.
- **IPC contracts** — keep all IPC channels and payload shapes documented and centralized (e.g., in a shared types file) so the preload and renderer stay in sync.
- **No direct `fs` in the renderer** — all filesystem and network access is mediated through the main process and preload bridge.
- **Error handling**
  - The main process catches per‑mod errors when checking updates.
  - Uninstall always cleans up the store entry, even if the folder is missing.
  - Install cleans up ZIPs and temporary extraction folders in `finally` blocks.

---

## Roadmap / Ideas

- More robust update flow (in‑place update with backup/rollback).
- Custom tags / notes for installed mods.
- Export/import of your mod library configuration.

---

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial-NoDerivs 4.0 Unported License](https://gamebanana.com/linkfilter?url=http%3A%2F%2Fcreativecommons.org%2Flicenses%2Fby-nc-nd%2F4.0%2F&follow=undefined).

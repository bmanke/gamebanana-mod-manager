import { app, shell, BrowserWindow, ipcMain, net, dialog } from 'electron'
import { join, basename, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { installMod, uninstallMod, getModsDir } from './downloader'
import { store, InstalledMod } from './store'
import {
  getBundledRelease,
  launchInstaller,
  checkInstalled,
  uninstallReShade,
  listPresets,
  setActivePreset,
  importPreset,
  createPreset,
  deletePreset,
  openPresetsDir
} from './reshade'
import fs from 'fs'
import path from 'path'

// ─── Types for scanning existing mods ─────────────────────────────────────────

export interface DetectedMod {
  id: number | null
  name: string
  gameId: number
  gameName: string
  path: string
  profileUrl?: string | null
}

function resolveGameName(gameId: number): string {
  switch (gameId) {
    case 8552: return 'Genshin Impact'
    case 18366: return 'Honkai: Star Rail'
    case 19567: return 'Zenless Zone Zero'
    case 20357: return 'Wuthering Waves'
    case 21842: return 'Arknights: Endfield'
    default: return 'Unknown Game'
  }
}

// extract numeric id from folder name like "660106 - Cool Mod"
function tryParseIdFromName(name: string): number | null {
  const match = name.match(/\b(\d{4,})\b/)
  return match ? Number(match[1]) : null
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Mod Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle(
  'mod:install',
  async (
    event,
    modId: number,
    fileId: number,
    fileName: string,
    downloadUrl: string,
    name: string,
    gameName: string,
    gameId: number
  ) => {
    const customPath = store.getGamePath(gameId)
    const baseDir = customPath ?? getModsDir()

    const installPath = await installMod(
      modId,
      fileName,
      downloadUrl,
      name,
      baseDir,
      (pct) => event.sender.send('mod:progress', pct)
    )

    const mod: InstalledMod = {
      id: modId,
      name,
      gameName,
      gameId,
      fileId,
      fileName,
      downloadUrl,
      installPath,
      installedTimestamp: Date.now()
    }
    store.set(modId, mod)
    return installPath
  }
)

ipcMain.handle('mod:uninstall', async (_, modId: number) => {
  const mod = store.get(modId)
  if (mod?.installPath) {
    await uninstallMod(mod.installPath)
  }
  store.remove(modId)
})

ipcMain.handle('mod:getAll', () => store.getAll())

ipcMain.handle('mod:setProfileUrl', (_, modId: number, url: string | null) => {
  store.setProfileUrl(modId, url)
})

ipcMain.handle('mod:setGbId', (_, modId: number, gbId: number | null) => {
  store.setGbId(modId, gbId)
})

// rename by mod id (for manager-installed mods)
ipcMain.handle('mod:renameWithGbId', async (_event, modId: number, gbId: number) => {
  const mod = store.get(modId)
  if (!mod) throw new Error(`Mod ${modId} not found`)

  const oldPath = mod.installPath
  if (!oldPath || !fs.existsSync(oldPath)) return null

  const parentDir = dirname(oldPath)
  const newName = `${mod.name}_${gbId}`
  const newPath = path.join(parentDir, newName)

  if (oldPath === newPath) return oldPath

  fs.renameSync(oldPath, newPath)

  mod.installPath = newPath
  mod.gbId = gbId
  store.set(modId, mod)

  return newPath
})

// rename by path (works for scanned-only mods too)
ipcMain.handle(
  'mod:renamePathWithGbId',
  async (_event, folderPath: string, displayName: string, gbId: number) => {
    if (!folderPath || !fs.existsSync(folderPath)) return null

    const parentDir = path.dirname(folderPath)
    const newName = `${displayName}_${gbId}`
    const newPath = path.join(parentDir, newName)

    if (folderPath === newPath) return folderPath

    fs.renameSync(folderPath, newPath)

    // If this folder belongs to a stored mod, update it.
    const all = store.getAll()
    for (const mod of Object.values(all)) {
      if (mod.installPath === folderPath) {
        mod.installPath = newPath
        mod.gbId = gbId
        store.set(mod.id, mod)
        break
      }
    }

    return newPath
  }
)

ipcMain.handle('mod:checkUpdates', async () => {
  const installed = Object.values(store.getAll())
  const updates: Array<{
    modId: number
    newFileId: number
    downloadUrl: string
    fileName: string
  }> = []

  for (const mod of installed) {
    const idToCheck = mod.gbId ?? mod.id
    try {
      const res = await net.fetch(
        `https://gamebanana.com/apiv10/Mod/${idToCheck}?_csvProperties=_aFiles`
      )
      const data = await res.json()
      const latest = data._aFiles?.at(-1)
      if (latest && latest._tsDateAdded * 1000 > mod.installedTimestamp) {
        updates.push({
          modId: mod.id,
          newFileId: latest._idRow,
          downloadUrl: latest._sDownloadUrl,
          fileName: latest._sFile
        })
      }
    } catch {
      // ignore errors for individual mods
    }
  }
  return updates
})

ipcMain.handle('mod:openDir', () => shell.openPath(getModsDir()))

// open arbitrary folder path (for scanned mods)
ipcMain.handle('open-folder', (_, folderPath: string) => {
  return shell.openPath(folderPath)
})

// scan for mods in the per‑game paths (Settings) or global mods dir
ipcMain.handle('mods:scanInstalled', async () => {
  const results: DetectedMod[] = []

  const GAME_IDS = [8552, 18366, 19567, 20357, 21842]

  for (const gameId of GAME_IDS) {
    const customDir = store.getGamePath(gameId)
    const baseDir = customDir ?? getModsDir()

    if (!baseDir) continue
    if (!fs.existsSync(baseDir)) continue

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(baseDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const fullPath = path.join(baseDir, entry.name)
      const maybeId = tryParseIdFromName(entry.name)

      results.push({
        id: maybeId,
        name: entry.name,
        gameId,
        gameName: resolveGameName(gameId),
        path: fullPath,
        profileUrl: maybeId
          ? `https://gamebanana.com/mods/${maybeId}`
          : null
      })
    }
  }

  return results
})

// ─── Mod Install Path Handlers ────────────────────────────────────────────────

ipcMain.handle('gamePath:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Mod Install Folder'
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('gamePath:getAll', () => store.getAllGamePaths())

ipcMain.handle('gamePath:set', (_, gameId: number, folderPath: string) => {
  store.setGamePath(gameId, folderPath)
})

ipcMain.handle('gamePath:remove', (_, gameId: number) => {
  store.removeGamePath(gameId)
})

ipcMain.handle('gamePath:open', (_, gameId: number) => {
  const p = store.getGamePath(gameId)
  if (p) shell.openPath(p)
})

// ─── Game Exe Path Handlers (for ReShade) ─────────────────────────────────────

ipcMain.handle('gameExePath:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Game Directory (where the game .exe lives)'
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('gameExePath:getAll', () => store.getAllGameExePaths())

ipcMain.handle('gameExePath:set', (_, gameId: number, dirPath: string) => {
  store.setGameExePath(gameId, dirPath)
})

ipcMain.handle('gameExePath:remove', (_, gameId: number) => {
  store.removeGameExePath(gameId)
})

ipcMain.handle('gameExePath:open', (_, gameId: number) => {
  const p = store.getGameExePath(gameId)
  if (p) shell.openPath(p)
})

// ─── ReShade Handlers ─────────────────────────────────────────────────────────

ipcMain.handle('reshade:getLatest', () => {
  return getBundledRelease()
})

ipcMain.handle('reshade:install', (_, gameId: number) => {
  launchInstaller(false)
  const gameDir = store.getGameExePath(gameId)
  return gameDir ? checkInstalled(gameDir) : { installed: false }
})

ipcMain.handle('reshade:installAddon', (_, gameId: number) => {
  launchInstaller(true)
  const gameDir = store.getGameExePath(gameId)
  return gameDir ? checkInstalled(gameDir) : { installed: false }
})

ipcMain.handle('reshade:checkStatus', (_, gameId: number) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) return { installed: false }
  return checkInstalled(gameDir)
})

ipcMain.handle('reshade:uninstall', (_, gameId: number) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) throw new Error('No game directory set for this game')
  uninstallReShade(gameDir)
  return { installed: false }
})

// ─── ReShade Preset Handlers ──────────────────────────────────────────────────

ipcMain.handle('reshade:listPresets', (_, gameId: number) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) return []
  return listPresets(gameDir)
})

ipcMain.handle('reshade:setActivePreset', (_, gameId: number, presetFileName: string) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) throw new Error('No game directory set')
  setActivePreset(gameDir, presetFileName)
  return listPresets(gameDir)
})

ipcMain.handle('reshade:importPreset', async (_, gameId: number) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) throw new Error('No game directory set')

  const result = await dialog.showOpenDialog({
    title: 'Import ReShade Preset',
    filters: [{ name: 'ReShade Preset', extensions: ['ini'] }],
    properties: ['openFile', 'multiSelections']
  })
  if (result.canceled) return listPresets(gameDir)

  for (const filePath of result.filePaths) {
    importPreset(gameDir, filePath)
  }
  return listPresets(gameDir)
})

ipcMain.handle('reshade:createPreset', (_, gameId: number, name: string) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) throw new Error('No game directory set')
  const fileName = createPreset(gameDir, name)
  return { fileName, presets: listPresets(gameDir) }
})

ipcMain.handle('reshade:deletePreset', (_, gameId: number, presetFileName: string) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) throw new Error('No game directory set')
  deletePreset(gameDir, presetFileName)
  return listPresets(gameDir)
})

ipcMain.handle('reshade:openPresetsDir', (_, gameId: number) => {
  const gameDir = store.getGameExePath(gameId)
  if (!gameDir) throw new Error('No game directory set')
  const dir = openPresetsDir(gameDir)
  shell.openPath(dir)
})

// ─── GameBanana Categories & Mods ─────────────────────────────────────────────

ipcMain.handle('gb:getGameCategories', async (_, gameId: number) => {
  const url =
    `https://gamebanana.com/apiv11/ModCategory?` +
    `_csvGameRow=${gameId}` +
    `&_csvProperties=_idRow,_sName,_sProfileUrl,_idParentCategoryRow`
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`GB categories error ${res.status}`)
  const data = await res.json() as Array<any>
  return data.map((cat) => ({
    id: cat._idRow as number,
    name: cat._sName as string,
    url: cat._sProfileUrl as string,
    parentId: (cat._idParentCategoryRow ?? null) as number | null
  }))
})

ipcMain.handle('gb:getGameMods', async (_ , gameId: number, categoryId?: number) => {
  const base = 'https://gamebanana.com/apiv11/Mod'
  const params = new URLSearchParams({
    _nPerpage: '50',
    _csvGameRow: String(gameId),
    _csvProperties: '_idRow,_sName,_sProfileUrl,_aCategory'
  })
  if (categoryId) {
    params.set('_csvCategoryRow', String(categoryId))
  }
  const res = await net.fetch(`${base}?${params.toString()}`)
  if (!res.ok) throw new Error(`GB mods error ${res.status}`)
  return res.json()
})

// ─── GB API Proxy ─────────────────────────────────────────────────────────────

ipcMain.handle('gb:fetch', async (_, url: string) => {
  const res = await net.fetch(url)
  if (!res.ok) {
    throw new Error(`GB API error ${res.status}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const text = buf.toString('utf-8')

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
})

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.modmanager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

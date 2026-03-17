import { app, shell, BrowserWindow, ipcMain, net, dialog } from 'electron'
import { join } from 'path'
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
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
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

ipcMain.handle('mod:checkUpdates', async () => {
  const installed = Object.values(store.getAll())
  const updates: Array<{
    modId: number
    newFileId: number
    downloadUrl: string
    fileName: string
  }> = []

  for (const mod of installed) {
    try {
      const res = await net.fetch(
        `https://gamebanana.com/apiv10/Mod/${mod.id}?_csvProperties=_aFiles`
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
    } catch { /* skip */ }
  }
  return updates
})

ipcMain.handle('mod:openDir', () => shell.openPath(getModsDir()))


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


// ─── GB API Proxy ─────────────────────────────────────────────────────────────


ipcMain.handle('gb:fetch', async (_, url: string) => {
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`GB API error ${res.status}`)
  return res.json()
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

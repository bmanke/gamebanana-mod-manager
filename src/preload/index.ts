import { contextBridge, ipcRenderer } from 'electron'

export type ProgressCallback = (pct: number) => void

contextBridge.exposeInMainWorld('modApi', {
  // ─── Mod Installation ────────────────────────────────────────────────────────
  installMod: (
    modId: number,
    fileId: number,
    fileName: string,
    downloadUrl: string,
    name: string,
    gameName: string,
    gameId: number
  ): Promise<string> =>
    ipcRenderer.invoke('mod:install', modId, fileId, fileName, downloadUrl, name, gameName, gameId),

  uninstallMod: (modId: number): Promise<void> =>
    ipcRenderer.invoke('mod:uninstall', modId),

  // ─── Library ────────────────────────────────────────────────────────────────
  getInstalledMods: (): Promise<Record<number, unknown>> =>
    ipcRenderer.invoke('mod:getAll'),

  // ─── Update Checking ─────────────────────────────────────────────────────────
  checkUpdates: (): Promise<
    Array<{ modId: number; newFileId: number; downloadUrl: string; fileName: string }>
  > => ipcRenderer.invoke('mod:checkUpdates'),

  // ─── Progress ────────────────────────────────────────────────────────────────
  onProgress: (callback: ProgressCallback): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, pct: number): void => callback(pct)
    ipcRenderer.on('mod:progress', handler)
    return () => ipcRenderer.removeListener('mod:progress', handler)
  },

  // ─── Utilities ───────────────────────────────────────────────────────────────
  openModsDir: (): Promise<void> =>
    ipcRenderer.invoke('mod:openDir'),

  // ─── Mod Install Paths ───────────────────────────────────────────────────────
  pickFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('gamePath:pick'),

  getAllGamePaths: (): Promise<Record<number, string>> =>
    ipcRenderer.invoke('gamePath:getAll'),

  setGamePath: (gameId: number, folderPath: string): Promise<void> =>
    ipcRenderer.invoke('gamePath:set', gameId, folderPath),

  removeGamePath: (gameId: number): Promise<void> =>
    ipcRenderer.invoke('gamePath:remove', gameId),

  openGamePath: (gameId: number): Promise<void> =>
    ipcRenderer.invoke('gamePath:open', gameId),

  // ─── Game Exe Paths (for ReShade) ────────────────────────────────────────────
  pickGameExeFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('gameExePath:pick'),

  getAllGameExePaths: (): Promise<Record<number, string>> =>
    ipcRenderer.invoke('gameExePath:getAll'),

  setGameExePath: (gameId: number, dirPath: string): Promise<void> =>
    ipcRenderer.invoke('gameExePath:set', gameId, dirPath),

  removeGameExePath: (gameId: number): Promise<void> =>
    ipcRenderer.invoke('gameExePath:remove', gameId),

  openGameExePath: (gameId: number): Promise<void> =>
    ipcRenderer.invoke('gameExePath:open', gameId),

  // ─── ReShade ─────────────────────────────────────────────────────────────────
  reshadeGetLatest: (): Promise<{ version: string; hasAddon: boolean }> =>
    ipcRenderer.invoke('reshade:getLatest'),

  reshadeInstall: (gameId: number): Promise<{ installed: boolean; dllName?: string }> =>
    ipcRenderer.invoke('reshade:install', gameId),

  reshadeInstallAddon: (gameId: number): Promise<{ installed: boolean; dllName?: string }> =>
    ipcRenderer.invoke('reshade:installAddon', gameId),

  reshadeCheckStatus: (gameId: number): Promise<{ installed: boolean; dllName?: string }> =>
    ipcRenderer.invoke('reshade:checkStatus', gameId),

  reshadeUninstall: (gameId: number): Promise<{ installed: false }> =>
    ipcRenderer.invoke('reshade:uninstall', gameId),

  // ─── ReShade Presets ─────────────────────────────────────────────────────────
  reshadeListPresets: (gameId: number): Promise<Array<{
    name: string; fileName: string; fullPath: string; isActive: boolean
  }>> =>
    ipcRenderer.invoke('reshade:listPresets', gameId),

  reshadeSetActivePreset: (gameId: number, presetFileName: string): Promise<Array<{
    name: string; fileName: string; fullPath: string; isActive: boolean
  }>> =>
    ipcRenderer.invoke('reshade:setActivePreset', gameId, presetFileName),

  reshadeImportPreset: (gameId: number): Promise<Array<{
    name: string; fileName: string; fullPath: string; isActive: boolean
  }>> =>
    ipcRenderer.invoke('reshade:importPreset', gameId),

  reshadeCreatePreset: (gameId: number, name: string): Promise<{
    fileName: string
    presets: Array<{ name: string; fileName: string; fullPath: string; isActive: boolean }>
  }> =>
    ipcRenderer.invoke('reshade:createPreset', gameId, name),

  reshadeDeletePreset: (gameId: number, presetFileName: string): Promise<Array<{
    name: string; fileName: string; fullPath: string; isActive: boolean
  }>> =>
    ipcRenderer.invoke('reshade:deletePreset', gameId, presetFileName),

  reshadeOpenPresetsDir: (gameId: number): Promise<void> =>
    ipcRenderer.invoke('reshade:openPresetsDir', gameId),

  // ─── GameBanana categories & mods ────────────────────────────────────────────
  gbGetGameCategories: (gameId: number): Promise<Array<{
    id: number
    name: string
    url: string
    parentId: number | null
  }>> =>
    ipcRenderer.invoke('gb:getGameCategories', gameId),

  gbGetGameMods: (gameId: number, categoryId?: number): Promise<unknown> =>
    ipcRenderer.invoke('gb:getGameMods', gameId, categoryId),

  // ─── GB API Proxy ────────────────────────────────────────────────────────────
  gbFetch: (url: string): Promise<unknown> =>
    ipcRenderer.invoke('gb:fetch', url)
})

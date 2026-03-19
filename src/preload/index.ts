import { contextBridge, ipcRenderer } from 'electron'

export type ProgressCallback = (pct: number) => void

export interface DetectedMod {
  id: number | null
  name: string
  gameId: number
  gameName: string
  path: string
  profileUrl?: string | null
}

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

  scanInstalledMods: (): Promise<DetectedMod[]> =>
    ipcRenderer.invoke('mods:scanInstalled'),

  setModProfileUrl: (modId: number, url: string | null): Promise<void> =>
    ipcRenderer.invoke('mod:setProfileUrl', modId, url),

  setModGbId: (modId: number, gbId: number | null): Promise<void> =>
    ipcRenderer.invoke('mod:setGbId', modId, gbId),

  renameModWithGbId: (modId: number, gbId: number): Promise<string | null> =>
    ipcRenderer.invoke('mod:renameWithGbId', modId, gbId),

  renameModPathWithGbId: (
    folderPath: string,
    displayName: string,
    gbId: number
  ): Promise<string | null> =>
    ipcRenderer.invoke('mod:renamePathWithGbId', folderPath, displayName, gbId),

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

  openFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('open-folder', folderPath),

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

declare global {
  interface Window {
    modApi: {
      installMod: (
        modId: number,
        fileId: number,
        fileName: string,
        downloadUrl: string,
        name: string,
        gameName: string,
        gameId: number
      ) => Promise<string>
      uninstallMod: (modId: number) => Promise<void>
      getInstalledMods: () => Promise<Record<number, unknown>>
      scanInstalledMods: () => Promise<DetectedMod[]>
      setModProfileUrl: (modId: number, url: string | null) => Promise<void>
      setModGbId: (modId: number, gbId: number | null) => Promise<void>
      renameModWithGbId: (modId: number, gbId: number) => Promise<string | null>
      renameModPathWithGbId: (
        folderPath: string,
        displayName: string,
        gbId: number
      ) => Promise<string | null>
      checkUpdates: () => Promise<
        Array<{ modId: number; newFileId: number; downloadUrl: string; fileName: string }>
      >
      onProgress: (callback: ProgressCallback) => () => void
      openModsDir: () => Promise<void>
      openFolder: (folderPath: string) => Promise<void>

      pickFolder: () => Promise<string | null>
      getAllGamePaths: () => Promise<Record<number, string>>
      setGamePath: (gameId: number, folderPath: string) => Promise<void>
      removeGamePath: (gameId: number) => Promise<void>
      openGamePath: (gameId: number) => Promise<void>

      pickGameExeFolder: () => Promise<string | null>
      getAllGameExePaths: () => Promise<Record<number, string>>
      setGameExePath: (gameId: number, dirPath: string) => Promise<void>
      removeGameExePath: (gameId: number) => Promise<void>
      openGameExePath: (gameId: number) => Promise<void>

      reshadeGetLatest: () => Promise<{ version: string; hasAddon: boolean }>
      reshadeInstall: (gameId: number) => Promise<{ installed: boolean; dllName?: string }>
      reshadeInstallAddon: (gameId: number) => Promise<{ installed: boolean; dllName?: string }>
      reshadeCheckStatus: (gameId: number) => Promise<{ installed: boolean; dllName?: string }>
      reshadeUninstall: (gameId: number) => Promise<{ installed: false }>
      reshadeListPresets: (gameId: number) => Promise<Array<{
        name: string; fileName: string; fullPath: string; isActive: boolean
      }>>
      reshadeSetActivePreset: (gameId: number, presetFileName: string) => Promise<Array<{
        name: string; fileName: string; fullPath: string; isActive: boolean
      }>>
      reshadeImportPreset: (gameId: number) => Promise<Array<{
        name: string; fileName: string; fullPath: string; isActive: boolean
      }>>
      reshadeCreatePreset: (gameId: number, name: string) => Promise<{
        fileName: string
        presets: Array<{ name: string; fileName: string; fullPath: string; isActive: boolean }>
      }>
      reshadeDeletePreset: (gameId: number, presetFileName: string) => Promise<Array<{
        name: string; fileName: string; fullPath: string; isActive: boolean
      }>>
      reshadeOpenPresetsDir: (gameId: number) => Promise<void>

      gbGetGameCategories: (gameId: number) => Promise<Array<{
        id: number
        name: string
        url: string
        parentId: number | null
      }>>
      gbGetGameMods: (gameId: number, categoryId?: number) => Promise<unknown>
      gbFetch: (url: string) => Promise<unknown>
    }
  }
}

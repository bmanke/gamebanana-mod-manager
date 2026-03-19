// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { DetectedMod } from '../main/index'
import type { InstalledMod } from '../main/store'

contextBridge.exposeInMainWorld('modApi', {
  // existing mod APIs
  installMod: (
    modId: number,
    fileId: number,
    fileName: string,
    downloadUrl: string,
    name: string,
    gameName: string,
    gameId: number
  ) =>
    ipcRenderer.invoke(
      'mod:install',
      modId,
      fileId,
      fileName,
      downloadUrl,
      name,
      gameName,
      gameId
    ) as Promise<string>,
  uninstallMod: (modId: number) =>
    ipcRenderer.invoke('mod:uninstall', modId) as Promise<void>,
  getInstalledMods: () =>
    ipcRenderer.invoke('mod:getAll') as Promise<Record<string, InstalledMod>>,
  checkUpdates: () =>
    ipcRenderer.invoke('mod:checkUpdates') as Promise<any[]>,
  openModsDir: () =>
    ipcRenderer.invoke('mod:openDir') as Promise<void>,
  onProgress: (handler: (p: number) => void) => {
    const listener = (_: any, pct: number) => handler(pct)
    ipcRenderer.on('mod:progress', listener)
    return () => ipcRenderer.removeListener('mod:progress', listener)
  },

  // game path APIs
  pickGamePath: () => ipcRenderer.invoke('gamePath:pick') as Promise<string | null>,
  getAllGamePaths: () => ipcRenderer.invoke('gamePath:getAll'),
  setGamePath: (gameId: number, path: string) =>
    ipcRenderer.invoke('gamePath:set', gameId, path),
  removeGamePath: (gameId: number) =>
    ipcRenderer.invoke('gamePath:remove', gameId),
  openGamePath: (gameId: number) =>
    ipcRenderer.invoke('gamePath:open', gameId),

  // ReShade APIs (unchanged)
  reshadeGetLatest: () => ipcRenderer.invoke('reshade:getLatest'),
  reshadeInstall: (gameId: number) =>
    ipcRenderer.invoke('reshade:install', gameId),
  reshadeInstallAddon: (gameId: number) =>
    ipcRenderer.invoke('reshade:installAddon', gameId),
  reshadeCheckStatus: (gameId: number) =>
    ipcRenderer.invoke('reshade:checkStatus', gameId),
  reshadeUninstall: (gameId: number) =>
    ipcRenderer.invoke('reshade:uninstall', gameId),
  reshadeListPresets: (gameId: number) =>
    ipcRenderer.invoke('reshade:listPresets', gameId),
  reshadeSetActivePreset: (gameId: number, presetFileName: string) =>
    ipcRenderer.invoke('reshade:setActivePreset', gameId, presetFileName),
  reshadeImportPreset: (gameId: number) =>
    ipcRenderer.invoke('reshade:importPreset', gameId),
  reshadeCreatePreset: (gameId: number, name: string) =>
    ipcRenderer.invoke('reshade:createPreset', gameId, name),
  reshadeDeletePreset: (gameId: number, presetFileName: string) =>
    ipcRenderer.invoke('reshade:deletePreset', gameId, presetFileName),
  reshadeOpenPresetsDir: (gameId: number) =>
    ipcRenderer.invoke('reshade:openPresetsDir', gameId),

  // GameBanana proxy
  gbFetch: (url: string) =>
    ipcRenderer.invoke('gb:fetch', url),

  // NEW: scan mods installed outside the manager
  scanInstalledMods: () =>
    ipcRenderer.invoke('mods:scanInstalled') as Promise<DetectedMod[]>,

  // NEW: open arbitrary folder path (used for scanned mods)
  openFolder: (folderPath: string) =>
    ipcRenderer.invoke('open-folder', folderPath)
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
      getInstalledMods: () => Promise<Record<string, InstalledMod>>
      checkUpdates: () => Promise<any[]>
      openModsDir: () => Promise<void>
      onProgress: (handler: (p: number) => void) => () => void

      pickGamePath: () => Promise<string | null>
      getAllGamePaths: () => Promise<any>
      setGamePath: (gameId: number, path: string) => Promise<void>
      removeGamePath: (gameId: number) => Promise<void>
      openGamePath: (gameId: number) => Promise<void>

      reshadeGetLatest: () => Promise<any>
      reshadeInstall: (gameId: number) => Promise<any>
      reshadeInstallAddon: (gameId: number) => Promise<any>
      reshadeCheckStatus: (gameId: number) => Promise<any>
      reshadeUninstall: (gameId: number) => Promise<any>
      reshadeListPresets: (gameId: number) => Promise<any[]>
      reshadeSetActivePreset: (gameId: number, presetFileName: string) => Promise<any>
      reshadeImportPreset: (gameId: number) => Promise<any>
      reshadeCreatePreset: (gameId: number, name: string) => Promise<any>
      reshadeDeletePreset: (gameId: number, presetFileName: string) => Promise<any>
      reshadeOpenPresetsDir: (gameId: number) => Promise<any>

      gbFetch: (url: string) => Promise<any>

      scanInstalledMods: () => Promise<DetectedMod[]>
      openFolder: (folderPath: string) => Promise<void>
    }
  }
}

/// <reference types="vite/client" />

import type { InstalledMod } from '../../main/store'

type ProgressCallback = (pct: number) => void

interface ReShadeStatus {
  installed: boolean
  dllName?: string
}

interface ReShadeRelease {
  version: string
  hasAddon: boolean
}

interface ReShadePreset {
  name: string
  fileName: string
  fullPath: string
  isActive: boolean
}

interface ModApi {
  installMod(modId: number, fileId: number, fileName: string, downloadUrl: string, name: string, gameName: string, gameId: number): Promise<string>
  uninstallMod(modId: number): Promise<void>
  getInstalledMods(): Promise<Record<number, InstalledMod>>
  checkUpdates(): Promise<Array<{ modId: number; newFileId: number; downloadUrl: string; fileName: string }>>
  onProgress(callback: ProgressCallback): () => void
  openModsDir(): Promise<void>

  pickFolder(): Promise<string | null>
  getAllGamePaths(): Promise<Record<number, string>>
  setGamePath(gameId: number, folderPath: string): Promise<void>
  removeGamePath(gameId: number): Promise<void>
  openGamePath(gameId: number): Promise<void>

  pickGameExeFolder(): Promise<string | null>
  getAllGameExePaths(): Promise<Record<number, string>>
  setGameExePath(gameId: number, dirPath: string): Promise<void>
  removeGameExePath(gameId: number): Promise<void>
  openGameExePath(gameId: number): Promise<void>

  reshadeGetLatest(): Promise<ReShadeRelease>
  reshadeInstall(gameId: number): Promise<ReShadeStatus>
  reshadeInstallAddon(gameId: number): Promise<ReShadeStatus>
  reshadeCheckStatus(gameId: number): Promise<ReShadeStatus>
  reshadeUninstall(gameId: number): Promise<{ installed: false }>

  reshadeListPresets(gameId: number): Promise<ReShadePreset[]>
  reshadeSetActivePreset(gameId: number, presetFileName: string): Promise<ReShadePreset[]>
  reshadeImportPreset(gameId: number): Promise<ReShadePreset[]>
  reshadeCreatePreset(gameId: number, name: string): Promise<{ fileName: string; presets: ReShadePreset[] }>
  reshadeDeletePreset(gameId: number, presetFileName: string): Promise<ReShadePreset[]>
  reshadeOpenPresetsDir(gameId: number): Promise<void>

  gbFetch(url: string): Promise<unknown>
}

declare global {
  interface Window {
    modApi: ModApi
  }
}

export {}

import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export interface InstalledMod {
  id: number
  name: string
  gameName: string
  gameId?: number
  fileId: number
  fileName: string
  installedTimestamp: number
  downloadUrl: string
  installPath: string
}

export interface StoreData {
  mods: Record<number, InstalledMod>
  gamePaths: Record<number, string>      // gameId -> mod install folder
  gameExePaths: Record<number, string>   // gameId -> game exe directory (for ReShade)
}

const storePath = path.join(app.getPath('userData'), 'mods.json')

function read(): StoreData {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'))
  } catch {
    return { mods: {}, gamePaths: {}, gameExePaths: {} }
  }
}

function write(data: StoreData): void {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2))
}

export const store = {
  // ─── Mods ──────────────────────────────────────────────────────────────────
  getAll: (): Record<number, InstalledMod> => read().mods,
  get: (modId: number): InstalledMod | undefined => read().mods[modId],
  set: (modId: number, mod: InstalledMod): void => {
    const data = read()
    data.mods[modId] = mod
    write(data)
  },
  remove: (modId: number): void => {
    const data = read()
    delete data.mods[modId]
    write(data)
  },

  // ─── Mod Install Paths ─────────────────────────────────────────────────────
  getAllGamePaths: (): Record<number, string> => read().gamePaths ?? {},
  getGamePath: (gameId: number): string | undefined => (read().gamePaths ?? {})[gameId],
  setGamePath: (gameId: number, folderPath: string): void => {
    const data = read()
    if (!data.gamePaths) data.gamePaths = {}
    data.gamePaths[gameId] = folderPath
    write(data)
  },
  removeGamePath: (gameId: number): void => {
    const data = read()
    if (data.gamePaths) delete data.gamePaths[gameId]
    write(data)
  },

  // ─── Game Exe Paths (for ReShade) ──────────────────────────────────────────
  getAllGameExePaths: (): Record<number, string> => read().gameExePaths ?? {},
  getGameExePath: (gameId: number): string | undefined => (read().gameExePaths ?? {})[gameId],
  setGameExePath: (gameId: number, dirPath: string): void => {
    const data = read()
    if (!data.gameExePaths) data.gameExePaths = {}
    data.gameExePaths[gameId] = dirPath
    write(data)
  },
  removeGameExePath: (gameId: number): void => {
    const data = read()
    if (data.gameExePaths) delete data.gameExePaths[gameId]
    write(data)
  }
}
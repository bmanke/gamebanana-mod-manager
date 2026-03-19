import fs from 'fs'
import path from 'path'
import os from 'os'

export interface InstalledMod {
  id: number
  name: string
  gameName: string
  gameId: number
  fileId: number
  fileName: string
  downloadUrl: string
  installPath: string
  installedTimestamp: number
  profileUrl?: string | null
  gbId?: number | null
}

interface GamePathMap {
  [gameId: number]: string
}

interface GameExePathMap {
  [gameId: number]: string
}

interface StoreData {
  mods: { [id: number]: InstalledMod }
  gamePaths: GamePathMap
  gameExePaths: GameExePathMap
}

const STORE_DIR = path.join(os.homedir(), '.gb-mod-manager')
const STORE_FILE = path.join(STORE_DIR, 'store.json')

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
}

function loadData(): StoreData {
  ensureStoreDir()
  if (!fs.existsSync(STORE_FILE)) {
    return { mods: {}, gamePaths: {}, gameExePaths: {} }
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      mods: parsed.mods ?? {},
      gamePaths: parsed.gamePaths ?? {},
      gameExePaths: parsed.gameExePaths ?? {}
    }
  } catch {
    return { mods: {}, gamePaths: {}, gameExePaths: {} }
  }
}

function saveData(data: StoreData) {
  ensureStoreDir()
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

class Store {
  private data: StoreData

  constructor() {
    this.data = loadData()
  }

  // ─── Mods ───────────────────────────────────────────────────────────────────
  get(id: number): InstalledMod | undefined {
    return this.data.mods[id]
  }

  set(id: number, mod: InstalledMod) {
    this.data.mods[id] = mod
    saveData(this.data)
  }

  remove(id: number) {
    delete this.data.mods[id]
    saveData(this.data)
  }

  getAll(): { [id: number]: InstalledMod } {
    return { ...this.data.mods }
  }

  setProfileUrl(modId: number, url: string | null) {
    const mod = this.data.mods[modId]
    if (!mod) return
    mod.profileUrl = url
    this.set(modId, mod)
  }

  setGbId(modId: number, gbId: number | null) {
    const mod = this.data.mods[modId]
    if (!mod) return
    mod.gbId = gbId
    this.set(modId, mod)
  }

  // ─── Game paths ─────────────────────────────────────────────────────────────
  getGamePath(gameId: number): string | undefined {
    return this.data.gamePaths[gameId]
  }

  setGamePath(gameId: number, folderPath: string) {
    this.data.gamePaths[gameId] = folderPath
    saveData(this.data)
  }

  removeGamePath(gameId: number) {
    delete this.data.gamePaths[gameId]
    saveData(this.data)
  }

  getAllGamePaths(): GamePathMap {
    return { ...this.data.gamePaths }
  }

  // ─── Game exe paths (ReShade) ───────────────────────────────────────────────
  getGameExePath(gameId: number): string | undefined {
    return this.data.gameExePaths[gameId]
  }

  setGameExePath(gameId: number, dirPath: string) {
    this.data.gameExePaths[gameId] = dirPath
    saveData(this.data)
  }

  removeGameExePath(gameId: number) {
    delete this.data.gameExePaths[gameId]
    saveData(this.data)
  }

  getAllGameExePaths(): GameExePathMap {
    return { ...this.data.gameExePaths }
  }
}

export const store = new Store()

// src/main/modsScanner.ts
import fs from 'fs'
import path from 'path'
import { ipcMain } from 'electron'

// Map your GameBanana game IDs to mod folders
const MOD_PATHS: Record<number, string> = {
  8552: 'C:\\Games\\GenshinImpact\\mods',
  18366: 'C:\\Games\\HSR\\mods',
  19567: 'C:\\Games\\ZZZ\\mods',
  20357: 'C:\\Games\\WutheringWaves\\mods',
  21842: 'C:\\Games\\ArknightsEndfield\\mods'
}

export interface DetectedMod {
  id: number | null          // GameBanana id if we can infer it
  name: string               // folder or manifest name
  gameId: number
  gameName: string
  path: string               // full folder path
  profileUrl?: string | null // GameBanana URL if we know the id
}

// crude helper: extract a numeric id from folder name like "660106 - Cool Mod"
function tryParseIdFromName(name: string): number | null {
  const match = name.match(/\b(\d{4,})\b/)
  return match ? Number(match[1]) : null
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

export function registerModsScannerIpc() {
  ipcMain.handle('scan-installed-mods', async () => {
    const results: DetectedMod[] = []

    for (const [gameIdStr, modDir] of Object.entries(MOD_PATHS)) {
      const gameId = Number(gameIdStr)

      if (!fs.existsSync(modDir)) continue
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(modDir, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const fullPath = path.join(modDir, entry.name)

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
}
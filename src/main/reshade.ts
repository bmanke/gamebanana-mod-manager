import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

// ─── Paths ────────────────────────────────────────────────────────────────────

function getReshadeResourcesDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'reshade')
    : path.join(__dirname, '../../resources/reshade')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReShadeRelease {
  version: string
  hasAddon: boolean
}

export interface ReShadeStatus {
  installed: boolean
  dllName?: string
}

export interface ReShadePreset {
  name: string
  fileName: string
  fullPath: string
  isActive: boolean
}

// ─── Release manifest ─────────────────────────────────────────────────────────

export function getBundledRelease(): ReShadeRelease {
  const manifestPath = path.join(getReshadeResourcesDir(), 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error('ReShade is not bundled. Run: npm run download-reshade')
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
}

// ─── Installer ────────────────────────────────────────────────────────────────

export function getInstallerPath(addon = false): string {
  const dir = getReshadeResourcesDir()
  const file = addon ? 'ReShade_Addon.exe' : 'ReShade.exe'
  const fullPath = path.join(dir, file)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Bundled installer not found: ${file}. Run: npm run download-reshade`)
  }
  return fullPath
}

export function launchInstaller(addon = false): void {
  const installerPath = getInstallerPath(addon)
  if (process.platform === 'win32') {
    exec(`"${installerPath}"`)
  } else {
    exec(`open "${installerPath}"`)
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

const RESHADE_DLLS = ['dxgi.dll', 'd3d11.dll', 'd3d12.dll', 'd3d9.dll', 'opengl32.dll']
const RESHADE_INI = 'ReShade.ini'
const PRESETS_SUBDIR = 'reshade-presets'

export function checkInstalled(gameDir: string): ReShadeStatus {
  if (!fs.existsSync(gameDir)) return { installed: false }
  const iniPath = path.join(gameDir, RESHADE_INI)
  if (!fs.existsSync(iniPath)) return { installed: false }
  const dllName = RESHADE_DLLS.find((dll) => fs.existsSync(path.join(gameDir, dll)))
  return { installed: true, dllName }
}

export function uninstallReShade(gameDir: string): void {
  const filesToRemove = [RESHADE_INI, 'ReShade.log', ...RESHADE_DLLS]
  for (const file of filesToRemove) {
    const p = path.join(gameDir, file)
    try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch { /* skip locked */ }
  }
  for (const dir of [PRESETS_SUBDIR, 'reshade-shaders']) {
    const p = path.join(gameDir, dir)
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
  }
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function getPresetsDir(gameDir: string): string {
  return path.join(gameDir, PRESETS_SUBDIR)
}

function getActivePresetFileName(gameDir: string): string | null {
  const iniPath = path.join(gameDir, RESHADE_INI)
  if (!fs.existsSync(iniPath)) return null
  const content = fs.readFileSync(iniPath, 'utf-8')
  const match = content.match(/PresetPath\s*=\s*(.+)/i)
  if (!match) return null
  return path.basename(match[1].trim())
}

export function listPresets(gameDir: string): ReShadePreset[] {
  const presetsDir = getPresetsDir(gameDir)
  if (!fs.existsSync(presetsDir)) return []
  const activeFileName = getActivePresetFileName(gameDir)
  return fs
    .readdirSync(presetsDir)
    .filter((f) => f.toLowerCase().endsWith('.ini'))
    .map((f) => ({
      name: f.replace(/\.ini$/i, ''),
      fileName: f,
      fullPath: path.join(presetsDir, f),
      isActive: f === activeFileName
    }))
}

export function setActivePreset(gameDir: string, presetFileName: string): void {
  const iniPath = path.join(gameDir, RESHADE_INI)
  if (!fs.existsSync(iniPath)) throw new Error('ReShade.ini not found — is ReShade installed?')

  let content = fs.readFileSync(iniPath, 'utf-8')
  const presetPath = `.\\${PRESETS_SUBDIR}\\${presetFileName}`

  if (/PresetPath\s*=/i.test(content)) {
    content = content.replace(/PresetPath\s*=.*/i, `PresetPath=${presetPath}`)
  } else if (content.includes('[GENERAL]')) {
    content = content.replace('[GENERAL]', `[GENERAL]\nPresetPath=${presetPath}`)
  } else {
    content = `[GENERAL]\nPresetPath=${presetPath}\n\n` + content
  }

  fs.writeFileSync(iniPath, content, 'utf-8')
}

export function importPreset(gameDir: string, sourcePath: string): string {
  const presetsDir = getPresetsDir(gameDir)
  if (!fs.existsSync(presetsDir)) fs.mkdirSync(presetsDir, { recursive: true })
  const fileName = path.basename(sourcePath)
  fs.copyFileSync(sourcePath, path.join(presetsDir, fileName))
  return fileName
}

export function createPreset(gameDir: string, name: string): string {
  const presetsDir = getPresetsDir(gameDir)
  if (!fs.existsSync(presetsDir)) fs.mkdirSync(presetsDir, { recursive: true })
  const fileName = `${name.replace(/[<>:"/\\|?*]/g, '_')}.ini`
  fs.writeFileSync(
    path.join(presetsDir, fileName),
    `[EFFECTS]\n\n[TEXTURES]\n\n[VARIABLES]\n`,
    'utf-8'
  )
  return fileName
}

export function deletePreset(gameDir: string, presetFileName: string): void {
  const p = path.join(getPresetsDir(gameDir), presetFileName)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export function openPresetsDir(gameDir: string): string {
  const presetsDir = getPresetsDir(gameDir)
  if (!fs.existsSync(presetsDir)) fs.mkdirSync(presetsDir, { recursive: true })
  return presetsDir
}

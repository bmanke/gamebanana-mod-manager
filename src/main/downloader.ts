import fs from 'fs'
import path from 'path'
import { net } from 'electron'

export function getModsDir(): string {
  const base = path.join(process.env.APPDATA || '', 'GB Mod Manager', 'mods')
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true })
  }
  return base
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const res = await net.fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed ${res.status} ${res.statusText}`)
  }

  const total = Number(res.headers.get('content-length') || '0')
  const file = fs.createWriteStream(dest)
  const reader = res.body!.getReader()
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      file.write(Buffer.from(value))
      received += value.length
      if (total && onProgress) {
        onProgress(Math.round((received / total) * 100))
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    file.end(() => resolve())
    file.on('error', reject)
  })
}

async function unzip(zipPath: string, destDir: string): Promise<void> {
  const AdmZip = require('adm-zip')
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(destDir, true)
}

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(from, to)
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to)
    }
  }
}

/**
 * Download ZIP into modsRoot, then extract and copy into the gamePath.
 * Returns the final install folder inside gamePath.
 */
export async function installMod(
  modId: number,
  fileName: string,
  downloadUrl: string,
  displayName: string,
  modsRoot: string,
  gamePath: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  ensureDir(modsRoot)
  ensureDir(gamePath)

  const safeZipName = `${modId}_${fileName}`.replace(/[<>:"/\\|?*]/g, '_')
  const zipPath = path.join(modsRoot, safeZipName)

  const tempExtract = path.join(modsRoot, `tmp_${modId}_${Date.now()}`)
  ensureDir(tempExtract)

  try {
    await downloadFile(downloadUrl, zipPath, onProgress)
    await unzip(zipPath, tempExtract)

    const entries = fs.readdirSync(tempExtract, { withFileTypes: true })
    const firstDir = entries.find((e) => e.isDirectory())
    const src = firstDir
      ? path.join(tempExtract, firstDir.name)
      : tempExtract

    const safeName = `${displayName}_${modId}`.replace(/[<>:"/\\|?*]/g, '_')
    let dest = path.join(gamePath, safeName)
    let counter = 1
    while (fs.existsSync(dest)) {
      dest = path.join(gamePath, `${safeName}_${counter++}`)
    }

    copyDirSync(src, dest)
    return dest
  } finally {
    try {
      fs.rmSync(tempExtract, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }

    try {
      fs.rmSync(zipPath, { force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function uninstallMod(installPath: string): Promise<void> {
  if (!installPath || !fs.existsSync(installPath)) return
  await fs.promises.rm(installPath, { recursive: true, force: true })
}
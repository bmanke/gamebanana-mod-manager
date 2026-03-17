import fs from 'fs'
import path from 'path'
import os from 'os'
import { net, app } from 'electron'
import AdmZip from 'adm-zip'
import * as Seven from 'node-7z'
import { path7z } from '7zip-bin-full'

export const MODS_DIR = path.join(app.getPath('userData'), 'mods')

const TEMP_DIR = path.join(os.tmpdir(), 'gb-mod-manager')

// In production, binaries are copied to Resources/7zip by electron-builder.
// In dev, use them directly from node_modules/7zip-bin-full.
function get7zBin(): string {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '7z.exe' : process.platform === 'darwin' ? '7z' : '7z'
    const platform = process.platform === 'win32' ? 'win/x64' : process.platform === 'darwin' ? 'mac' : 'linux'
    return path.join(process.resourcesPath, '7zip', platform, ext)
  }
  return path7z
}

const sevenZipBin = get7zBin()
console.log('7-Zip binary:', sevenZipBin, '| exists:', fs.existsSync(sevenZipBin))

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 64)
}

function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (pct: number) => void,
  redirectCount = 0
): Promise<void> {
  if (redirectCount > 10) return Promise.reject(new Error('Too many redirects'))

  return new Promise((resolve, reject) => {
    const request = net.request({ url })

    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    request.setHeader('Accept', '*/*')
    request.setHeader('Referer', 'https://gamebanana.com/')

    request.on('redirect', (statusCode, _method, redirectUrl) => {
      console.log(`Redirect ${statusCode} → ${redirectUrl}`)
      request.abort()
      downloadFile(redirectUrl, destPath, onProgress, redirectCount + 1)
        .then(resolve)
        .catch(reject)
    })

    request.on('response', (response) => {
      console.log(`Response: ${response.statusCode}, Content-Type: ${response.headers['content-type']}`)

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`))
        return
      }

      const contentType = Array.isArray(response.headers['content-type'])
        ? response.headers['content-type'][0]
        : response.headers['content-type'] ?? ''

      if (contentType.includes('text/html')) {
        reject(new Error('GameBanana returned HTML instead of a file — download link may have expired.'))
        return
      }

      const contentLength = Array.isArray(response.headers['content-length'])
        ? response.headers['content-length'][0]
        : response.headers['content-length'] ?? '0'

      const total = parseInt(contentLength, 10)
      let received = 0
      const fileStream = fs.createWriteStream(destPath)

      response.on('data', (chunk: Buffer) => {
        fileStream.write(chunk)
        received += chunk.length
        if (total > 0 && onProgress) {
          onProgress(Math.round((received / total) * 100))
        }
      })

      response.on('end', () => {
        fileStream.end()
        fileStream.on('finish', () => {
          const stat = fs.statSync(destPath)
          if (stat.size < 100) {
            fs.unlinkSync(destPath)
            reject(new Error(`File too small (${stat.size} bytes) — likely an error response`))
            return
          }
          resolve()
        })
        fileStream.on('error', reject)
      })

      response.on('error', (err) => {
        fileStream.destroy()
        reject(err)
      })
    })

    request.on('error', reject)
    request.end()
  })
}

function moveContents(src: string, dest: string): void {
  ensureDir(dest)
  for (const entry of fs.readdirSync(src)) {
    fs.renameSync(path.join(src, entry), path.join(dest, entry))
  }
  fs.rmdirSync(src)
}

function extractZip(archivePath: string, tmpDir: string): void {
  const zip = new AdmZip(archivePath)
  zip.extractAllTo(tmpDir, true)
}

function extractWith7zip(archivePath: string, tmpDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = Seven.extractFull(archivePath, tmpDir, {
      $bin: sevenZipBin,
      recursive: true
    })
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

const ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'])

async function extractArchive(
  archivePath: string,
  destDir: string,
  fileName: string
): Promise<void> {
  const ext = path.extname(fileName).toLowerCase()

  if (!ARCHIVE_EXTENSIONS.has(ext)) {
    fs.copyFileSync(archivePath, path.join(destDir, fileName))
    fs.unlinkSync(archivePath)
    return
  }

  const tmpExtractDir = path.join(TEMP_DIR, `extract_${Date.now()}`)
  ensureDir(tmpExtractDir)

  try {
    if (ext === '.zip') {
      extractZip(archivePath, tmpExtractDir)
    } else {
      await extractWith7zip(archivePath, tmpExtractDir)
    }
  } catch (err) {
    fs.rmSync(tmpExtractDir, { recursive: true, force: true })
    throw err
  } finally {
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath)
  }

  // Flatten if archive extracted into a single subfolder
  const entries = fs.readdirSync(tmpExtractDir)
  const singleFolder =
    entries.length === 1 &&
    fs.statSync(path.join(tmpExtractDir, entries[0])).isDirectory()

  if (singleFolder) {
    moveContents(path.join(tmpExtractDir, entries[0]), destDir)
    if (fs.existsSync(tmpExtractDir)) fs.rmSync(tmpExtractDir, { recursive: true, force: true })
  } else {
    moveContents(tmpExtractDir, destDir)
  }
}

export async function installMod(
  modId: number,
  fileName: string,
  downloadUrl: string,
  modName: string,
  destDir: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const folderName = `${sanitizeFolderName(modName)}_${modId}`
  const installDir = path.join(destDir, folderName)
  ensureDir(installDir)
  ensureDir(TEMP_DIR)

  const tmpArchivePath = path.join(TEMP_DIR, `${modId}_${Date.now()}_${fileName}`)

  try {
    await downloadFile(downloadUrl, tmpArchivePath, onProgress)
    await extractArchive(tmpArchivePath, installDir, fileName)
  } catch (err) {
    if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true })
    if (fs.existsSync(tmpArchivePath)) fs.unlinkSync(tmpArchivePath)
    throw err
  }

  return installDir
}

export async function uninstallMod(installPath: string): Promise<void> {
  if (fs.existsSync(installPath)) {
    fs.rmSync(installPath, { recursive: true, force: true })
  }
}

export function getModsDir(): string {
  return MODS_DIR
}

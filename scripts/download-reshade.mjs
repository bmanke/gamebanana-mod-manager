import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESHADE_DIR = path.join(__dirname, '../resources/reshade')

const VERSION = '6.7.3'
const STANDARD_URL = `https://reshade.me/downloads/ReShade_Setup_${VERSION}.exe`

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    function fetch(currentUrl) {
      https.get(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          fetch(res.headers.location); return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`)); return
        }
        const file = fs.createWriteStream(destPath)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err) })
      }).on('error', reject)
    }
    fetch(url)
  })
}

async function main() {
  if (!fs.existsSync(RESHADE_DIR)) fs.mkdirSync(RESHADE_DIR, { recursive: true })

  const standardDest = path.join(RESHADE_DIR, 'ReShade.exe')

  console.log(`Downloading ReShade ${VERSION}...`)
  await download(STANDARD_URL, standardDest)
  console.log(`  → ${standardDest}`)

  const manifest = { version: VERSION, hasAddon: false }
  fs.writeFileSync(path.join(RESHADE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDone! ReShade ${VERSION} bundled into resources/reshade/`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
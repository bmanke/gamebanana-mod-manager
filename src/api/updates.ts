import pkg from '../../package.json' assert { type: 'json' }

// GitHub repo owner/name
const OWNER = 'bmanke'
const REPO = 'gamebanana-mod-manager'

// We tag releases like v0.1.0, v0.1.1, etc.
// package.json has "version": "0.1.0"
const CURRENT_VERSION = `v${pkg.version}`

export interface UpdateInfo {
  hasUpdate: boolean
  latestTag: string | null
  htmlUrl: string | null
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github+json'
        }
      }
    )

    if (!res.ok) {
      return { hasUpdate: false, latestTag: null, htmlUrl: null }
    }

    const json = await res.json() as {
      tag_name?: string
      html_url?: string
    }

    const latestTag = json.tag_name ?? null
    const htmlUrl = json.html_url ?? null

    if (!latestTag) {
      return { hasUpdate: false, latestTag: null, htmlUrl: null }
    }

    // If the tag from GitHub differs from our current version, there’s an update.
    const hasUpdate = latestTag !== CURRENT_VERSION

    return { hasUpdate, latestTag, htmlUrl }
  } catch {
    // Network / rate-limit / offline: fail silently and don’t block startup.
    return { hasUpdate: false, latestTag: null, htmlUrl: null }
  }
}
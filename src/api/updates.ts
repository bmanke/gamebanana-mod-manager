// src/api/updates.ts
import pkg from '../../package.json' with { type: 'json' }

const OWNER = 'bmanke'
const REPO = 'gamebanana-mod-manager'
const CURRENT_VERSION = `v${pkg.version}`  // matches tags like v0.4.0

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

    const hasUpdate = latestTag !== CURRENT_VERSION
    return { hasUpdate, latestTag, htmlUrl }
  } catch {
    return { hasUpdate: false, latestTag: null, htmlUrl: null }
  }
}

const BASE = 'https://gamebanana.com/apiv11'

// ─── Default categories per game ──────────────────────────────────────────────
// Kept for reference; we only filter by category when categoryId is passed.

const DEFAULT_CATEGORY_IDS: Record<number, number[]> = {
  // Genshin Impact – Characters
  8552: [18140],
  // Honkai: Star Rail – Characters
  18366: [22832],
  // Zenless Zone Zero – Skins
  19567: [30305],
  // Wuthering Waves – Skins
  20357: [29524],
  // Arknights: Endfield – Operators
  21842: [42727]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GBFile {
  _idRow: number
  _sFile: string
  _nFilesize: number
  _sDescription: string
  _tsDateAdded: number
  _nDownloadCount: number
  _sDownloadUrl: string
  _sMd5Checksum: string
}

export interface GBPreviewMedia {
  _aImages?: Array<{
    _sType: string
    _sBaseUrl: string
    _sFile: string
    _sFile220?: string
    _sFile530?: string
    _sFile100?: string
  }>
}

export interface GBMod {
  _idRow: number
  _sName: string
  _sProfileUrl: string
  _sText: string
  _nLikeCount: number
  _nViewCount: number
  _nDownloadCount: number
  _tsDateAdded: number
  _tsDateUpdated: number
  _aPreviewMedia: GBPreviewMedia
  _aFiles: GBFile[]
  _aGame: {
    _idRow: number
    _sName: string
    _sProfileUrl: string
  }
  _aSubmitter: {
    _idRow: number
    _sName: string
    _sProfileUrl: string
  }
  _aCategory: {
    _idRow: number
    _sName: string
  }
}

export interface GBModSummary {
  _idRow: number
  _sName: string
  _sProfileUrl: string
  _tsDateUpdated: number
  _nDownloadCount: number
  _nLikeCount: number
  _aPreviewMedia: GBPreviewMedia
  _aSubmitter: {
    _sName: string
    _sProfileUrl: string
  }
  _aGame?: {
    _idRow: number
    _sName: string
  }
  _aCategory?: {
    _sName: string
  }
}

export interface GBGame {
  _idRow: number
  _sName: string
  _sProfileUrl?: string
  _sIconUrl?: string
  _nModCount?: number
}

export interface GBPagedResult<T> {
  records: T[]
  totalCount: number
  page: number
  perPage: number
  totalPages: number
}

export interface UpdateAvailable {
  modId: number
  modName: string
  latestFile: GBFile
  installedTimestamp: number
}

// ─── Core Helper ──────────────────────────────────────────────────────────────

async function get<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const url = new URL(`${BASE}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return window.modApi.gbFetch(url.toString()) as Promise<T>
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function getModThumbnail(mod: GBModSummary | GBMod): string | null {
  const images = mod._aPreviewMedia?._aImages
  if (!images?.length) return null
  const img = images[0]
  const file = img._sFile220 ?? img._sFile100 ?? img._sFile
  return `${img._sBaseUrl}/${file}`
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Mod Endpoints ────────────────────────────────────────────────────────────

const MOD_LIST_FIELDS = [
  '_idRow',
  '_sName',
  '_sProfileUrl',
  '_tsDateUpdated',
  '_nDownloadCount',
  '_nLikeCount',
  '_aPreviewMedia',
  '_aSubmitter',
  '_aGame',
  '_aCategory'
].join(',')

const MOD_DETAIL_FIELDS = [
  '_idRow',
  '_sName',
  '_sProfileUrl',
  '_sText',
  '_nLikeCount',
  '_nViewCount',
  '_nDownloadCount',
  '_tsDateAdded',
  '_tsDateUpdated',
  '_aPreviewMedia',
  '_aFiles',
  '_aGame',
  '_aSubmitter',
  '_aCategory'
].join(',')

export async function searchMods(options: {
  gameId?: number
  categoryId?: number
  query?: string
  page?: number
  perPage?: number
  sort?: 'new' | 'popular' | 'updated'
}): Promise<GBPagedResult<GBModSummary>> {
  const {
    gameId,
    categoryId,
    query,
    page = 1,
    perPage = 24,
    sort = 'popular'
  } = options

  // ── Full‑text search path ───────────────────────────────────────────────────
  if (query?.trim()) {
    const params: Record<string, string | number> = {
      _sSearchString: query.trim(),
      _nPage: page,
      _nPerpage: perPage,
      _sModelName: 'Mod',
      _csvProperties: MOD_LIST_FIELDS
    }

    // Match how v11 category lists work: _aFilters[Generic_Category]=18140
    if (categoryId != null) {
      params['_aFilters[Generic_Category]'] = categoryId
    }
    if (gameId != null) {
      params['_aFilters[Generic_Game]'] = gameId
    }

    const data = await get<{
      _aRecords: GBModSummary[]
      _aMetadata: { _nRecordCount: number }
    }>('/Util/Search/Results', params)

    const totalCount = data._aMetadata?._nRecordCount ?? 0
    return {
      records: data._aRecords ?? [],
      totalCount,
      page,
      perPage,
      totalPages: Math.ceil(totalCount / perPage) || 1
    }
  }

  // ── Browse path (no search query) ───────────────────────────────────────────
  const params: Record<string, string | number> = {
    _nPage: page,
    _nPerpage: perPage,
    _csvProperties: MOD_LIST_FIELDS
  }

  // Sorting – mirrors typical usage; tweak if DevTools shows different keys
  switch (sort) {
    case 'popular':
      params._sOrderBy = '_nDownloadCount'
      params._sOrder = 'DESC'
      break
    case 'updated':
      params._sOrderBy = '_tsDateUpdated'
      params._sOrder = 'DESC'
      break
    case 'new':
    default:
      params._sOrderBy = '_tsDateAdded'
      params._sOrder = 'DESC'
      break
  }

  if (categoryId != null) {
    params['_aFilters[Generic_Category]'] = categoryId
  }
  if (gameId != null) {
    params['_aFilters[Generic_Game]'] = gameId
  }

  const data = await get<{
    _aRecords: GBModSummary[]
    _aMetadata: { _nRecordCount: number }
  }>('/Mod/Index', params)

  const totalCount = data._aMetadata?._nRecordCount ?? 0
  return {
    records: data._aRecords ?? [],
    totalCount,
    page,
    perPage,
    totalPages: Math.ceil(totalCount / perPage) || 1
  }
}

export async function getModDetails(modId: number): Promise<GBMod> {
  return get<GBMod>(`/Mod/${modId}`, {
    _csvProperties: MOD_DETAIL_FIELDS
  })
}

export async function getModFiles(modId: number): Promise<GBFile[]> {
  const data = await get<{ _aFiles: GBFile[] }>(`/Mod/${modId}`, {
    _csvProperties: '_aFiles'
  })
  return data._aFiles ?? []
}

export async function getLatestFile(modId: number): Promise<GBFile | null> {
  const files = await getModFiles(modId)
  return files.at(-1) ?? null
}

// ─── Game Endpoints ───────────────────────────────────────────────────────────

export async function searchGames(query: string): Promise<GBGame[]> {
  const data = await get<{ _aRecords: GBGame[] }>('/Game/Index', {
    _sName: query,
    _nPage: 1,
    _nPerpage: 20,
    _csvProperties: '_idRow,_sName,_sProfileUrl,_sIconUrl,_nModCount'
  })
  return data._aRecords ?? []
}

export async function getGame(gameId: number): Promise<GBGame> {
  return get<GBGame>(`/Game/${gameId}`, {
    _csvProperties: '_idRow,_sName,_sProfileUrl,_sIconUrl,_nModCount'
  })
}

// ─── Update Checking ──────────────────────────────────────────────────────────

export async function checkModsForUpdates(
  installedMods: Array<{ id: number; name: string; installedTimestamp: number }>
): Promise<UpdateAvailable[]> {
  const results = await Promise.allSettled(
    installedMods.map(async (mod) => {
      const latest = await getLatestFile(mod.id)
      if (!latest) return null
      const latestMs = latest._tsDateAdded * 1000
      if (latestMs > mod.installedTimestamp) {
        return {
          modId: mod.id,
          modName: mod.name,
          latestFile: latest,
          installedTimestamp: mod.installedTimestamp
        } as UpdateAvailable
      }
      return null
    })
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<UpdateAvailable> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
}

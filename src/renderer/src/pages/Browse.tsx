import { useState, useEffect, useRef, useCallback } from 'react'
import {
  searchMods,
  getModDetails,
  getModFiles,
  getModThumbnail,
  formatDate,
  formatFileSize,
  GBModSummary,
  GBMod,
  GBGame,
  GBFile
} from '../api/gamebanana'

// ─── Hard‑coded games we care about ───────────────────────────────────────────

const SUPPORTED_GAMES: GBGame[] = [
  { _idRow: 8552, _sName: 'Genshin Impact' },
  { _idRow: 18366, _sName: 'Honkai: Star Rail' },
  { _idRow: 19567, _sName: 'Zenless Zone Zero' },
  { _idRow: 20357, _sName: 'Wuthering Waves' },
  { _idRow: 21842, _sName: 'Arknights: Endfield' }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMatureMod(mod: GBModSummary): boolean {
  if (mod._bHasContentRatings) return true
  const vis = mod._sInitialVisibility?.toLowerCase()
  if (vis && vis !== 'show') return true
  return false
}

// ─── Mod Card ─────────────────────────────────────────────────────────────────

function ModCard({
  mod,
  isInstalled,
  onClick
}: {
  mod: GBModSummary
  isInstalled: boolean
  onClick: () => void
}) {
  const thumb = getModThumbnail(mod)

  return (
    <button
      onClick={onClick}
      className="group text-left bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-yellow-500 transition-colors w-full"
    >
      <div className="w-full h-36 bg-gray-900 overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={mod._sName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-3xl">
            📦
          </div>
        )}
      </div>

      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-semibold text-sm text-white leading-tight line-clamp-2">
            {mod._sName ?? 'Unnamed Mod'}
          </h3>
          {isInstalled && (
            <span className="shrink-0 text-xs bg-green-600/20 text-green-400 border border-green-600/30 rounded px-1.5 py-0.5">
              Installed
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 truncate">
          by {mod._aSubmitter?._sName ?? 'Unknown'}
        </p>

        <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
          <span>⬇ {(mod._nDownloadCount ?? 0).toLocaleString()}</span>
          <span>♥ {(mod._nLikeCount ?? 0).toLocaleString()}</span>
          <span className="ml-auto">
            {mod._tsDateUpdated ? formatDate(mod._tsDateUpdated) : '—'}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Mod Detail Modal ─────────────────────────────────────────────────────────

function ModDetailModal({
  modId,
  summary,
  installedMods,
  onClose,
  onInstalled
}: {
  modId: number
  summary: GBModSummary
  installedMods: Set<number>
  onClose: () => void
  onInstalled: (modId: number) => void
}) {
  const [mod, setMod] = useState<GBMod | null>(null)
  const [files, setFiles] = useState<GBFile[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)

  const isInstalled = installedMods.has(modId)
  const file = files.at(-1) ?? mod?._aFiles?.at(-1) ?? null

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setMod(null)
      setFiles([])

      try {
        const fullMod = await getModDetails(modId, summary)
        if (cancelled) return
        setMod(fullMod)

        if (fullMod._aFiles?.length) {
          setFiles(fullMod._aFiles)
        } else {
          const modFiles = await getModFiles(modId)
          if (cancelled) return
          setFiles(modFiles)
        }
      } catch {
        try {
          const modFiles = await getModFiles(modId)
          if (cancelled) return
          setFiles(modFiles)
          setError('Failed to load full mod details, but download files were found.')
        } catch {
          if (cancelled) return
          setError('Failed to load mod details and files.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [modId, summary])

  useEffect(() => {
    const cleanup = window.modApi.onProgress(setProgress)
    return cleanup
  }, [])

  async function handleInstall() {
    if (!file) return

    const modName = mod?._sName ?? summary._sName
    const gameName = mod?._aGame?._sName ?? summary._aGame?._sName ?? 'Unknown game'
    const gameId = mod?._aGame?._idRow ?? summary._aGame?._idRow

    if (!gameId) {
      setError('Missing game information for installation.')
      return
    }

    setInstalling(true)
    setError(null)

    try {
      await window.modApi.installMod(
        modId,
        file._idRow,
        file._sFile,
        file._sDownloadUrl,
        modName,
        gameName,
        gameId
      )
      onInstalled(modId)
    } catch {
      setError('Installation failed. Please try again.')
    } finally {
      setInstalling(false)
      setProgress(null)
    }
  }

  const displayName = (mod ?? summary)._sName
  const displayGameName =
    mod?._aGame?._sName ?? summary._aGame?._sName ?? 'Unknown game'
  const displayAuthorName =
    mod?._aSubmitter?._sName ?? summary._aSubmitter?._sName ?? 'Unknown'
  const displayAuthorUrl =
    mod?._aSubmitter?._sProfileUrl ??
    summary._aSubmitter?._sProfileUrl ??
    (mod ?? summary)._sProfileUrl

  const downloads = (mod?._nDownloadCount ?? summary._nDownloadCount ?? 0).toLocaleString()
  const likes = (mod?._nLikeCount ?? summary._nLikeCount ?? 0).toLocaleString()
  const views = (mod?._nViewCount ?? 0).toLocaleString()

  const thumb = getModThumbnail(summary)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {thumb && (
          <img
            src={thumb}
            className="w-full h-56 object-cover rounded-t-2xl"
            alt={displayName}
          />
        )}

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">{displayName}</h2>
              <p className="text-sm text-gray-400">
                by{' '}
                {displayAuthorUrl ? (
                  <a
                    href={displayAuthorUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-yellow-400 hover:underline"
                  >
                    {displayAuthorName}
                  </a>
                ) : (
                  <span className="text-gray-400">{displayAuthorName}</span>
                )}
                {' · '}
                {displayGameName}
                {mod?._aCategory && ` · ${mod._aCategory._sName}`}
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-xl shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-4 text-sm text-gray-400">
            <span>⬇ {downloads} downloads</span>
            <span>♥ {likes} likes</span>
            <span>👁 {views} views</span>
          </div>

          {loading && (
            <p className="text-sm text-gray-500 pt-2">Loading file details…</p>
          )}

          {file && (
            <div className="bg-gray-800 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-300 font-medium">Latest File</p>
              <div className="flex items-center justify-between text-gray-400">
                <span className="truncate">{file._sFile}</span>
                <span className="shrink-0 ml-4">{formatFileSize(file._nFilesize)}</span>
              </div>
              <p className="text-gray-500 text-xs">
                Uploaded {formatDate(file._tsDateAdded)} · {(file._nDownloadCount ?? 0).toLocaleString()} downloads
              </p>
              {file._sDescription && (
                <p className="text-gray-400 text-xs pt-1 italic">"{file._sDescription}"</p>
              )}
            </div>
          )}

          {!loading && !file && (
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400">
              No downloadable file was found for this mod.
            </div>
          )}

          {progress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Downloading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            {isInstalled ? (
              <button
                disabled
                className="px-5 py-2 rounded-lg bg-green-700/30 text-green-400 border border-green-700/40 text-sm cursor-default"
              >
                ✓ Installed
              </button>
            ) : file ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {installing ? 'Downloading...' : 'Download / Install'}
              </button>
            ) : (
              <button
                disabled
                className="px-5 py-2 rounded-lg bg-gray-800 text-gray-400 border border-gray-700 text-sm cursor-not-allowed"
              >
                No Download Available
              </button>
            )}

            {summary._sProfileUrl && (
              <a
                href={summary._sProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-400 text-sm text-gray-300 hover:text-white transition-colors"
              >
                View on GameBanana ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Browse page ─────────────────────────────────────────────────────────

export default function Browse() {
  const [currentGame, setCurrentGame] = useState<GBGame>(SUPPORTED_GAMES[0])
  const [mods, setMods] = useState<GBModSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedMod, setSelectedMod] = useState<GBModSummary | null>(null)
  const [installedMods, setInstalledMods] = useState<Set<number>>(new Set())
  const [includeMature, setIncludeMature] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const raw = window.localStorage.getItem('includeMature')
    return raw === 'true'
  })
  const [query, setQuery] = useState('')

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchMods = useCallback(
    async (targetPage: number, game: GBGame = currentGame, searchText?: string) => {
      setLoading(true)
      setError(null)
      try {
        const result = await searchMods({
          gameId: game._idRow,
          sort: 'popular',
          page: targetPage,
          perPage: 24,
          query: searchText?.trim() || undefined
        })

        const records = includeMature
          ? result.records
          : result.records.filter((m) => !isMatureMod(m))

        setMods(records)
        setPage(targetPage)
        setTotalPages(result.totalPages)
      } catch {
        setError('Failed to fetch mods. Check your connection.')
      } finally {
        setLoading(false)
      }
    },
    [currentGame, includeMature]
  )

  useEffect(() => {
    window.modApi.getInstalledMods().then((mods) => {
      setInstalledMods(new Set(Object.keys(mods).map(Number)))
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem('includeMature', String(includeMature))
  }, [includeMature])

  useEffect(() => {
    fetchMods(1, currentGame, query)
  }, [currentGame, fetchMods])

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      fetchMods(1, currentGame, query)
    }, 400)

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [query, currentGame, fetchMods])

  function handleGameTabClick(game: GBGame) {
    setCurrentGame(game)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_GAMES.map((game) => {
            const active = game._idRow === currentGame._idRow
            return (
              <button
                key={game._idRow}
                onClick={() => handleGameTabClick(game)}
                className={
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ' +
                  (active
                    ? 'bg-yellow-500 text-black border-yellow-500'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-yellow-500')
                }
              >
                {game._sName}
              </button>
            )
          })}
        </div>

        <input
          type="text"
          placeholder="Search mods in this game..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-40 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-yellow-500 transition-colors"
        />

        <label className="inline-flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={includeMature}
            onChange={(e) => setIncludeMature(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500"
          />
          <span>Include 18+ / mature</span>
        </label>
      </div>

      <>
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl h-52 animate-pulse border border-gray-700" />
            ))}
          </div>
        ) : mods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500 space-y-2">
            <span className="text-4xl">🔍</span>
            <p>No mods found for this game{query.trim() ? ' and search' : ''}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mods.map((mod) => (
              <ModCard
                key={mod._idRow}
                mod={mod}
                isInstalled={installedMods.has(mod._idRow)}
                onClick={() => setSelectedMod(mod)}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => fetchMods(page - 1, currentGame, query)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => fetchMods(page + 1, currentGame, query)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              Next →
            </button>
          </div>
        )}
      </>

      {selectedMod && (
        <ModDetailModal
          modId={selectedMod._idRow}
          summary={selectedMod}
          installedMods={installedMods}
          onClose={() => setSelectedMod(null)}
          onInstalled={(id) => {
            setInstalledMods((prev) => new Set([...prev, id]))
            setSelectedMod(null)
          }}
        />
      )}
    </div>
  )
}
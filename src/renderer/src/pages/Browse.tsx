import { useState, useEffect, useRef, useCallback } from 'react'
import {
  searchMods,
  searchGames,
  getModDetails,
  getModThumbnail,
  formatDate,
  formatFileSize,
  GBModSummary,
  GBMod,
  GBGame
} from '../api/gamebanana'

interface GBCategory {
  id: number
  name: string
  url: string
  parentId: number | null
}

// ─── Pinned Games ─────────────────────────────────────────────────────────────

const PINNED_GAMES: GBGame[] = [
  { _idRow: 8552,  _sName: 'Genshin Impact' },
  { _idRow: 18366, _sName: 'Honkai: Star Rail' },
  { _idRow: 19567, _sName: 'Zenless Zone Zero' },
  { _idRow: 20357, _sName: 'Wuthering Waves' },
  { _idRow: 21842, _sName: 'Arknights: Endfield' }
]

// ─── Per‑game categories for the sidebar ──────────────────────────────────────

const GAME_CATEGORY_PRESETS: Record<number, GBCategory[]> = {
  // Genshin Impact
  8552: [
    {
      id: 18140,
      name: 'Skins (Characters)',
      url: 'https://gamebanana.com/mods/cats/18140',
      parentId: null
    },
    {
      id: 18137,
      name: 'Weapons',
      url: 'https://gamebanana.com/mods/cats/18137',
      parentId: null
    }
  ],

  // Honkai: Star Rail
  18366: [
    {
      id: 22832,
      name: 'Skins (Characters)',
      url: 'https://gamebanana.com/mods/cats/22832',
      parentId: null
    },
    {
      id: 22833,
      name: 'Weapons',
      url: 'https://gamebanana.com/mods/cats/22833',
      parentId: null
    }
  ],

  // Zenless Zone Zero
  19567: [
    {
      id: 30305,
      name: 'Skins',
      url: 'https://gamebanana.com/mods/cats/30305',
      parentId: null
    }
  ],

  // Wuthering Waves
  20357: [
    {
      id: 29524,
      name: 'Skins',
      url: 'https://gamebanana.com/mods/cats/29524',
      parentId: null
    }
  ],

  // Arknights: Endfield
  21842: [
    {
      id: 42770,
      name: 'Operators',
      url: 'https://gamebanana.com/mods/cats/42770',
      parentId: 35464
    },
    {
      id: 42772,
      name: 'Weapons',
      url: 'https://gamebanana.com/mods/cats/42772',
      parentId: 35464
    }
  ]
}

// ─── Game Selector ────────────────────────────────────────────────────────────

function GameSelector({
  selectedGame,
  onSelect
}: {
  selectedGame: GBGame | null
  onSelect: (game: GBGame | null) => void
}) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GBGame[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const games = await searchGames(query)
        setSearchResults(games)
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [query])

  const displayedGames = query.trim() ? searchResults : PINNED_GAMES

  function handleSelect(game: GBGame) {
    onSelect(game)
    setQuery('')
    setOpen(false)
    setSearchResults([])
  }

  return (
    <div className="relative w-64" ref={containerRef}>
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-500 cursor-pointer transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {selectedGame ? (
          <>
            <span className="flex-1 text-sm text-white truncate">{selectedGame._sName}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(null); setQuery('') }}
              className="text-gray-400 hover:text-white text-xs shrink-0"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-gray-400">Filter by game...</span>
            <span className="text-gray-500 text-xs shrink-0">▾</span>
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <input
              autoFocus
              className="w-full bg-gray-900 text-sm text-white placeholder-gray-500 rounded px-2 py-1.5 outline-none border border-gray-600 focus:border-yellow-500 transition-colors"
              placeholder="Search all games..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            <p className="px-3 pt-2 pb-1 text-xs text-gray-500 uppercase tracking-wide">
              {query.trim() ? (loading ? 'Searching...' : 'Results') : 'Popular Games'}
            </p>
            {loading && (
              <div className="px-3 py-2 text-sm text-gray-400 animate-pulse">Searching...</div>
            )}
            {!loading && displayedGames.length === 0 && query.trim() && (
              <div className="px-3 py-3 text-sm text-gray-500">No games found.</div>
            )}
            {!loading && displayedGames.map((game) => (
              <button
                key={game._idRow}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                  selectedGame?._idRow === game._idRow
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'hover:bg-gray-700 text-white'
                }`}
                onClick={() => handleSelect(game)}
              >
                <span className="truncate">{game._sName}</span>
                {game._nModCount != null && (
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {game._nModCount.toLocaleString()} mods
                  </span>
                )}
                {selectedGame?._idRow === game._idRow && (
                  <span className="text-yellow-400 ml-2 shrink-0">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Category Sidebar ─────────────────────────────────────────────────────────

function GameCategoryBrowser({
  gameId,
  onCategoryChange
}: {
  gameId: number
  onCategoryChange: (category: GBCategory | null) => void
}) {
  const categories = GAME_CATEGORY_PRESETS[gameId] ?? []
  const [active, setActive] = useState<GBCategory | null>(null)

  useEffect(() => {
    setActive(null)
    onCategoryChange(null)
  }, [gameId])

  if (!categories.length) return null

  return (
    <div className="w-64 bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs max-h-80 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-200">Categories</span>
        {active && (
          <button
            onClick={() => { setActive(null); onCategoryChange(null) }}
            className="text-[10px] text-gray-400 hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => { setActive(cat); onCategoryChange(cat) }}
          className={`block w-full text-left px-2 py-1 rounded mb-0.5 text-xs ${
            active?.id === cat.id
              ? 'bg-yellow-500/20 text-yellow-300'
              : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
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
  installedMods,
  onClose,
  onInstalled
}: {
  modId: number
  installedMods: Set<number>
  onClose: () => void
  onInstalled: (modId: number) => void
}) {
  const [mod, setMod] = useState<GBMod | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)

  const isInstalled = installedMods.has(modId)
  const file = mod?._aFiles?.at(-1)

  useEffect(() => {
    getModDetails(modId)
      .then(setMod)
      .catch(() => setError('Failed to load mod details.'))
      .finally(() => setLoading(false))
  }, [modId])

  useEffect(() => {
    const cleanup = window.modApi.onProgress(setProgress)
    return cleanup
  }, [])

  async function handleInstall() {
    if (!mod || !file) return
    setInstalling(true)
    setError(null)
    try {
      await window.modApi.installMod(
        mod._idRow,
        file._idRow,
        file._sFile,
        file._sDownloadUrl,
        mod._sName,
        mod._aGame._sName,
        mod._aGame._idRow
      )
      onInstalled(mod._idRow)
    } catch {
      setError('Installation failed. Please try again.')
    } finally {
      setInstalling(false)
      setProgress(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">
            Loading...
          </div>
        ) : error && !mod ? (
          <div className="flex items-center justify-center h-64 text-red-400">{error}</div>
        ) : mod ? (
          <>
            {getModThumbnail(mod) && (
              <img
                src={getModThumbnail(mod)!}
                className="w-full h-56 object-cover rounded-t-2xl"
                alt={mod._sName}
              />
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{mod._sName}</h2>
                  <p className="text-sm text-gray-400">
                    by{' '}
                    <a
                      href={mod._aSubmitter._sProfileUrl}
                      target="_blank"
                      className="text-yellow-400 hover:underline"
                    >
                      {mod._aSubmitter._sName}
                    </a>
                    {' · '}
                    {mod._aGame._sName}
                    {mod._aCategory && ` · ${mod._aCategory._sName}`}
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
                <span>⬇ {(mod._nDownloadCount ?? 0).toLocaleString()} downloads</span>
                <span>♥ {(mod._nLikeCount ?? 0).toLocaleString()} likes</span>
                <span>👁 {(mod._nViewCount ?? 0).toLocaleString()} views</span>
              </div>

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
                ) : (
                  <button
                    onClick={handleInstall}
                    disabled={installing || !file}
                    className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {installing ? 'Installing...' : 'Install'}
                  </button>
                )}
                <a
                  href={mod._sProfileUrl}
                  target="_blank"
                  className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-400 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  View on GameBanana ↗
                </a>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Browse Page ──────────────────────────────────────────────────────────────

type SortOption = 'new' | 'popular' | 'updated'

export default function Browse() {
  const [mods, setMods] = useState<GBModSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedGame, setSelectedGame] = useState<GBGame | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<GBCategory | null>(null)
  const [sort, setSort] = useState<SortOption>('popular')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedModId, setSelectedModId] = useState<number | null>(null)
  const [installedMods, setInstalledMods] = useState<Set<number>>(new Set())
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.modApi.getInstalledMods().then((mods) => {
      setInstalledMods(new Set(Object.keys(mods).map(Number)))
    })
  }, [])

  const fetchMods = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchMods({
        query: query.trim() || undefined,
        gameId: selectedGame?._idRow,
        categoryId: selectedCategory?.id,
        sort,
        page: targetPage,
        perPage: 24
      })
      setMods(result.records)
      setPage(targetPage)
      setTotalPages(result.totalPages)
    } catch {
      setError('Failed to fetch mods. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [query, selectedGame, selectedCategory, sort])

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => fetchMods(1), 400)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [fetchMods])

  function handleGameSelect(game: GBGame | null) {
    setSelectedGame(game)
    setSelectedCategory(null)
    setPage(1)
  }

  const content = (
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
      ) : !selectedGame && mods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 space-y-3">
          <span className="text-5xl">🎮</span>
          <p className="text-lg font-medium text-gray-400">Select a game to browse mods</p>
          <p className="text-sm">Use the game filter above to get started</p>
        </div>
      ) : mods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 space-y-2">
          <span className="text-4xl">🔍</span>
          <p>No mods found. Try a different search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mods.map((mod) => (
            <ModCard
              key={mod._idRow}
              mod={mod}
              isInstalled={installedMods.has(mod._idRow)}
              onClick={() => setSelectedModId(mod._idRow)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => fetchMods(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
          <button
            onClick={() => fetchMods(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            Next →
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search mods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-yellow-500 transition-colors"
        />
        <GameSelector
          selectedGame={selectedGame}
          onSelect={handleGameSelect}
        />
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(['popular', 'new', 'updated'] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-2 text-sm capitalize transition-colors ${
                sort === s
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {selectedGame ? (
        <div className="flex gap-4">
          <GameCategoryBrowser
            gameId={selectedGame._idRow}
            onCategoryChange={(cat) => {
              setSelectedCategory(cat)
              setPage(1)
            }}
          />
          <div className="flex-1 space-y-5">
            {content}
          </div>
        </div>
      ) : (
        content
      )}

      {selectedModId !== null && (
        <ModDetailModal
          modId={selectedModId}
          installedMods={installedMods}
          onClose={() => setSelectedModId(null)}
          onInstalled={(id) => {
            setInstalledMods((prev) => new Set([...prev, id]))
            setSelectedModId(null)
          }}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { formatDate, checkModsForUpdates, UpdateAvailable } from '../api/gamebanana'
import type { InstalledMod } from '../../../main/store'
import type { DetectedMod } from '../../../main/index'

type LibraryMod = InstalledMod & {
  path?: string
  profileUrl?: string | null
}

// Keep in sync with your main/index.ts game ids
const GAME_OPTIONS: Array<{ id: number; name: string }> = [
  { id: 0, name: 'Unknown / Any' },
  { id: 8552, name: 'Genshin Impact' },
  { id: 18366, name: 'Honkai: Star Rail' },
  { id: 19567, name: 'Zenless Zone Zero' },
  { id: 20357, name: 'Wuthering Waves' },
  { id: 21842, name: 'Arknights: Endfield' }
]

function UpdateBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-2 bg-yellow-500 text-black text-xs font-bold rounded-full px-2 py-0.5">
      {count}
    </span>
  )
}

function normalizeGbUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return `https://gamebanana.com/mods/${s}`
  const m = s.match(/mods\/(\d+)/)
  if (m) return `https://gamebanana.com/mods/${m[1]}`
  return s
}

function extractGbId(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const m = trimmed.match(/mods\/(\d+)/)
  if (m) return Number(m[1])
  return null
}

// Hide trailing _<id> for display only
function stripIdSuffix(name: string | undefined): string {
  if (!name) return ''
  return name.replace(/_(\d{4,})$/, '')
}

function ModRow({
  mod,
  hasUpdate,
  onUninstall,
  onUpdate,
  updating,
  onChangeGame
}: {
  mod: LibraryMod
  hasUpdate: UpdateAvailable | null
  onUninstall: (id: number) => void
  onUpdate: (mod: LibraryMod, update: UpdateAvailable) => void
  updating: boolean
  onChangeGame: (id: number, gameId: number) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [editingLink, setEditingLink] = useState(false)
  const [urlInput, setUrlInput] = useState(
    mod.profileUrl ??
      (mod.gbId ? `https://gamebanana.com/mods/${mod.gbId}` :
       mod.id ? `https://gamebanana.com/mods/${mod.id}` : '')
  )

  const displayName = stripIdSuffix(mod.name)
  const displayFileName = stripIdSuffix(mod.fileName)

  function handleOpenFolder() {
    if (mod.path) {
      window.modApi.openFolder(mod.path)
      return
    }
    if (mod.gameId != null && mod.gameId !== 0) {
      window.modApi.openGamePath(mod.gameId)
    } else {
      window.modApi.openModsDir()
    }
  }

  const gbUrl =
    mod.profileUrl ??
    (mod.gbId ? `https://gamebanana.com/mods/${mod.gbId}` :
     mod.id ? `https://gamebanana.com/mods/${mod.id}` : null)

  async function handleSaveLink() {
    const normalized = normalizeGbUrl(urlInput)
    const gbId = extractGbId(normalized)

    await window.modApi.setModProfileUrl(mod.id, normalized)
    await window.modApi.setModGbId(mod.id, gbId)

    if (gbId && !Number.isNaN(gbId)) {
      const currentPath = mod.path ?? mod.installPath
      if (currentPath) {
        try {
          const newPath = await window.modApi.renameModPathWithGbId(
            currentPath,
            mod.name,
            gbId
          )
          if (newPath) {
            mod.installPath = newPath
            mod.path = newPath
          }
        } catch (err) {
          console.error('Failed to rename folder with GB id', err)
        }
      }
    }

    mod.profileUrl = normalized
    mod.gbId = gbId

    setEditingLink(false)
  }

  const currentGameId = mod.gameId ?? 0
  const currentGameName =
    GAME_OPTIONS.find((g) => g.id === currentGameId)?.name ?? 'Unknown / Any'

  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white truncate">{displayName}</h3>
          {hasUpdate && (
            <span className="shrink-0 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">
              Update available
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-0.5">
          <div className="flex items-center gap-1">
            <span>Game:</span>
            <select
              value={currentGameId}
              onChange={(e) => onChangeGame(mod.id, Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-1.5 py-0.5 focus:outline-none focus:border-yellow-500"
            >
              {GAME_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <span>·</span>
          <span>{displayFileName}</span>
          <span>·</span>
          <span>Installed {formatDate(mod.installedTimestamp / 1000)}</span>
        </div>
        <div className="mt-1">
          <span className="text-xs text-gray-500 font-mono truncate block">
            {mod.path ?? mod.installPath}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasUpdate && (
          <button
            onClick={() => onUpdate(mod, hasUpdate)}
            disabled={updating}
            className="px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updating ? 'Updating...' : '⬆ Update'}
          </button>
        )}

        {/* Open folder icon */}
        <button
          onClick={handleOpenFolder}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
          title="Open install folder"
        >
          📁
        </button>

        {/* GameBanana icon + link editor */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (gbUrl) {
                window.open(gbUrl, '_blank')
              } else {
                setEditingLink((v) => !v)
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setEditingLink((v) => !v)
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-yellow-300 transition-colors"
            title={
              gbUrl
                ? 'Open GameBanana (right‑click to edit link)'
                : 'Link to GameBanana'
            }
          >
            🟡
          </button>

          {editingLink && (
            <div className="absolute right-0 mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-lg z-10">
              <div className="text-[11px] text-gray-400 mb-1">
                GameBanana URL or ID
              </div>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 outline-none focus:border-yellow-500"
                placeholder="https://gamebanana.com/mods/660106 or 660106"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="text-[11px] text-gray-400 hover:text-gray-200"
                  onClick={() => setEditingLink(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="text-[11px] text-yellow-400 hover:text-yellow-200"
                  onClick={handleSaveLink}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {confirming ? (
          <>
            <span className="text-xs text-red-400">Remove?</span>
            <button
              onClick={() => onUninstall(mod.id)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
            >
              No
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400 text-xs transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

export default function Library() {
  const [mods, setMods] = useState<LibraryMod[]>([])
  const [updates, setUpdates] = useState<UpdateAvailable[]>([])
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'updates'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [gameFilter, setGameFilter] = useState<number>(0) // 0 = all

  useEffect(() => {
    loadMods()
    const cleanup = window.modApi.onProgress(setProgress)

    window.addEventListener('focus', loadMods)

    return () => {
      cleanup()
      window.removeEventListener('focus', loadMods)
    }
  }, [])

  async function loadMods() {
    try {
      const [knownMap, scanned] = await Promise.all([
        window.modApi.getInstalledMods(),
        window.modApi.scanInstalledMods()
      ])

      const knownMods = Object.values(knownMap) as InstalledMod[]

      const knownByPath = new Map<string, InstalledMod>()
      for (const km of knownMods) {
        if (km.installPath) knownByPath.set(km.installPath, km)
      }

      const merged: LibraryMod[] = [...knownMods]

      for (const sm of scanned as DetectedMod[]) {
        const existing = knownByPath.get(sm.path)
        if (existing) continue

        merged.push({
          id: sm.id ?? 0,
          gbId: sm.id ?? null,
          name: sm.name,
          gameId: sm.gameId,
          gameName: sm.gameName,
          fileName: sm.name,
          installedTimestamp: Date.now(),
          installPath: sm.path,
          path: sm.path,
          profileUrl:
            sm.profileUrl ??
            (sm.id ? `https://gamebanana.com/mods/${sm.id}` : null)
        })
      }

      setMods(merged)
    } catch (e) {
      console.error('Failed to load installed mods:', e)
    }
  }

  function handleChangeGame(modId: number, gameId: number) {
    setMods((prev) =>
      prev.map((m) =>
        m.id === modId
          ? {
              ...m,
              gameId,
              gameName:
                GAME_OPTIONS.find((g) => g.id === gameId)?.name ?? m.gameName
            }
          : m
      )
    )
  }

  async function handleCheckUpdates() {
    setCheckingUpdates(true)
    try {
      const available = await checkModsForUpdates(
        mods
          .filter((m) => m.gbId ?? m.id)
          .map((m) => ({
            id: m.gbId ?? m.id,
            name: m.name,
            installedTimestamp: m.installedTimestamp
          }))
      )
      setUpdates(available)
      if (available.length > 0) setFilter('updates')
    } finally {
      setCheckingUpdates(false)
    }
  }

  async function handleUpdate(mod: LibraryMod, update: UpdateAvailable) {
    setUpdatingId(mod.id)
    setProgress(0)
    try {
      await window.modApi.installMod(
        mod.gbId ?? mod.id,
        update.latestFile._idRow,
        update.latestFile._sFile,
        update.latestFile._sDownloadUrl,
        mod.name,
        mod.gameName,
        mod.gameId ?? 0
      )
      setUpdates((prev) => prev.filter((u) => u.modId !== mod.id))
      await loadMods()
    } finally {
      setUpdatingId(null)
      setProgress(null)
    }
  }

  async function handleUninstall(modId: number) {
    await window.modApi.uninstallMod(modId)
    setMods((prev) => prev.filter((m) => m.id !== modId))
    setUpdates((prev) => prev.filter((u) => u.modId !== modId))
  }

  async function handleUpdateAll() {
    for (const update of updates) {
      const mod = mods.find((m) => m.id === update.modId)
      if (mod) await handleUpdate(mod, update)
    }
  }

  const filteredMods = mods
    .filter((m) => filter === 'all' || updates.some((u) => u.modId === m.id))
    .filter((m) => (gameFilter === 0 ? true : m.gameId === gameFilter))
    .filter(
      (m) =>
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.gameName.toLowerCase().includes(searchQuery.toLowerCase())
    )

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search installed mods..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-yellow-500 transition-colors"
        />

        {/* Game filter dropdown */}
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(Number(e.target.value))}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 outline-none focus:border-yellow-500"
        >
          <option value={0}>All games</option>
          {GAME_OPTIONS.filter((g) => g.id !== 0).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 text-sm transition-colors ${
              filter === 'all'
                ? 'bg-yellow-500 text-black font-semibold'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
            <span className="ml-1.5 text-xs opacity-70">{mods.length}</span>
          </button>
          <button
            onClick={() => setFilter('updates')}
            className={`px-3 py-2 text-sm transition-colors ${
              filter === 'updates'
                ? 'bg-yellow-500 text-black font-semibold'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Updates
            <UpdateBadge count={updates.length} />
          </button>
        </div>

        {updates.length > 1 && (
          <button
            onClick={handleUpdateAll}
            disabled={updatingId !== null}
            className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Update All ({updates.length})
          </button>
        )}

        <button
          onClick={handleCheckUpdates}
          disabled={checkingUpdates || mods.length === 0}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {checkingUpdates ? (
            <span className="animate-pulse">Checking...</span>
          ) : (
            '↻ Check Updates'
          )}
        </button>
      </div>

      {/* Update in progress bar */}
      {progress !== null && updatingId !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Updating {mods.find((m) => m.id === updatingId)?.name}...</span>
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

      {/* Mod list */}
      {filteredMods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 space-y-2">
          <span className="text-4xl">{mods.length === 0 ? '📭' : '✅'}</span>
          <p>
            {mods.length === 0
              ? 'No mods installed yet. Browse to find some!'
              : filter === 'updates'
              ? 'All mods are up to date.'
              : 'No mods match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMods.map((mod) => (
            <ModRow
              key={mod.id || (mod.path ?? mod.installPath)}
              mod={mod}
              hasUpdate={updates.find((u) => u.modId === mod.id) ?? null}
              onUninstall={handleUninstall}
              onUpdate={handleUpdate}
              updating={updatingId === mod.id}
              onChangeGame={handleChangeGame}
            />
          ))}
        </div>
      )}
    </div>
  )
}

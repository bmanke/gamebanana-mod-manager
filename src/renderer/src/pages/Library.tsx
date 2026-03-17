import { useState, useEffect } from 'react'
import { formatDate, checkModsForUpdates, UpdateAvailable } from '../api/gamebanana'
import type { InstalledMod } from '../../../main/store'

function UpdateBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-2 bg-yellow-500 text-black text-xs font-bold rounded-full px-2 py-0.5">
      {count}
    </span>
  )
}

function ModRow({
  mod,
  hasUpdate,
  onUninstall,
  onUpdate,
  updating
}: {
  mod: InstalledMod
  hasUpdate: UpdateAvailable | null
  onUninstall: (id: number) => void
  onUpdate: (mod: InstalledMod, update: UpdateAvailable) => void
  updating: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  function handleOpenFolder() {
    if (mod.gameId != null) {
      window.modApi.openGamePath(mod.gameId)
    } else {
      window.modApi.openModsDir()
    }
  }

  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white truncate">{mod.name}</h3>
          {hasUpdate && (
            <span className="shrink-0 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">
              Update available
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
          <span>{mod.gameName}</span>
          <span>·</span>
          <span>{mod.fileName}</span>
          <span>·</span>
          <span>Installed {formatDate(mod.installedTimestamp / 1000)}</span>
        </div>
        <div className="mt-1">
          <span className="text-xs text-gray-500 font-mono truncate block">{mod.installPath}</span>
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

        <button
          onClick={handleOpenFolder}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
          title="Open install folder"
        >
          📁
        </button>

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
  const [mods, setMods] = useState<InstalledMod[]>([])
  const [updates, setUpdates] = useState<UpdateAvailable[]>([])
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'updates'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadMods()
    const cleanup = window.modApi.onProgress(setProgress)

    // Re-fetch when window regains focus — catches installs done from Browse
    window.addEventListener('focus', loadMods)

    return () => {
      cleanup()
      window.removeEventListener('focus', loadMods)
    }
  }, [])

  async function loadMods() {
    try {
      const data = await window.modApi.getInstalledMods()
      setMods(Object.values(data))
    } catch (e) {
      console.error('Failed to load installed mods:', e)
    }
  }

  async function handleCheckUpdates() {
    setCheckingUpdates(true)
    try {
      const available = await checkModsForUpdates(
        mods.map((m) => ({ id: m.id, name: m.name, installedTimestamp: m.installedTimestamp }))
      )
      setUpdates(available)
      if (available.length > 0) setFilter('updates')
    } finally {
      setCheckingUpdates(false)
    }
  }

  async function handleUpdate(mod: InstalledMod, update: UpdateAvailable) {
    setUpdatingId(mod.id)
    setProgress(0)
    try {
      await window.modApi.installMod(
        mod.id,
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
              key={mod.id}
              mod={mod}
              hasUpdate={updates.find((u) => u.modId === mod.id) ?? null}
              onUninstall={handleUninstall}
              onUpdate={handleUpdate}
              updating={updatingId === mod.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

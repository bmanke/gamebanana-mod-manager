import { useState, useEffect } from 'react'
import { GBGame } from '../api/gamebanana'

const PINNED_GAMES: GBGame[] = [
  { _idRow: 8552,  _sName: 'Genshin Impact' },
  { _idRow: 18366, _sName: 'Honkai: Star Rail' },
  { _idRow: 19567, _sName: 'Zenless Zone Zero' },
  { _idRow: 20357, _sName: 'Wuthering Waves' },
  { _idRow: 21842, _sName: 'Arknights: Endfield' }
]

interface ReShadeStatus {
  installed: boolean
  dllName?: string
}

interface ReShadePreset {
  name: string
  fileName: string
  fullPath: string
  isActive: boolean
}


// ─── Game Paths Section ───────────────────────────────────────────────────────


function GamePathsSection() {
  const [gamePaths, setGamePaths] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    window.modApi.getAllGamePaths().then(setGamePaths)
  }, [])

  async function handlePick(gameId: number) {
    setSaving(gameId)
    try {
      const chosen = await window.modApi.pickFolder()
      if (!chosen) return
      await window.modApi.setGamePath(gameId, chosen)
      setGamePaths((prev) => ({ ...prev, [gameId]: chosen }))
    } finally {
      setSaving(null)
    }
  }

  async function handleRemove(gameId: number) {
    await window.modApi.removeGamePath(gameId)
    setGamePaths((prev) => {
      const next = { ...prev }
      delete next[gameId]
      return next
    })
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-white">Mod Install Paths</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Where mods are extracted to for each game.
        </p>
      </div>
      {PINNED_GAMES.map((game) => {
        const currentPath = gamePaths[game._idRow]
        const isSaving = saving === game._idRow
        return (
          <div key={game._idRow} className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">{game._sName}</h3>
              <div className="flex items-center gap-2">
                {currentPath && (
                  <>
                    <button
                      onClick={() => window.modApi.openGamePath(game._idRow)}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                    >
                      📁 Open
                    </button>
                    <button
                      onClick={() => handleRemove(game._idRow)}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400 text-xs transition-colors"
                    >
                      Reset
                    </button>
                  </>
                )}
                <button
                  onClick={() => handlePick(game._idRow)}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Picking...' : currentPath ? 'Change' : 'Set Folder'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
              {currentPath ? (
                <>
                  <span className="text-green-400 text-xs shrink-0">✓</span>
                  <span className="text-xs text-gray-300 truncate font-mono">{currentPath}</span>
                </>
              ) : (
                <>
                  <span className="text-gray-500 text-xs shrink-0">○</span>
                  <span className="text-xs text-gray-500 italic">Using default app data folder</span>
                </>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}


// ─── Preset Manager ───────────────────────────────────────────────────────────


function PresetManager({ gameId, initialPresets }: { gameId: number; initialPresets: ReShadePreset[] }) {
  const [presets, setPresets] = useState<ReShadePreset[]>(initialPresets)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPresets(initialPresets)
  }, [initialPresets])

  async function handleSetActive(fileName: string) {
    setLoading(fileName)
    setError(null)
    try {
      const updated = await window.modApi.reshadeSetActivePreset(gameId, fileName)
      setPresets(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to set preset')
    } finally {
      setLoading(null)
    }
  }

  async function handleImport() {
    setLoading('import')
    setError(null)
    try {
      const updated = await window.modApi.reshadeImportPreset(gameId)
      setPresets(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(null)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading('create')
    setError(null)
    try {
      const result = await window.modApi.reshadeCreatePreset(gameId, newName.trim())
      setPresets(result.presets)
      setNewName('')
      setCreating(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create preset')
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(fileName: string) {
    setLoading(fileName)
    setError(null)
    try {
      const updated = await window.modApi.reshadeDeletePreset(gameId, fileName)
      setPresets(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete preset')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-1 space-y-2 border-t border-gray-700 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Presets</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.modApi.reshadeOpenPresetsDir(gameId)}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
          >
            📁 Open Folder
          </button>
          <button
            onClick={handleImport}
            disabled={loading === 'import'}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs disabled:opacity-50 transition-colors"
          >
            {loading === 'import' ? 'Importing...' : '⬆ Import .ini'}
          </button>
          <button
            onClick={() => setCreating((c) => !c)}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {creating && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Preset name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-600 focus:border-yellow-500 rounded text-sm text-white placeholder-gray-500 outline-none transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || loading === 'create'}
            className="px-3 py-1.5 rounded bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {loading === 'create' ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => { setCreating(false); setNewName('') }}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-1">
          No presets yet — import an existing .ini or create a new one.
        </p>
      ) : (
        <div className="space-y-1">
          {presets.map((preset) => (
            <div
              key={preset.fileName}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                preset.isActive
                  ? 'bg-green-500/10 border-green-500/40'
                  : 'bg-gray-900 border-gray-700/60'
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${preset.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />

              <span className={`flex-1 text-sm truncate ${preset.isActive ? 'text-green-300 font-medium' : 'text-gray-300'}`}>
                {preset.name}
                {preset.isActive && (
                  <span className="ml-2 text-xs text-green-500 font-normal">active</span>
                )}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {!preset.isActive && (
                  <button
                    onClick={() => handleSetActive(preset.fileName)}
                    disabled={loading === preset.fileName}
                    className="px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 text-xs disabled:opacity-50 transition-colors"
                  >
                    {loading === preset.fileName ? '...' : 'Set Active'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(preset.fileName)}
                  disabled={loading === preset.fileName || preset.isActive}
                  title={preset.isActive ? "Can't delete the active preset" : 'Delete preset'}
                  className="px-2 py-1 rounded bg-gray-700 hover:bg-red-900/50 text-gray-400 hover:text-red-400 text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── ReShade Section ──────────────────────────────────────────────────────────


function ReShadeSection() {
  const [gameExePaths, setGameExePaths] = useState<Record<number, string>>({})
  const [statuses, setStatuses] = useState<Record<number, ReShadeStatus>>({})
  const [presets, setPresets] = useState<Record<number, ReShadePreset[]>>({})
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [loadingVersion, setLoadingVersion] = useState(false)
  const [installing, setInstalling] = useState<number | null>(null)
  const [uninstalling, setUninstalling] = useState<number | null>(null)
  const [pickingSaving, setPickingSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.modApi.getAllGameExePaths().then(async (paths) => {
      setGameExePaths(paths)

      const statusEntries = await Promise.all(
        Object.keys(paths).map(async (id) => {
          const gameId = Number(id)
          const status = await window.modApi.reshadeCheckStatus(gameId)
          if (status.installed) {
            const gamePresets = await window.modApi.reshadeListPresets(gameId)
            setPresets((prev) => ({ ...prev, [gameId]: gamePresets }))
          }
          return [gameId, status] as const
        })
      )
      setStatuses(Object.fromEntries(statusEntries))
    })

    setLoadingVersion(true)
    window.modApi.reshadeGetLatest()
      .then((release) => {
        setLatestVersion(release.version)
      })
      .catch(() => setLatestVersion(null))
      .finally(() => setLoadingVersion(false))
  }, [])

  async function handlePickExeDir(gameId: number) {
    setPickingSaving(gameId)
    try {
      const chosen = await window.modApi.pickGameExeFolder()
      if (!chosen) return
      await window.modApi.setGameExePath(gameId, chosen)
      setGameExePaths((prev) => ({ ...prev, [gameId]: chosen }))
      const status = await window.modApi.reshadeCheckStatus(gameId)
      setStatuses((prev) => ({ ...prev, [gameId]: status }))
      if (status.installed) {
        const gamePresets = await window.modApi.reshadeListPresets(gameId)
        setPresets((prev) => ({ ...prev, [gameId]: gamePresets }))
      }
    } finally {
      setPickingSaving(null)
    }
  }

  async function handleRemoveExeDir(gameId: number) {
    await window.modApi.removeGameExePath(gameId)
    setGameExePaths((prev) => { const n = { ...prev }; delete n[gameId]; return n })
    setStatuses((prev) => { const n = { ...prev }; delete n[gameId]; return n })
    setPresets((prev) => { const n = { ...prev }; delete n[gameId]; return n })
  }

  async function handleInstall(gameId: number) {
    setError(null)
    setInstalling(gameId)
    try {
      const status = await window.modApi.reshadeInstall(gameId)
      setStatuses((prev) => ({ ...prev, [gameId]: status }))
      if (status.installed) {
        const gamePresets = await window.modApi.reshadeListPresets(gameId)
        setPresets((prev) => ({ ...prev, [gameId]: gamePresets }))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Installation failed')
    } finally {
      setInstalling(null)
    }
  }

  async function handleUninstall(gameId: number) {
    setError(null)
    setUninstalling(gameId)
    try {
      const status = await window.modApi.reshadeUninstall(gameId)
      setStatuses((prev) => ({ ...prev, [gameId]: status }))
      setPresets((prev) => { const n = { ...prev }; delete n[gameId]; return n })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Uninstall failed')
    } finally {
      setUninstalling(null)
    }
  }

  async function handleRefresh(gameId: number) {
    const s = await window.modApi.reshadeCheckStatus(gameId)
    setStatuses((prev) => ({ ...prev, [gameId]: s }))
    if (s.installed) {
      const gamePresets = await window.modApi.reshadeListPresets(gameId)
      setPresets((prev) => ({ ...prev, [gameId]: gamePresets }))
    } else {
      setPresets((prev) => { const n = { ...prev }; delete n[gameId]; return n })
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">ReShade</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Post-processing injector for shaders and visual effects.
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          {loadingVersion ? (
            <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
          ) : latestVersion ? (
            <span className="text-xs text-gray-400">
              Bundled: <span className="text-yellow-400 font-mono">{latestVersion}</span>
            </span>
          ) : (
            <span className="text-xs text-red-400">Could not read bundled version</span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-400 space-y-1">
        <p className="font-medium text-gray-300">How it works</p>
        <p>1. Set each game's directory — the folder containing the game's <span className="font-mono text-gray-300">.exe</span> file.</p>
        <p>2. Click <span className="text-yellow-400 font-medium">Install ReShade</span> — the bundled installer will open. Select your game's <span className="font-mono text-gray-300">.exe</span> and the rendering API, then click <span className="text-yellow-400 font-medium">↻ Refresh</span> when done.</p>
        <p>3. Most games in this list use <span className="font-mono text-gray-300">Direct3D 10/11/12</span>.</p>
      </div>

      {PINNED_GAMES.map((game) => {
        const exePath = gameExePaths[game._idRow]
        const status = statuses[game._idRow]
        const gamePresets = presets[game._idRow] ?? []
        const isInstalling = installing === game._idRow
        const isUninstalling = uninstalling === game._idRow
        const isPicking = pickingSaving === game._idRow

        return (
          <div key={game._idRow} className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">

            {/* Game header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-white">{game._sName}</h3>
                {status?.installed ? (
                  <span className="text-xs bg-green-600/20 text-green-400 border border-green-600/30 rounded px-2 py-0.5">
                    ✓ ReShade installed
                    {status.dllName && <span className="ml-1 font-mono">({status.dllName})</span>}
                  </span>
                ) : exePath ? (
                  <span className="text-xs bg-gray-700 text-gray-400 rounded px-2 py-0.5">
                    Not installed
                  </span>
                ) : null}
              </div>
            </div>

            {/* Game directory */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Game Directory</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2 min-w-0">
                  {exePath ? (
                    <>
                      <span className="text-green-400 text-xs shrink-0">✓</span>
                      <span className="text-xs text-gray-300 truncate font-mono">{exePath}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500 text-xs shrink-0">○</span>
                      <span className="text-xs text-gray-500 italic">No directory set</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {exePath && (
                    <>
                      <button
                        onClick={() => window.modApi.openGameExePath(game._idRow)}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                      >
                        📁
                      </button>
                      <button
                        onClick={() => handleRemoveExeDir(game._idRow)}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400 text-xs transition-colors"
                      >
                        Reset
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePickExeDir(game._idRow)}
                    disabled={isPicking}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs disabled:opacity-50 transition-colors"
                  >
                    {isPicking ? 'Picking...' : exePath ? 'Change' : 'Set Directory'}
                  </button>
                </div>
              </div>
            </div>

            {/* ReShade actions — only show if game dir is set */}
            {exePath && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
                {status?.installed ? (
                  <button
                    onClick={() => handleUninstall(game._idRow)}
                    disabled={isUninstalling}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400 text-xs disabled:opacity-50 transition-colors"
                  >
                    {isUninstalling ? 'Removing...' : 'Uninstall ReShade'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(game._idRow)}
                    disabled={isInstalling}
                    className="px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {isInstalling
                      ? 'Launching installer...'
                      : loadingVersion
                        ? 'Install ReShade'
                        : `Install ReShade ${latestVersion ?? ''}`}
                  </button>
                )}
                <button
                  onClick={() => handleRefresh(game._idRow)}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>
            )}

            {/* Preset manager — only when ReShade is installed */}
            {status?.installed && (
              <PresetManager
                gameId={game._idRow}
                initialPresets={gamePresets}
              />
            )}

          </div>
        )
      })}
    </section>
  )
}


// ─── Settings Page ────────────────────────────────────────────────────────────


export default function Settings() {
  return (
    <div className="space-y-10 max-w-2xl">
      <GamePathsSection />
      <ReShadeSection />
    </div>
  )
}

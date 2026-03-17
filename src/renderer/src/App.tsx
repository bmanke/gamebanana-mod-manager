import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import Browse from './pages/Browse'
import Library from './pages/Library'
import Settings from './pages/Settings'
import { checkForUpdate, type UpdateInfo } from '../../api/updates'

export default function App() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    checkForUpdate().then(setUpdate)
  }, [])

  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-950 text-white">
        <nav className="w-48 flex flex-col gap-1 p-4 bg-gray-900 border-r border-gray-800">
          {[
            { to: '/',        label: '🔍 Browse'   },
            { to: '/library', label: '📦 Library'  },
            { to: '/settings',label: '⚙️ Settings' }
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-yellow-500/20 text-yellow-400 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 flex flex-col">
          {update?.hasUpdate && update.latestTag && (
            <div className="bg-yellow-500 text-black text-sm px-4 py-2 flex items-center justify-between">
              <span>
                A newer version is available ({update.latestTag}). You’re running an older build.
              </span>
              {update.htmlUrl && (
                <a
                  href={update.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-semibold"
                >
                  View on GitHub
                </a>
              )}
            </div>
          )}

          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/"        element={<Browse />}   />
              <Route path="/library" element={<Library />}  />
              <Route path="/settings"element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
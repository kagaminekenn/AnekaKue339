import { ReactNode, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import Home from './pages/Home.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Order from './pages/PricingOrder.tsx'
import Office from './pages/PricingOffice.tsx'
import Items from './pages/Items.tsx'
import SalesOffice from './pages/SalesOffice.tsx'
import SalesOrder from './pages/SalesOrder.tsx'
import Sidebar from './components/Sidebar'
import Login from './pages/Login.tsx'
import { supabase } from './utils/supabase.ts'
import { clearEncryptedSession, loadEncryptedSession, saveEncryptedSession } from './utils/authSession.ts'

const pageComponents: Record<string, ReactNode> = {
  Home: <Home />,
  Dashboard: <Dashboard />,
  Items: <Items />,
  PricingOffice: <Office />,
  PricingOrder: <Order />,
  SalesOffice: <SalesOffice />,
  SalesOrder: <SalesOrder />,
}

function App() {
  const [activePage, setActivePage] = useState('Home')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null)

  const getDisplayNameFromMetadata = (userMetadata: unknown) => {
    if (!userMetadata || typeof userMetadata !== 'object') {
      return null
    }

    const displayName = (userMetadata as { display_name?: unknown }).display_name
    if (typeof displayName === 'string' && displayName.trim()) {
      return displayName.trim()
    }

    return null
  }

  const logout = async () => {
    clearEncryptedSession()
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setSessionExpiresAt(null)
    setUserDisplayName(null)
    setActivePage('Home')
  }

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedSession = await loadEncryptedSession()

        if (!savedSession) {
          setIsAuthenticated(false)
          return
        }

        const { error } = await supabase.auth.setSession({
          access_token: savedSession.accessToken,
          refresh_token: savedSession.refreshToken,
        })

        if (error) {
          clearEncryptedSession()
          setIsAuthenticated(false)
          return
        }

        const { data: userData } = await supabase.auth.getUser()
        const metadataDisplayName = getDisplayNameFromMetadata(userData.user?.user_metadata)

        setIsAuthenticated(true)
        setSessionExpiresAt(savedSession.expiresAt)
        setUserDisplayName(metadataDisplayName || savedSession.user.displayName || 'Admin 339')
      } finally {
        setIsBootstrapping(false)
      }
    }

    void restoreSession()
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return

    const remaining = sessionExpiresAt - Date.now()
    if (remaining <= 0) {
      void logout()
      return
    }

    const timeoutId = window.setTimeout(() => {
      void logout()
    }, remaining)

    return () => window.clearTimeout(timeoutId)
  }, [isAuthenticated, sessionExpiresAt])

  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return error.message
    }

    if (!data.session || !data.user || !data.session.refresh_token) {
      return 'Session tidak valid dari server. Silakan coba lagi.'
    }

    const displayName = getDisplayNameFromMetadata(data.user.user_metadata)

    const savedSession = await saveEncryptedSession({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        displayName,
      },
    })

    setIsAuthenticated(true)
    setSessionExpiresAt(savedSession.expiresAt)
    setUserDisplayName(savedSession.user.displayName || 'Admin 339')
    return null
  }

  if (isBootstrapping) {
    return <div className="min-h-screen" />
  }

  if (!isAuthenticated) {
    return <Login onSubmit={handleLogin} />
  }

  return (
    <div className="min-h-screen text-slate-900 lg:flex">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-cyan-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="font-heading text-base font-semibold tracking-tight text-slate-900">Aneka Kue 339</p>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Bakery Admin Suite</p>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="rounded-xl border border-cyan-100 bg-white p-2 text-cyan-800 shadow-sm transition hover:bg-cyan-50"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <Sidebar
        activePage={activePage}
        onSelectPage={(page) => {
          setActivePage(page)
          setIsSidebarOpen(false)
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userDisplayName={userDisplayName}
        onLogout={() => {
          void logout()
        }}
      />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
        <div className="glass-panel page-enter min-h-[calc(100vh-2rem)] rounded-[1.35rem] p-4 sm:p-5 lg:p-6">
          {pageComponents[activePage] ?? <Home />}
        </div>
      </main>
    </div>
  )
}

export default App

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  DollarSign,
  MoreHorizontal,
  Building2,
  ShoppingBasket,
  List,
  Users,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import Sidebar from './components/Sidebar'
import GlobalTooltip from './components/GlobalTooltip.tsx'
import Login from './pages/Login.tsx'
import { supabase } from './utils/supabase.ts'
import { clearEncryptedSession, loadEncryptedSession, saveEncryptedSession, touchEncryptedSession } from './utils/authSession.ts'

const Home_ = lazy(() => import('./pages/Home.tsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'))
const Items = lazy(() => import('./pages/Items.tsx'))
const LoyalCustomer = lazy(() => import('./pages/LoyalCustomer.tsx'))
const PricingOffice = lazy(() => import('./pages/PricingOffice.tsx'))
const PricingOrder = lazy(() => import('./pages/PricingOrder.tsx'))
const SalesOffice = lazy(() => import('./pages/SalesOffice.tsx'))
const SalesOrder = lazy(() => import('./pages/SalesOrder.tsx'))

const pageComponents = {
  Home: Home_,
  Dashboard,
  Items,
  LoyalCustomer,
  PricingOffice,
  PricingOrder,
  SalesOffice,
  SalesOrder,
}

interface SheetBtnProps {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}

const SheetBtn = ({ icon: Icon, label, active, onClick }: SheetBtnProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      active ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700 hover:bg-slate-50'
    }`}
  >
    <Icon className="h-4 w-4 flex-shrink-0" />
    {label}
  </button>
)

function App() {
  const [activePage, setActivePage] = useState('Home')
  const [mobileSheet, setMobileSheet] = useState<'sales' | 'pricing' | 'more' | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null)
  const isTouchingSessionRef = useRef(false)

  const getDisplayNameFromMetadata = (userMetadata: unknown) => {
    if (!userMetadata || typeof userMetadata !== 'object') {
      return null
    }

    const metadataName = (userMetadata as { display_name?: unknown }).display_name
    if (typeof metadataName === 'string' && metadataName.trim()) {
      return metadataName.trim()
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

  useEffect(() => {
    if (!isAuthenticated) return

    const refreshSessionOnInteraction = async () => {
      if (isTouchingSessionRef.current) {
        return
      }

      isTouchingSessionRef.current = true

      try {
        const refreshedSession = await touchEncryptedSession()
        if (!refreshedSession) {
          void logout()
          return
        }

        setSessionExpiresAt(refreshedSession.expiresAt)
      } finally {
        isTouchingSessionRef.current = false
      }
    }

    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'touchstart', 'scroll', 'mousemove']
    const handler = () => {
      void refreshSessionOnInteraction()
    }

    for (const eventName of events) {
      window.addEventListener(eventName, handler, { passive: true })
    }

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handler)
      }
    }
  }, [isAuthenticated])

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
    setUserDisplayName(displayName || 'Admin 339')
    return null
  }

  if (isBootstrapping) {
    return (
      <>
        <div className="min-h-screen" />
        <GlobalTooltip />
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login onSubmit={handleLogin} />
        <GlobalTooltip />
      </>
    )
  }

  const salesActive = activePage === 'SalesOffice' || activePage === 'SalesOrder'
  const pricingActive = activePage === 'PricingOffice' || activePage === 'PricingOrder'
  const moreActive = activePage === 'Items' || activePage === 'LoyalCustomer'

  const ActivePage = pageComponents[activePage as keyof typeof pageComponents] ?? Home_

  const goTo = (page: string) => {
    setActivePage(page)
    setMobileSheet(null)
  }

  return (
    <div className="lg:flex lg:h-screen">
      {/* Desktop sidebar */}
      <Sidebar
        activePage={activePage}
        onSelectPage={setActivePage}
        userDisplayName={userDisplayName}
        onLogout={() => { void logout() }}
      />

      {/* Main scrollable content */}
      <main className="flex-1 min-w-0 lg:overflow-y-auto">
        <div className="min-h-screen lg:min-h-full px-3 pt-4 pb-24 sm:px-4 sm:pt-5 lg:px-5 lg:pt-5 lg:pb-5">
          <div className="glass-panel page-enter rounded-xl overflow-hidden min-h-[calc(100vh-7rem)] lg:min-h-[calc(100vh-2.5rem)]">
            <Suspense fallback={<div className="min-h-[30vh]" />}>
              <ActivePage />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Mobile bottom sheet backdrop */}
      {mobileSheet && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.18)' }}
          onClick={() => setMobileSheet(null)}
        />
      )}

      {/* Mobile bottom sheet */}
      {mobileSheet && (
        <div className="fixed inset-x-0 z-50 px-3 pb-1 lg:hidden" style={{ bottom: '4.25rem' }}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="px-4 pb-3 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {mobileSheet === 'sales' ? 'Sales' : mobileSheet === 'pricing' ? 'Pricing' : 'More'}
              </p>
              <div className="space-y-0.5">
                {mobileSheet === 'sales' && (
                  <>
                    <SheetBtn icon={Building2} label="Office" active={activePage === 'SalesOffice'} onClick={() => goTo('SalesOffice')} />
                    <SheetBtn icon={ShoppingBasket} label="Order" active={activePage === 'SalesOrder'} onClick={() => goTo('SalesOrder')} />
                  </>
                )}
                {mobileSheet === 'pricing' && (
                  <>
                    <SheetBtn icon={Building2} label="Office" active={activePage === 'PricingOffice'} onClick={() => goTo('PricingOffice')} />
                    <SheetBtn icon={ShoppingBasket} label="Order" active={activePage === 'PricingOrder'} onClick={() => goTo('PricingOrder')} />
                  </>
                )}
                {mobileSheet === 'more' && (
                  <>
                    <SheetBtn icon={List} label="Items" active={activePage === 'Items'} onClick={() => goTo('Items')} />
                    <SheetBtn icon={Users} label="Loyal Customer" active={activePage === 'LoyalCustomer'} onClick={() => goTo('LoyalCustomer')} />
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {userDisplayName && (
                        <p className="truncate px-3 py-1 text-xs text-slate-400">{userDisplayName}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => { setMobileSheet(null); void logout() }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4 flex-shrink-0" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 safe-bottom border-t border-slate-200 bg-white lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex h-16 items-stretch">
          {[
            { key: 'Home', label: 'Home', icon: Home, active: activePage === 'Home' },
            { key: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, active: activePage === 'Dashboard' },
            { key: 'sales', label: 'Sales', icon: ShoppingCart, active: salesActive || mobileSheet === 'sales' },
            { key: 'pricing', label: 'Pricing', icon: DollarSign, active: pricingActive || mobileSheet === 'pricing' },
            { key: 'more', label: 'More', icon: MoreHorizontal, active: moreActive || mobileSheet === 'more' },
          ].map(({ key, label, icon: Icon, active }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === 'Home' || key === 'Dashboard') {
                  goTo(key)
                } else {
                  setMobileSheet(mobileSheet === key ? null : (key as 'sales' | 'pricing' | 'more'))
                }
              }}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-cyan-600' : 'text-slate-400'
              }`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-5 w-5 transition-transform duration-150 ${active ? 'scale-110' : ''}`} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <GlobalTooltip />
    </div>
  )
}

export default App

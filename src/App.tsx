import { ReactNode, useState } from 'react'
import { Menu } from 'lucide-react'
import Home from './pages/Home.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Order from './pages/PricingOrder.tsx'
import Office from './pages/PricingOffice.tsx'
import Items from './pages/Items.tsx'
import SalesOffice from './pages/SalesOffice.tsx'
import SalesOrder from './pages/SalesOrder.tsx'
import Sidebar from './components/Sidebar'

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

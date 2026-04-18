import { ReactNode, useState } from 'react'
import { Menu } from 'lucide-react'
import Home from './pages/Home.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Order from './pages/Order.tsx'
import Items from './pages/Items.tsx'
import Pricing from './pages/Pricing.tsx'
import Sidebar from './components/Sidebar'

const pageComponents: Record<string, ReactNode> = {
  Home: <Home />,
  Dashboard: <Dashboard />,
  Order: <Order />,
  Items: <Items />,
  Pricing: <Pricing />,
}

function App() {
  const [activePage, setActivePage] = useState('Home')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-slate-900 lg:flex">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div>
          <p className="text-base font-semibold text-slate-900">Aneka Kue 339</p>
          <p className="text-sm text-slate-500">Admin Panel</p>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="rounded-xl border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
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
        {pageComponents[activePage] ?? <Home />}
      </main>
    </div>
  )
}

export default App

import { ReactNode, useState } from 'react'
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

  return (
    <div className="min-h-screen flex bg-white text-slate-900">
      <Sidebar activePage={activePage} onSelectPage={setActivePage} />
      <main className="flex-1 overflow-y-auto p-6">
        {pageComponents[activePage] ?? <Home />}
      </main>
    </div>
  )
}

export default App

import { useState } from 'react'
import logo from '../assets/logo.png'
import {
  Home,
  LayoutDashboard,
  Settings2,
  List,
  DollarSign,
  type LucideIcon,
  User,
  LogOut,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  ShoppingCart,
  ShoppingBasket,
} from 'lucide-react'

interface MenuItem {
  name: string;
  key: string;
  icon: LucideIcon
}

interface SidebarProps {
  activePage: string
  onSelectPage: (page: string) => void
  isOpen: boolean
  onClose: () => void
  userDisplayName?: string | null
  onLogout?: () => void
}

const Sidebar = ({ activePage, onSelectPage, isOpen, onClose, userDisplayName, onLogout }: SidebarProps) => {
  const [parameterOpen, setParameterOpen] = useState(activePage === 'Items')
  const [pricingOpen, setPricingOpen] = useState(activePage === 'PricingOffice' || activePage === 'PricingOrder')
  const [salesOpen, setSalesOpen] = useState(activePage === 'SalesOffice' || activePage === 'SalesOrder')

  const menuItems: MenuItem[] = [
    { name: 'Home', key: 'Home', icon: Home },
    { name: 'Dashboard', key: 'Dashboard', icon: LayoutDashboard },
  ]

  const parameterItems: MenuItem[] = [
    { name: 'Items', key: 'Items', icon: List },
  ]

  const pricingItems: MenuItem[] = [
    { name: 'Office', key: 'PricingOffice', icon: Building2 },
    { name: 'Order', key: 'PricingOrder', icon: ShoppingBasket },
  ]

  const salesItems: MenuItem[] = [
    { name: 'Office', key: 'SalesOffice', icon: Building2 },
    { name: 'Order', key: 'SalesOrder', icon: ShoppingBasket },
  ]


  return (
    <>
      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 h-screen w-[18rem] overflow-y-auto border-r border-cyan-100 bg-gradient-to-b from-slate-900 via-slate-900 to-cyan-950 text-slate-100 transition-transform duration-300 lg:sticky lg:top-0 lg:z-10 lg:w-64 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 border-b border-cyan-900/65 px-4 py-4">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Aneka Kue 339 logo"
                className="h-10 w-10 rounded-full border border-cyan-700/60 object-cover"
              />
              <div>
                <p className="font-heading text-base font-bold tracking-tight text-white">Aneka Kue 339</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Operational Console</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-xl p-2 text-cyan-100 transition hover:bg-cyan-900/70 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-2 pt-4">
            <ul className="space-y-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const isActive = activePage === item.key
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => onSelectPage(item.key)}
                      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                        isActive ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40' : 'text-slate-100 hover:bg-cyan-900/60'
                      }`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      {item.name}
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setSalesOpen((value) => !value)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-cyan-900/60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                      <ShoppingCart className="h-5 w-5" />
                    </span>
                    Sales
                  </span>
                  {salesOpen ? <ChevronUp className="h-4 w-4 text-cyan-200" /> : <ChevronDown className="h-4 w-4 text-cyan-200" />}
                </button>
              </li>
              <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ${salesOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <ul className="space-y-2 pl-12 pt-2">
                  {salesItems.map((item, index) => {
                    const Icon = item.icon
                    const isActive = activePage === item.key
                    return (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => onSelectPage(item.key)}
                          className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            isActive ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40' : 'text-slate-100 hover:bg-cyan-900/60'
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                            <Icon className="h-4 w-4" />
                          </span>
                          {item.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <li>
                <button
                  type="button"
                  onClick={() => setPricingOpen((value) => !value)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-cyan-900/60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                      <DollarSign className="h-5 w-5" />
                    </span>
                    Pricing
                  </span>
                  {pricingOpen ? <ChevronUp className="h-4 w-4 text-cyan-200" /> : <ChevronDown className="h-4 w-4 text-cyan-200" />}
                </button>
              </li>
              <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ${pricingOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <ul className="space-y-2 pl-12 pt-2">
                  {pricingItems.map((item, index) => {
                    const Icon = item.icon
                    const isActive = activePage === item.key
                    return (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => onSelectPage(item.key)}
                          className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            isActive ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40' : 'text-slate-100 hover:bg-cyan-900/60'
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                            <Icon className="h-4 w-4" />
                          </span>
                          {item.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <li>
                <button
                  type="button"
                  onClick={() => setParameterOpen((value) => !value)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-cyan-900/60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                      <Settings2 className="h-5 w-5" />
                    </span>
                    Parameter
                  </span>
                  {parameterOpen ? <ChevronUp className="h-4 w-4 text-cyan-200" /> : <ChevronDown className="h-4 w-4 text-cyan-200" />}
                </button>
              </li>
              <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ${parameterOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <ul className="space-y-2 pl-12 pt-2">
                  {parameterItems.map((item, index) => {
                    const Icon = item.icon
                    const isActive = activePage === item.key
                    return (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => onSelectPage(item.key)}
                          className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            isActive ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40' : 'text-slate-100 hover:bg-cyan-900/60'
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                            <Icon className="h-4 w-4" />
                          </span>
                          {item.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </ul>
          </nav>
        </div>

        <div className="border-t border-cyan-900/65 p-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <User className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-medium text-cyan-100">{userDisplayName || 'Admin 339'}</p>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-700/70 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-900/70"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}

export default Sidebar;
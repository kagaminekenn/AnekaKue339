import { useState } from 'react'
import logo from '../assets/logo.png'
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  Settings2,
  List,
  Tag,
  type LucideIcon,
  User,
  ChevronDown,
  ChevronUp,
  X,
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
}

const Sidebar = ({ activePage, onSelectPage, isOpen, onClose }: SidebarProps) => {
  const [parameterOpen, setParameterOpen] = useState(true)

  const menuItems: MenuItem[] = [
    { name: 'Home', key: 'Home', icon: Home },
    { name: 'Dashboard', key: 'Dashboard', icon: LayoutDashboard },
    { name: 'Order', key: 'Order', icon: ShoppingCart },
  ]

  const parameterItems: MenuItem[] = [
    { name: 'Items', key: 'Items', icon: List },
    { name: 'Pricing', key: 'Pricing', icon: Tag },
  ]


  return (
    <>
      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 h-screen w-[18rem] overflow-y-auto border-r border-slate-200 bg-slate-50 transition-transform duration-300 lg:sticky lg:top-0 lg:z-10 lg:w-64 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Aneka Kue 339 logo"
                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
              />
              <div>
                <p className="text-lg font-bold text-slate-900">Aneka Kue 339</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-200 lg:hidden"
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
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                        isActive ? 'bg-emerald-100 text-emerald-700' : 'text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
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
                  onClick={() => setParameterOpen((value) => !value)}
                  className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Settings2 className="h-5 w-5" />
                    </span>
                    Parameter
                  </span>
                  {parameterOpen ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
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
                          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            isActive ? 'bg-emerald-100 text-emerald-700' : 'text-slate-900 hover:bg-slate-200'
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
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

        <div className="p-4 border-t border-slate-200">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <User className="h-4 w-4 text-slate-600" />
              <p className="text-sm font-medium text-slate-700">Admin 339</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}

export default Sidebar;
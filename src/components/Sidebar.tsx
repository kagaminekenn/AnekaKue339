import { useState } from 'react'
import logo from '../assets/logo.png'
import {
  Home,
  LayoutDashboard,
  Settings2,
  List,
  DollarSign,
  type LucideIcon,
  Users,
  User,
  LogOut,
  ChevronDown,
  Building2,
  ShoppingCart,
  ShoppingBasket,
} from 'lucide-react'

interface MenuItem {
  name: string
  key: string
  icon: LucideIcon
}

interface SidebarProps {
  activePage: string
  onSelectPage: (page: string) => void
  userDisplayName?: string | null
  onLogout?: () => void
}

const NavItem = ({
  item,
  isActive,
  onClick,
}: {
  item: MenuItem
  isActive: boolean
  onClick: () => void
}) => {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
        isActive
          ? 'bg-cyan-50 font-semibold text-cyan-700'
          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {item.name}
    </button>
  )
}

const NavGroup = ({
  label,
  icon: Icon,
  items,
  activePage,
  onSelectPage,
}: {
  label: string
  icon: LucideIcon
  items: MenuItem[]
  activePage: string
  onSelectPage: (key: string) => void
}) => {
  const anyActive = items.some((item) => item.key === activePage)
  const [isOpen, setIsOpen] = useState(anyActive)

  return (
    <li>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
          anyActive && !isOpen
            ? 'bg-cyan-50 text-cyan-700'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <ul className="ml-[26px] mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
          {items.map((item) => (
            <li key={item.key}>
              <NavItem
                item={item}
                isActive={activePage === item.key}
                onClick={() => onSelectPage(item.key)}
              />
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

const Sidebar = ({ activePage, onSelectPage, userDisplayName, onLogout }: SidebarProps) => {
  const menuItems: MenuItem[] = [
    { name: 'Home', key: 'Home', icon: Home },
    { name: 'Dashboard', key: 'Dashboard', icon: LayoutDashboard },
  ]

  const salesItems: MenuItem[] = [
    { name: 'Office', key: 'SalesOffice', icon: Building2 },
    { name: 'Order', key: 'SalesOrder', icon: ShoppingBasket },
  ]

  const pricingItems: MenuItem[] = [
    { name: 'Office', key: 'PricingOffice', icon: Building2 },
    { name: 'Order', key: 'PricingOrder', icon: ShoppingBasket },
  ]

  const parameterItems: MenuItem[] = [
    { name: 'Items', key: 'Items', icon: List },
    { name: 'Loyal Customer', key: 'LoyalCustomer', icon: Users },
  ]

  return (
    <aside className="hidden lg:flex sticky top-0 h-screen w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Brand header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
        <img
          src={logo}
          alt="Aneka Kue 339 logo"
          className="h-9 w-9 flex-shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">Aneka Kue 339</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
            Admin Suite
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Sidebar navigation">
        <ul className="space-y-0.5">
          {menuItems.map((item) => (
            <li key={item.key}>
              <NavItem
                item={item}
                isActive={activePage === item.key}
                onClick={() => onSelectPage(item.key)}
              />
            </li>
          ))}

          <li className="pb-1 pt-3">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Modules
            </p>
          </li>

          <NavGroup
            label="Sales"
            icon={ShoppingCart}
            items={salesItems}
            activePage={activePage}
            onSelectPage={onSelectPage}
          />
          <NavGroup
            label="Pricing"
            icon={DollarSign}
            items={pricingItems}
            activePage={activePage}
            onSelectPage={onSelectPage}
          />
          <NavGroup
            label="Parameter"
            icon={Settings2}
            items={parameterItems}
            activePage={activePage}
            onSelectPage={onSelectPage}
          />
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-cyan-100 bg-cyan-50">
            <User className="h-4 w-4 text-cyan-600" />
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
            {userDisplayName ?? 'Admin 339'}
          </p>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              title="Logout"
              className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Building2,
  Receipt,
  PieChart,
  BarChart3,
  Tags,
  Users,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const navigation = [
  { name: 'דשבורד', href: '/dashboard', icon: LayoutDashboard },
  { name: 'הכנסות', href: '/income', icon: TrendingUp },
  { name: 'הוצאות', href: '/expenses', icon: TrendingDown },
  { name: 'תנועות בנק', href: '/bank', icon: Building2 },
  { name: 'חשבוניות', href: '/invoices', icon: Receipt },
  { name: 'תקציב', href: '/budget', icon: PieChart },
  { name: 'דוחות', href: '/reports', icon: BarChart3 },
  { name: 'קטגוריות', href: '/categories', icon: Tags },
  { name: 'ספקים ולקוחות', href: '/contacts', icon: Users },
  { name: 'הגדרות', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()

  return (
    <aside className="fixed top-0 right-0 h-screen w-64 bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">כספית</h1>
        <p className="text-gray-400 text-sm mt-1">ניהול פיננסי חכם</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User & Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm text-white font-medium truncate">
            {user?.full_name || user?.email}
          </p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          התנתק
        </button>
      </div>
    </aside>
  )
}

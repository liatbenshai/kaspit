'use client'

import { Bell, Search } from 'lucide-react'
import { useState } from 'react'
import { useCompany } from '@/hooks/useCompany'

export function Header() {
  const { company } = useCompany()
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Company name */}
        <span className="text-sm text-gray-600">{company?.name}</span>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">התראות</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  אין התראות חדשות
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

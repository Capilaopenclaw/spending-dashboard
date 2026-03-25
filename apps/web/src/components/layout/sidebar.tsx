'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Lightbulb, MessageCircle, Settings, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { t } from '@spending-dashboard/shared'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard.title' },
  { href: '/transactions', icon: Receipt, labelKey: 'transactions.title' },
  { href: '/insights', icon: Lightbulb, labelKey: 'insights.title' },
  { href: '/chat', icon: MessageCircle, labelKey: 'chat.title' },
  { href: '/settings', icon: Settings, labelKey: 'settings.title' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar, language } = useAppStore((s) => ({
    sidebarOpen: s.sidebarOpen,
    toggleSidebar: s.toggleSidebar,
    language: s.language,
  }))

  return (
    <>
      {/* Mobile bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-white/5 bg-bg-card/95 backdrop-blur-lg md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[10px]',
                active ? 'text-accent-primary' : 'text-text-secondary'
              )}
            >
              <item.icon size={20} />
              <span>{t(item.labelKey, language)}</span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-full border-r border-white/5 bg-bg-card transition-all md:flex md:flex-col',
          sidebarOpen ? 'w-56' : 'w-16'
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {sidebarOpen && (
            <span className="text-lg font-bold text-accent-primary">💰 Dashboard</span>
          )}
          <button onClick={toggleSidebar} className="text-text-secondary hover:text-text-primary">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                  active
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                <item.icon size={20} />
                {sidebarOpen && <span className="text-sm font-medium">{t(item.labelKey, language)}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

'use client'

import { Sidebar } from './sidebar'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <main
        className={cn(
          'pb-20 transition-all md:pb-0',
          sidebarOpen ? 'md:ml-56' : 'md:ml-16'
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}

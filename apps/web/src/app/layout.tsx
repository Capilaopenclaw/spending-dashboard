import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spending Dashboard',
  description: 'Tvoje peniaze. Konečne pod kontrolou.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sk" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

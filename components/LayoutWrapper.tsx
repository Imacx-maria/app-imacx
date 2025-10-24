'use client'

import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Navigation } from './Navigation'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideNavigation = pathname === '/login'
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (hideNavigation) {
    return (
      <div className="min-h-screen bg-background">
        <main className="bg-background">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 bg-background overflow-auto">
        <div className="flex flex-col h-full">
          {/* Top Bar with Logo */}
          <div className="flex justify-end items-center px-6 py-4">
            {mounted && (
              <Image
                src={theme === 'dark' ? '/imacx_neg.svg' : '/imacx_pos.svg'}
                alt="IMACX Logo"
                width={120}
                height={30}
                style={{ width: '120px', height: 'auto' }}
                priority
              />
            )}
          </div>
          
          {/* Page Content */}
          <div className="flex-1 p-6">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

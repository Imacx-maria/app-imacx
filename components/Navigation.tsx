'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { 
  ChevronDown, 
  ChevronRight,
  Home,
  FileText,
  Package,
  Users,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  Palette,
  DollarSign,
  Factory,
  Warehouse,
  LogIn,
  LogOut,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface SubMenuItem {
  title: string
  href: string
  icon?: React.ReactNode
}

interface MenuItem {
  title: string
  href?: string
  icon: React.ReactNode
  submenu?: SubMenuItem[]
}

const menuItems: MenuItem[] = [
  {
    title: 'Painel de Controlo',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: 'Fluxo de Design',
    href: '/designer-flow',
    icon: <Palette className="h-5 w-5" />,
  },
  {
    title: 'Produção',
    icon: <Factory className="h-5 w-5" />,
    submenu: [
      { title: 'Gestão', href: '/producao', icon: <Factory className="h-4 w-4" /> },
      { title: 'Operações', href: '/producao/operacoes', icon: <Settings className="h-4 w-4" /> },
    ],
  },
  {
    title: 'Stocks',
    href: '/stocks',
    icon: <Warehouse className="h-5 w-5" />,
  },
  {
    title: 'Gestão',
    icon: <FileText className="h-5 w-5" />,
    submenu: [
      { title: 'Faturação', href: '/gestao/faturacao', icon: <DollarSign className="h-4 w-4" /> },
      { title: 'Análises', href: '/gestao/analytics', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
    
    // Check if user is logged in
    const checkUser = async () => {
      try {
        const { createBrowserClient } = await import('@/utils/supabase')
        const supabase = createBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error('Error checking user:', error)
      }
    }
    
    checkUser()
  }, [])

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const handleLogout = async () => {
    try {
      const { createBrowserClient } = await import('@/utils/supabase')
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const isActive = (href: string) => pathname === href
  const hasActiveSubmenu = (submenu: SubMenuItem[]) => 
    submenu.some(item => pathname === item.href)

  return (
    <div
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card text-foreground transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-end px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:bg-accent hover:text-accent-foreground"
        >
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            if (item.submenu) {
              const isOpen = openSubmenus.includes(item.title) || hasActiveSubmenu(item.submenu)
              
              return (
                <li key={item.title}>
                  <Collapsible open={isOpen} onOpenChange={() => !isCollapsed && toggleSubmenu(item.title)}>
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          hasActiveSubmenu(item.submenu) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                          isCollapsed && 'justify-center'
                        )}
                      >
                        {item.icon}
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    {!isCollapsed && (
                      <CollapsibleContent className="ml-6 mt-1 space-y-1">
                        {item.submenu.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                              isActive(subItem.href)
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            {subItem.icon}
                            <span>{subItem.title}</span>
                          </Link>
                        ))}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </li>
              )
            }

            return (
              <li key={item.title}>
                <Link
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href!)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    isCollapsed && 'justify-center'
                  )}
                >
                  {item.icon}
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer - Auth & Theme */}
      <div className="p-2 space-y-1">
        {/* User Info / Login Button */}
        {user ? (
          <div className={cn('flex flex-col gap-1', isCollapsed && 'items-center')}>
            {!isCollapsed && (
              <div className="px-3 py-1 text-xs text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="truncate">{user.email}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size={isCollapsed ? 'icon' : 'default'}
              onClick={handleLogout}
              className={cn(
                'w-full justify-start gap-3 text-destructive hover:bg-destructive/10',
                isCollapsed && 'justify-center'
              )}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Sair</span>}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size={isCollapsed ? 'icon' : 'default'}
            onClick={() => router.push('/login')}
            className={cn(
              'w-full justify-start gap-3',
              isCollapsed && 'justify-center'
            )}
          >
            <LogIn className="h-5 w-5" />
            {!isCollapsed && <span>Entrar</span>}
          </Button>
        )}

        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size={isCollapsed ? 'icon' : 'default'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'w-full justify-start gap-3',
              isCollapsed && 'justify-center'
            )}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            {!isCollapsed && (
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

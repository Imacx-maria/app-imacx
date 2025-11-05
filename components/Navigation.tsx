'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
import { usePermissions } from '@/providers/PermissionsProvider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SubMenuItem {
  title: string
  href: string
  icon?: React.ReactNode
  pageId?: string // For permission checking
}

interface MenuItem {
  title: string
  href?: string
  icon: React.ReactNode
  submenu?: SubMenuItem[]
  pageId?: string // For permission checking
}

const menuItems: MenuItem[] = [
  {
    title: 'Painel de Controlo',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    pageId: 'dashboard',
  },
  {
    title: 'Fluxo de Design',
    href: '/designer-flow',
    icon: <Palette className="h-5 w-5" />,
    pageId: 'designer-flow',
  },
  {
    title: 'Produção',
    icon: <Factory className="h-5 w-5" />,
    pageId: 'producao',
    submenu: [
      { title: 'Gestão', href: '/producao', icon: <Factory className="h-4 w-4" />, pageId: 'producao' },
      { title: 'Operações', href: '/producao/operacoes', icon: <Settings className="h-4 w-4" />, pageId: 'producao/operacoes' },
    ],
  },
  {
    title: 'Stocks',
    icon: <Warehouse className="h-5 w-5" />,
    pageId: 'stocks',
    submenu: [
      { title: 'Resumo', href: '/stocks', icon: <Warehouse className="h-4 w-4" />, pageId: 'stocks' },
      { title: 'Gestão de Materiais', href: '/definicoes/materiais', icon: <Package className="h-4 w-4" />, pageId: 'definicoes/materiais' },
      { title: 'Gestão de Máquinas', href: '/definicoes/maquinas', icon: <Factory className="h-4 w-4" />, pageId: 'definicoes/maquinas' },
    ],
  },
  {
    title: 'Gestão',
    icon: <FileText className="h-5 w-5" />,
    pageId: 'gestao',
    submenu: [
      { title: 'Faturação', href: '/gestao/faturacao', icon: <DollarSign className="h-4 w-4" />, pageId: 'gestao/faturacao' },
      { title: 'Análises', href: '/gestao/analytics', icon: <LayoutDashboard className="h-4 w-4" />, pageId: 'gestao/analytics' },
    ],
  },
  {
    title: 'Definições',
    icon: <Settings className="h-5 w-5" />,
    pageId: 'definicoes',
    submenu: [
      { title: 'Gestão de Utilizadores', href: '/definicoes/utilizadores', icon: <Users className="h-4 w-4" />, pageId: 'definicoes/utilizadores' },
      { title: 'Gestão de Funções', href: '/definicoes/funcoes', icon: <Settings className="h-4 w-4" />, pageId: 'definicoes/funcoes' },
      { title: 'Gestão de Feriados', href: '/definicoes/feriados', icon: <FileText className="h-4 w-4" />, pageId: 'definicoes/feriados' },
      { title: 'Gestão de Armazéns', href: '/definicoes/armazens', icon: <Warehouse className="h-4 w-4" />, pageId: 'definicoes/armazens' },
      { title: 'Gestão de Complexidade', href: '/definicoes/complexidade', icon: <Settings className="h-4 w-4" />, pageId: 'definicoes/complexidade' },
      { title: 'Gestão de Transportadoras', href: '/definicoes/transportadoras', icon: <Users className="h-4 w-4" />, pageId: 'definicoes/transportadoras' },
      { title: 'Mapeamento de Utilizadores', href: '/definicoes/user-name-mapping', icon: <Users className="h-4 w-4" />, pageId: 'definicoes/user-name-mapping' },
    ],
  },
]

export function Navigation() {
  const navRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { canAccessPage, pagePermissions, loading: permissionsLoading } = usePermissions()
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false) // Always start expanded on SSR
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([])
  const [user, setUser] = useState<any>(null)


  useEffect(() => {
    setMounted(true)

    // Load localStorage preference after mount to avoid hydration mismatch
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === 'true') {
        setIsCollapsed(true)
      }
    }
    
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

  // Close drawer when clicking outside
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (isCollapsed) return
      const target = event.target as Node | null
      const container = navRef.current
      if (container && target && !container.contains(target)) {
        setIsCollapsed(true)
        setOpenSubmenus([])
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isCollapsed])

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev =>
      prev.includes(title)
        ? [] // Close all dropdowns when clicking the open one
        : [title] // Open only this dropdown, closing all others
    )
  }

  const handleSubmenuClick = (title: string) => {
    // If sidebar is collapsed, expand it first
    if (isCollapsed) {
      setIsCollapsed(false)
      // Also open the submenu (only this one)
      setOpenSubmenus([title])
    } else {
      // If already expanded, just toggle the submenu
      toggleSubmenu(title)
    }
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

  // Filter menu items based on permissions
  const filteredMenuItems = useMemo(() => {
    // If still loading, show Dashboard only to prevent blank sidebar
    if (permissionsLoading) {
      console.log('🔄 [NAVIGATION] Permissions loading - showing dashboard only')
      return menuItems.filter(item => item.pageId === 'dashboard')
    }

    // Filter based on actual permissions (empty permissions = only show items without pageId requirement)
    const filtered = menuItems.filter(item => {
      // If no pageId specified, show by default
      if (!item.pageId) return true

      // Check if user has direct permission for this page
      if (canAccessPage(item.pageId)) return true

      // If item has submenu, check if user has access to ANY child page
      // This ensures parent menus are visible if user has child permissions
      if (item.submenu && item.submenu.length > 0) {
        return item.submenu.some(subItem =>
          subItem.pageId ? canAccessPage(subItem.pageId) : false
        )
      }

      return false
    })

    console.log('✅ [NAVIGATION] Filtered menu items:', filtered.map(i => i.title))
    return filtered
  }, [canAccessPage, permissionsLoading])

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
        <div className="p-4">Loading...</div>
      </div>
    )
  }

  return (
    <div
      ref={navRef}
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card text-foreground transition-all duration-300',
        'flex-shrink-0', // Prevent sidebar from shrinking
        'relative z-10', // Ensure sidebar is above other content
        isCollapsed ? 'w-16' : 'w-64'
      )}
      style={{
        minWidth: isCollapsed ? '64px' : '256px',
        maxWidth: isCollapsed ? '64px' : '256px',
      }}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-end px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const newState = !isCollapsed
            setIsCollapsed(newState)
            // Save preference to localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('sidebar-collapsed', String(newState))
            }
          }}
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
        {permissionsLoading ? (
          <div className="flex items-center justify-center py-8">
            {isCollapsed ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs text-muted-foreground">A carregar...</span>
              </div>
            )}
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            {isCollapsed ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-5 w-5 rounded-full bg-muted" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Sem permissões</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="text-xs text-muted-foreground text-center px-2">Sem permissões disponíveis</span>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredMenuItems.map((item) => {
            if (item.submenu) {
              const isOpen = openSubmenus.includes(item.title) || hasActiveSubmenu(item.submenu)
              
              return (
                <li key={item.title}>
                  <Collapsible open={isOpen} onOpenChange={() => handleSubmenuClick(item.title)}>
                    {isCollapsed ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                'hover:bg-accent hover:text-accent-foreground',
                                hasActiveSubmenu(item.submenu) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                                'justify-center'
                              )}
                            >
                              {item.icon}
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            'hover:bg-accent hover:text-accent-foreground',
                            hasActiveSubmenu(item.submenu) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {item.icon}
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </>
                        </button>
                      </CollapsibleTrigger>
                    )}
                    {!isCollapsed && (
                      <CollapsibleContent className="ml-6 mt-1 space-y-1">
                        {item.submenu.filter((subItem) => {
                          // If submenu item has pageId, check permission
                          if (subItem.pageId) {
                            return canAccessPage(subItem.pageId)
                          }
                          // Otherwise show by default
                          return true
                        }).map((subItem) => (
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
                {isCollapsed ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href!}
                          onClick={(e) => {
                            if (isCollapsed) {
                              e.preventDefault()
                              setIsCollapsed(false)
                              setTimeout(() => {
                                router.push(item.href!)
                              }, 100)
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive(item.href!)
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            'justify-center'
                          )}
                        >
                          {item.icon}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Link
                    href={item.href!}
                    onClick={(e) => {
                      if (isCollapsed) {
                        e.preventDefault()
                        setIsCollapsed(false)
                        setTimeout(() => {
                          router.push(item.href!)
                        }, 100)
                      }
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href!)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                )}
              </li>
            )
          })}
          </ul>
        )}
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
            {isCollapsed ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleLogout}
                      className={cn(
                        'w-full justify-start gap-3 text-destructive hover:bg-destructive/10',
                        'justify-center'
                      )}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="ghost"
                size={'default'}
                onClick={handleLogout}
                className={cn(
                  'w-full justify-start gap-3 text-destructive hover:bg-destructive/10'
                )}
              >
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </Button>
            )}
          </div>
        ) : (
          isCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size={'icon'}
                    onClick={() => router.push('/login')}
                    className={cn(
                      'w-full justify-start gap-3',
                      'justify-center'
                    )}
                  >
                    <LogIn className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Entrar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size={'default'}
              onClick={() => router.push('/login')}
              className={cn(
                'w-full justify-start gap-3'
              )}
            >
              <LogIn className="h-5 w-5" />
              <span>Entrar</span>
            </Button>
          )
        )}

        {/* Theme Toggle */}
        {mounted && (
          isCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size={'icon'}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={cn(
                      'w-full justify-start gap-3',
                      'justify-center'
                    )}
                  >
                    {theme === 'dark' ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size={'default'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'w-full justify-start gap-3'
              )}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            </Button>
          )
        )}
      </div>
    </div>
  )
}


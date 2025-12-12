"use client";

import { useState, useEffect, useMemo, useRef, memo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
  User,
  Loader2,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createBrowserClient } from "@/utils/supabase";
import { usePermissions } from "@/providers/PermissionsProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SubMenuItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
  pageId?: string; // For permission checking
}

interface MenuItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  submenu?: SubMenuItem[];
  pageId?: string; // For permission checking
}

const menuItems: MenuItem[] = [
  {
    title: "Painel de Controlo",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    pageId: "dashboard",
  },
  {
    title: "Fluxo de Design",
    href: "/designer-flow",
    icon: <Palette className="h-5 w-5" />,
    pageId: "designer-flow",
  },
  {
    title: "Produção",
    icon: <Factory className="h-5 w-5" />,
    pageId: "producao",
    submenu: [
      {
        title: "Gestão",
        href: "/producao",
        icon: <Factory className="h-4 w-4" />,
        pageId: "producao",
      },
      {
        title: "Operações",
        href: "/producao/operacoes",
        icon: <Settings className="h-4 w-4" />,
        pageId: "producao/operacoes",
      },
    ],
  },
  {
    title: "Stocks",
    icon: <Warehouse className="h-5 w-5" />,
    pageId: "stocks",
    submenu: [
      {
        title: "Gestão de Stocks",
        href: "/stocks/gestao",
        icon: <Warehouse className="h-4 w-4" />,
        pageId: "stocks/gestao",
      },
      {
        title: "Gestão de Materiais",
        href: "/definicoes/materiais",
        icon: <Package className="h-4 w-4" />,
        pageId: "definicoes/materiais",
      },
      {
        title: "Gestão de Máquinas",
        href: "/definicoes/maquinas",
        icon: <Factory className="h-4 w-4" />,
        pageId: "definicoes/maquinas",
      },
    ],
  },
  {
    title: "Gestão",
    icon: <FileText className="h-5 w-5" />,
    pageId: "gestao",
    submenu: [
      {
        title: "Faturação",
        href: "/gestao/faturacao",
        icon: <DollarSign className="h-4 w-4" />,
        pageId: "gestao/faturacao",
      },
      {
        title: "Análise Financeira",
        href: "/gestao/analise-financeira",
        icon: <TrendingUp className="h-4 w-4" />,
        pageId: "gestao/analise-financeira",
      },
    ],
  },
  {
    title: "Férias e Ausências",
    href: "/ferias",
    icon: <CalendarDays className="h-5 w-5" />,
    pageId: "ferias",
  },
  {
    title: "Definições",
    icon: <Settings className="h-5 w-5" />,
    pageId: "definicoes",
    submenu: [
      {
        title: "Gestão de Utilizadores",
        href: "/definicoes/utilizadores",
        icon: <Users className="h-4 w-4" />,
        pageId: "definicoes/utilizadores",
      },
      {
        title: "Gestão de Funções",
        href: "/definicoes/funcoes",
        icon: <Settings className="h-4 w-4" />,
        pageId: "definicoes/funcoes",
      },
      {
        title: "Gestão de Feriados",
        href: "/definicoes/feriados",
        icon: <FileText className="h-4 w-4" />,
        pageId: "definicoes/feriados",
      },
      {
        title: "Gestão de Armazéns",
        href: "/definicoes/armazens",
        icon: <Warehouse className="h-4 w-4" />,
        pageId: "definicoes/armazens",
      },
      {
        title: "Gestão de Complexidade",
        href: "/definicoes/complexidade",
        icon: <Settings className="h-4 w-4" />,
        pageId: "definicoes/complexidade",
      },
      {
        title: "Gestão de Transportadoras",
        href: "/definicoes/transportadoras",
        icon: <Users className="h-4 w-4" />,
        pageId: "definicoes/transportadoras",
      },
      {
        title: "Mapeamento de Utilizadores",
        href: "/definicoes/user-name-mapping",
        icon: <Users className="h-4 w-4" />,
        pageId: "definicoes/user-name-mapping",
      },
    ],
  },
];

const SidebarSpinner = () => (
  <svg
    className="imx-spinner h-5 w-5 animate-spin"
    viewBox="0 0 24 24"
    role="presentation"
  >
    <circle cx="12" cy="12" r="9" strokeDasharray="60" strokeDashoffset="20" />
  </svg>
);

const NavigationInternal = () => {
  const navRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { canAccessPage, loading: permissionsLoading } = usePermissions();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Load localStorage preference after mount to avoid hydration mismatch
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    }

    // Check if user is logged in
    const checkUser = async () => {
      try {
        const { createBrowserClient } = await import("@/utils/supabase");
        const supabase = createBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };

    checkUser();
  }, []);

  // Close drawer when clicking outside
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (isCollapsed) return;
      const target = event.target as Node | null;
      const container = navRef.current;
      if (container && target && !container.contains(target)) {
        setIsCollapsed(true);
        setOpenSubmenus([]);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isCollapsed]);

  // Close drawer on mouse leave - always close when mouse exits
  useEffect(() => {
    const container = navRef.current;
    if (!container) return;

    const handleMouseLeave = () => {
      // Always close when mouse leaves
      setIsCollapsed(true);
      setOpenSubmenus([]);
    };

    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(
      (prev) =>
        prev.includes(title)
          ? [] // Close all dropdowns when clicking the open one
          : [title], // Open only this dropdown, closing all others
    );
  };

  const handleSubmenuClick = (title: string) => {
    // If sidebar is collapsed, expand it first
    if (isCollapsed) {
      setIsCollapsed(false);
      // Also open the submenu (only this one)
      setOpenSubmenus([title]);
    } else {
      // If already expanded, just toggle the submenu
      toggleSubmenu(title);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // Clear localStorage first to prevent auth state listeners from refetching
      if (typeof window !== "undefined") {
        const keys = Object.keys(window.localStorage);
        keys.forEach((key) => {
          if (
            key.startsWith("sb-") ||
            key.includes("supabase") ||
            key === "rememberedEmail" ||
            key === "rememberMe"
          ) {
            window.localStorage.removeItem(key);
          }
        });
      }

      setUser(null);

      // Sign out from server (clears cookie-based session) - do this first
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
      } catch (serverError) {
        // Ignore server logout errors - cookies will be cleared anyway
      }

      const supabase = createBrowserClient();

      // Sign out from browser client (clears any remaining session data)
      await supabase.auth.signOut({ scope: "local" });

      // Small delay to let any auth state changes settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Hard redirect to login page (forces full page reload to clear all state)
      window.location.href = "/login";
    } catch (err) {
      console.error("[Logout] Unexpected error:", err);
      // Even if logout fails, redirect to login
      window.location.href = "/login";
    }
  };

  const isActive = (href: string) => pathname === href;
  const hasActiveSubmenu = (submenu: SubMenuItem[]) =>
    submenu.some((item) => pathname === item.href);

  // Filter menu items based on permissions
  const filteredMenuItems = useMemo(() => {
    // If still loading, show Dashboard only to prevent blank sidebar
    if (permissionsLoading) {
      return menuItems.filter((item) => item.pageId === "dashboard");
    }

    // Filter based on actual permissions (empty permissions = only show items without pageId requirement)
    const filtered = menuItems.filter((item) => {
      // If no pageId specified, show by default
      if (!item.pageId) return true;

      // Check if user can access linked page path
      if (item.href && canAccessPage(item.href)) return true;

      // If item has submenu, check if user has access to ANY child page by href
      if (item.submenu && item.submenu.length > 0) {
        return item.submenu.some((subItem) =>
          subItem.href ? canAccessPage(subItem.href) : false,
        );
      }

      return false;
    });

    return filtered;
  }, [canAccessPage, permissionsLoading]);

  // Prevent hydration mismatch by not rendering until mounted
  // Show a minimal skeleton that matches the collapsed sidebar width
  if (!mounted) {
    return (
      <div
        className="flex h-screen w-16 flex-col imx-border-r bg-background flex-shrink-0"
        style={{ minWidth: "64px", maxWidth: "64px" }}
      >
        <div className="flex h-16 items-center justify-center">
          <SidebarSpinner />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={navRef}
      className={cn(
        "flex h-screen flex-col imx-border-r  bg-background text-foreground transition-all duration-300",
        "flex-shrink-0", // Prevent sidebar from shrinking
        "relative z-10", // Ensure sidebar is above other content
        isCollapsed ? "w-16" : "w-64",
      )}
      style={{
        minWidth: isCollapsed ? "64px" : "256px",
        maxWidth: isCollapsed ? "64px" : "256px",
      }}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-end px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const newState = !isCollapsed;
            setIsCollapsed(newState);
            // Save preference to localStorage
            if (typeof window !== "undefined") {
              localStorage.setItem("sidebar-collapsed", String(newState));
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
              <SidebarSpinner />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <SidebarSpinner />
                <span className="text-xs text-muted-foreground">
                  A carregar...
                </span>
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
              <span className="text-xs text-muted-foreground text-center px-2">
                Sem permissões disponíveis
              </span>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredMenuItems.map((item) => {
              if (item.submenu) {
                const isOpen =
                  openSubmenus.includes(item.title) ||
                  hasActiveSubmenu(item.submenu);

                return (
                  <li key={item.title}>
                    <Collapsible
                      open={isOpen}
                      onOpenChange={() => handleSubmenuClick(item.title)}
                    >
                      {isCollapsed ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CollapsibleTrigger
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                  hasActiveSubmenu(item.submenu)
                                    ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                  "justify-center",
                                )}
                              >
                                {item.icon}
                              </CollapsibleTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {item.title}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <CollapsibleTrigger asChild>
                          <button
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              hasActiveSubmenu(item.submenu)
                                ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            )}
                          >
                            {item.icon}
                            <>
                              <span className="flex-1 text-left">
                                {item.title}
                              </span>
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
                          {item.submenu
                            .filter((subItem) => {
                              // If submenu item has pageId, check permission
                              if (subItem.pageId) {
                                return canAccessPage(subItem.pageId);
                              }
                              // Otherwise show by default
                              return true;
                            })
                            .map((subItem) => (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                className={cn(
                                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                                  isActive(subItem.href)
                                    ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
                );
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
                                e.preventDefault();
                                setIsCollapsed(false);
                                setTimeout(() => {
                                  router.push(item.href!);
                                }, 100);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              isActive(item.href!)
                                ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              "justify-center",
                            )}
                          >
                            {item.icon}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Link
                      href={item.href!}
                      onClick={(e) => {
                        if (isCollapsed) {
                          e.preventDefault();
                          setIsCollapsed(false);
                          setTimeout(() => {
                            router.push(item.href!);
                          }, 100);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive(item.href!)
                          ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Footer - Auth & Theme */}
      <div className="p-2 space-y-1">
        {/* User Info / Login Button */}
        {user ? (
          <div
            className={cn("flex flex-col gap-1", isCollapsed && "items-center")}
          >
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
                      disabled={isLoggingOut}
                      className={cn(
                        "w-full justify-start gap-3 text-destructive hover:bg-destructive/10",
                        "justify-center",
                      )}
                    >
                      {isLoggingOut ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <LogOut className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="ghost"
                size={"default"}
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={cn(
                  "w-full justify-start gap-3 text-destructive hover:bg-destructive/10",
                )}
              >
                {isLoggingOut ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
                <span>{isLoggingOut ? "A sair..." : "Sair"}</span>
              </Button>
            )}
          </div>
        ) : isCollapsed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={"icon"}
                  onClick={() => router.push("/login")}
                  className={cn("w-full justify-start gap-3", "justify-center")}
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
            size={"default"}
            onClick={() => router.push("/login")}
            className={cn("w-full justify-start gap-3")}
          >
            <LogIn className="h-5 w-5" />
            <span>Entrar</span>
          </Button>
        )}

        {/* Theme Toggle */}
        {mounted &&
          (isCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size={"icon"}
                    onClick={() =>
                      setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className={cn(
                      "w-full justify-start gap-3",
                      "justify-center",
                    )}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size={"default"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={cn("w-full justify-start gap-3")}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
            </Button>
          ))}
      </div>
    </div>
  );
};

export const Navigation = memo(NavigationInternal);

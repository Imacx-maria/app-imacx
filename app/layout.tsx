import type { Metadata } from "next";
import { cookies } from "next/headers";

// Force dynamic rendering - this layout uses cookies() for auth/permissions
export const dynamic = "force-dynamic";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { PermissionsProvider } from "@/providers/PermissionsProvider";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { createServerClient } from "@/utils/supabase";
import type { PermissionId, RoleId } from "@/types/permissions";
import { readPermissionsCookie } from "@/utils/permissionsCookie";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "IMACX - Production Management",
  description: "Manufacturing and production management system",
  icons: {
    icon: [
      { url: "/favico-16px.jpg", sizes: "16x16", type: "image/jpeg" },
      { url: "/favico-32px.jpg", sizes: "32x32", type: "image/jpeg" },
    ],
  },
};

type InitialPermissions = {
  roles: RoleId[];
  pagePermissions: PermissionId[];
  actionPermissions: PermissionId[];
  userId?: string | null;
};

const DEFAULT_PERMISSIONS: InitialPermissions = {
  roles: [],
  pagePermissions: ["page:dashboard"],
  actionPermissions: [],
};

async function getInitialPermissions(): Promise<InitialPermissions> {
  // 1) Try signed cookie first (zero DB round-trip if valid)
  try {
    const cookiePerms = readPermissionsCookie();
    if (cookiePerms) {
      return {
        roles: cookiePerms.roles,
        pagePermissions: cookiePerms.pagePermissions,
        actionPermissions: cookiePerms.actionPermissions,
        userId: cookiePerms.userId,
      };
    }
  } catch (err) {
    console.warn("[layout] Permissions cookie unavailable:", err);
  }

  try {
    const supabase = await createServerClient(cookies());

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Note: Cannot modify cookies in Server Components
      // Cookie clearing will be handled by middleware or route handlers
      return DEFAULT_PERMISSIONS;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_id, roles!inner(page_permissions)")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      // Note: Cannot modify cookies in Server Components
      return { ...DEFAULT_PERMISSIONS, userId: user.id };
    }

    const roleId = profile?.role_id ?? null;
    const roleData = profile?.roles as { page_permissions?: string[] } | null;
    const rawPagePerms = Array.isArray(roleData?.page_permissions)
      ? roleData?.page_permissions
      : [];

    const result: InitialPermissions = {
      roles: roleId ? ([roleId] as RoleId[]) : [],
      pagePermissions: rawPagePerms.map((p) => `page:${p}` as PermissionId),
      actionPermissions: [],
      userId: user.id,
    };

    // Note: Cannot modify cookies in Server Components
    // Cookie will be set by middleware or route handlers if needed
    return result;
  } catch (error) {
    console.error("[layout] Failed to load initial permissions:", error);
    return DEFAULT_PERMISSIONS;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialPermissions = await getInitialPermissions();

  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        {/* Preconnect to Supabase for faster API calls */}
        <link
          rel="preconnect"
          href="https://bnfixjkjrbfalgcqhzof.supabase.co"
        />
        <link
          rel="preload"
          href="/fonts/GeistMono%5Bwght%5D.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <PermissionsProvider initialPermissions={initialPermissions}>
            <PerformanceMonitor />
            <LayoutWrapper>{children}</LayoutWrapper>
          </PermissionsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

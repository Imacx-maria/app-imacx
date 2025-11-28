"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { ROLES, type RoleId, type PermissionId } from "@/types/permissions";

interface PermissionsContextType {
  roles: RoleId[];
  pagePermissions: PermissionId[];
  actionPermissions: PermissionId[];
  loading: boolean;
  hasRole: (role: RoleId) => boolean;
  hasAnyRole: (roles: RoleId[]) => boolean;
  hasPermission: (perm: PermissionId) => boolean;
  hasAllPermissions: (perms: PermissionId[]) => boolean;
  canAccessPage: (page: string) => boolean;
}

type InitialPermissions = {
  roles: RoleId[];
  pagePermissions: PermissionId[];
  actionPermissions: PermissionId[];
  userId?: string | null;
};

const PermissionsContext = createContext<PermissionsContextType>({
  roles: [],
  pagePermissions: [],
  actionPermissions: [],
  loading: true,
  hasRole: () => false,
  hasAnyRole: () => false,
  hasPermission: () => false,
  hasAllPermissions: () => false,
  canAccessPage: () => false,
});

export const usePermissions = () => useContext(PermissionsContext);

// In-memory cache for permissions (shared across all provider instances)
let permissionsCache: {
  data: {
    roles: RoleId[];
    pagePermissions: PermissionId[];
    actionPermissions: PermissionId[];
  } | null;
  timestamp: number;
  userId: string | null;
} = {
  data: null,
  timestamp: 0,
  userId: null,
};

const CACHE_DURATION = 30000; // 30 seconds cache

export function PermissionsProvider({
  children,
  initialPermissions,
}: {
  children: React.ReactNode;
  initialPermissions?: InitialPermissions;
}) {
  const hasInitial = Boolean(initialPermissions);

  const [roles, setRoles] = useState<RoleId[]>(
    initialPermissions?.roles ?? [],
  );
  const [pagePermissions, setPagePermissions] = useState<PermissionId[]>(
    initialPermissions?.pagePermissions ?? [],
  );
  const [actionPermissions, setActionPermissions] = useState<PermissionId[]>(
    initialPermissions?.actionPermissions ?? [],
  );
  const [loading, setLoading] = useState(!hasInitial);

  useEffect(() => {
    const supabase = createBrowserClient();
    const abortController = new AbortController();
    let isSubscribed = true;

    // Seed cache from server-hydrated permissions to avoid a first client fetch
    if (hasInitial && initialPermissions) {
      permissionsCache = {
        data: {
          roles: initialPermissions.roles,
          pagePermissions: initialPermissions.pagePermissions,
          actionPermissions: initialPermissions.actionPermissions,
        },
        timestamp: Date.now(),
        userId: initialPermissions.userId ?? null,
      };
    }

    const fetchPermissions = async (reason: "init" | "auth-change" = "init") => {
      // Don't fetch if component is unmounting or navigating away
      if (!isSubscribed || abortController.signal.aborted) return;

      // If we were hydrated with initial permissions, skip the first fetch
      if (
        reason === "init" &&
        hasInitial &&
        permissionsCache.data &&
        permissionsCache.timestamp
      ) {
        setLoading(false);
        return;
      }

      // Check if there's a session first to avoid unnecessary requests
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setRoles([]);
        setPagePermissions([]);
        setActionPermissions([]);
        setLoading(false);
        permissionsCache = { data: null, timestamp: 0, userId: null };
        return;
      }

      const currentUserId = session.user.id;
      const now = Date.now();

      // Check cache - return cached data if still valid for same user
      if (
        permissionsCache.data &&
        permissionsCache.userId === currentUserId &&
        now - permissionsCache.timestamp < CACHE_DURATION
      ) {
        setRoles(permissionsCache.data.roles);
        setPagePermissions(permissionsCache.data.pagePermissions);
        setActionPermissions(permissionsCache.data.actionPermissions);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/permissions/me", {
          cache: "no-store",
          credentials: "same-origin",
          signal: abortController.signal,
        });

        // Check again before updating state
        if (!isSubscribed) return;

        // User is not authenticated (logged out) - this is expected
        if (res.status === 401) {
          setRoles([]);
          setPagePermissions([]);
          setActionPermissions([]);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          // Only log unexpected errors (not 401/403 which are normal during logout)
          if (res.status !== 403) {
            console.error(
              "[PermissionsProvider] Unexpected permissions error:",
              res.status,
            );
          }
          setRoles([]);
          setPagePermissions([]);
          setActionPermissions([]);
          setLoading(false);
          return;
        }

        const data = (await res.json()) as {
          roles?: RoleId[];
          pagePermissions?: PermissionId[];
          actionPermissions?: PermissionId[];
        };

        // Check once more before setting state
        if (!isSubscribed) return;

        const nextRoles = Array.isArray(data.roles) ? data.roles : [];
        const nextPagePerms = Array.isArray(data.pagePermissions)
          ? data.pagePermissions
          : [];
        const nextActionPerms = Array.isArray(data.actionPermissions)
          ? data.actionPermissions
          : [];

        const mappedRoles: RoleId[] = (nextRoles as string[]).includes(
          "7c53a7a2-ab07-4ba3-8c1a-7e8e215cadf0",
        )
          ? [ROLES.ADMIN]
          : (nextRoles as RoleId[]);

        setRoles(mappedRoles);
        setPagePermissions(nextPagePerms);
        setActionPermissions(nextActionPerms);

        // Update cache
        permissionsCache = {
          data: {
            roles: mappedRoles,
            pagePermissions: nextPagePerms,
            actionPermissions: nextActionPerms,
          },
          timestamp: Date.now(),
          userId: currentUserId,
        };
      } catch (e) {
        // Don't log errors if the request was aborted (component unmounted/logout)
        if (e instanceof DOMException && e.name === "AbortError") {
          // Silently ignore - this is expected during logout/navigation
          return;
        }

        // Network errors or fetch failures - suppress if likely due to logout/navigation
        if (
          e instanceof TypeError &&
          (e.message.includes("fetch") || e.message.includes("Failed to fetch"))
        ) {
          // Likely a navigation/abort during logout - don't log
          return;
        }

        // Only log truly unexpected errors
        if (isSubscribed) {
          console.error("[PermissionsProvider] Unexpected fetch error:", e);
        }

        if (isSubscribed) {
          setRoles([]);
          setPagePermissions([]);
          setActionPermissions([]);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchPermissions();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchPermissions("auth-change");
    });

    return () => {
      isSubscribed = false;
      abortController.abort();
      subscription.unsubscribe();
    };
  }, [hasInitial, initialPermissions]);

  const hasRole = (role: RoleId) => roles.includes(role);
  const hasAnyRole = (rs: RoleId[]) => rs.some((r) => roles.includes(r));
  const hasPermission = (perm: PermissionId) =>
    hasRole(ROLES.ADMIN) || actionPermissions.includes(perm);
  const hasAllPermissions = (perms: PermissionId[]) =>
    perms.every((p) => hasPermission(p));

  const canAccessPage = (path: string) => {
    if (hasRole(ROLES.ADMIN)) return true;
    const normalized = path.toLowerCase().replace(/^\//, ""); // Remove leading slash
    return pagePermissions.some((p) => {
      if (p === "page:*") return true;
      if (!p.startsWith("page:")) return false;
      const base = p.replace("page:", "").toLowerCase();
      return normalized === base || normalized.startsWith(base + "/");
    });
  };

  const value: PermissionsContextType = {
    roles,
    pagePermissions,
    actionPermissions,
    loading,
    hasRole,
    hasAnyRole,
    hasPermission,
    hasAllPermissions,
    canAccessPage,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

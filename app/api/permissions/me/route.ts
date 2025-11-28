import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/utils/supabase";
import type { PermissionId, RoleId } from "@/types/permissions";
import {
  setPermissionsCookie,
  clearPermissionsCookie,
} from "@/utils/permissionsCookie";

export const dynamic = "force-dynamic";

type PermissionsResponse = {
  roles?: string[];
  pagePermissions?: string[];
  actionPermissions?: string[];
  roleId?: string | null;
  permissions?: string[];
  shouldRetry?: boolean;
  reason?: string;
};

const json = (body: PermissionsResponse, init?: ResponseInit) =>
  NextResponse.json(body, init);

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    // SECURITY: Use getUser() instead of getSession() for server-side validation
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[API /permissions/me] Auth error:", authError.message);
      try {
        clearPermissionsCookie();
      } catch (err) {
        console.warn("[API /permissions/me] Clear permissions cookie failed:", err);
      }
      return NextResponse.json({ message: "auth-error" }, { status: 500 });
    }

    if (!user) {
      try {
        clearPermissionsCookie();
      } catch (err) {
        console.warn("[API /permissions/me] Clear permissions cookie failed:", err);
      }
      return NextResponse.json({ message: "no-session" }, { status: 401 });
    }

    // OPTIMIZED: Single query with join to get profile + role data
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_id, roles!inner(page_permissions)")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.warn(
        "[API /permissions/me] Profile lookup failed:",
        profileError,
      );
      try {
        clearPermissionsCookie();
      } catch (err) {
        console.warn("[API /permissions/me] Clear permissions cookie failed:", err);
      }
      return NextResponse.json({ message: "missing-profile" }, { status: 403 });
    }

    const roleId = profile?.role_id ?? null;

    if (!roleId) {
      console.warn(
        "[API /permissions/me] Profile found but role_id missing for user",
        user.id,
      );
      const response = json({
        roles: [],
        pagePermissions: ["page:dashboard"],
        actionPermissions: [],
        reason: "missing-role",
      });
      try {
        clearPermissionsCookie();
      } catch (err) {
        console.warn("[API /permissions/me] Clear permissions cookie failed:", err);
      }
      return response;
    }

    // Extract page permissions from joined role data
    const roleData = profile.roles as any;
    const pagePermissions = Array.isArray(roleData?.page_permissions)
      ? (roleData.page_permissions as string[])
      : [];

    if (pagePermissions.length === 0) {
      console.warn(
        "[API /permissions/me] Role has no page permissions configured",
        roleId,
      );
      const response = json({
        roles: [roleId],
        pagePermissions: ["page:dashboard"],
        actionPermissions: [],
        reason: "empty-permissions",
      });
      try {
        clearPermissionsCookie();
      } catch (err) {
        console.warn("[API /permissions/me] Clear permissions cookie failed:", err);
      }
      return response;
    }

    const typedRoles = [roleId] as RoleId[];
    const typedPagePermissions = pagePermissions.map(
      (p) => `page:${p}` as PermissionId
    );
    const typedActionPermissions: PermissionId[] = [];

    const result = {
      roles: typedRoles,
      pagePermissions: typedPagePermissions,
      actionPermissions: typedActionPermissions,
    };

    // Set signed cookie to avoid future DB hits within TTL
    try {
      setPermissionsCookie({
        roles: typedRoles,
        pagePermissions: typedPagePermissions,
        actionPermissions: typedActionPermissions,
        userId: user.id,
      });
    } catch (err) {
      console.warn("[API /permissions/me] Set permissions cookie failed:", err);
    }

    return json(result);
  } catch (error) {
    console.error("[API /permissions/me] Unexpected exception:", error);
    try {
      clearPermissionsCookie();
    } catch (err) {
      console.warn("[API /permissions/me] Clear permissions cookie failed:", err);
    }
    return NextResponse.json({ message: "unexpected-error" }, { status: 500 });
  }
}

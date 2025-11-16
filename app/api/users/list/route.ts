import { NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const ADMIN_ROLE_ID = "7c53a7a2-ab07-4ba3-8c1a-7e8e215cadf0";

export async function GET(request: Request) {
  try {
    console.log("📋 [API /users/list] Request received");

    // Verify the requesting user is an admin
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    // SECURITY: Use getUser() instead of getSession() for server-side validation
    // getSession() reads from cookies without server verification (insecure)
    // getUser() validates the session with Supabase Auth server (secure)
    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser();

    if (userAuthError || !user) {
      console.error(
        "❌ [API /users/list] Auth error:",
        userAuthError?.message || "No user",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔐 [API /users/list] User authenticated:", user.email);

    // Use admin client to check user role (bypass RLS)
    const adminClient = createAdminClient();

    // Check if user is admin using admin client
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error(
        "❌ [API /users/list] Error fetching profile:",
        profileError,
      );
      return NextResponse.json(
        { error: "User not allowed - Could not verify user role" },
        { status: 403 },
      );
    }

    console.log("👤 [API /users/list] User role_id:", profile?.role_id);
    console.log("🔑 [API /users/list] Expected admin role_id:", ADMIN_ROLE_ID);

    if (!profile || profile.role_id !== ADMIN_ROLE_ID) {
      console.error("❌ [API /users/list] User is not admin:", {
        userId: user.id,
        roleId: profile?.role_id,
        expected: ADMIN_ROLE_ID,
      });
      return NextResponse.json(
        { error: "User not allowed - Admin access required" },
        { status: 403 },
      );
    }

    console.log("✅ [API /users/list] Admin verified, fetching users...");

    // PERFORMANCE FIX: Use parallel queries with joins instead of N+1 pattern
    // Query 1: Fetch all profiles with their siglas in ONE query using join
    const { data: profiles, error: profilesError } = await adminClient.from(
      "profiles",
    ).select(`
        *,
        user_siglas (
          sigla
        )
      `);

    if (profilesError) {
      console.error(
        "❌ [API /users/list] Error fetching profiles:",
        profilesError,
      );
      throw profilesError;
    }

    console.log(
      "✅ [API /users/list] Fetched profiles with siglas:",
      profiles?.length || 0,
    );

    // Query 2: Fetch ALL auth users in ONE batch call (instead of N getUserById calls)
    const { data: authData, error: authError } =
      await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Adjust if you have more users
      });

    if (authError) {
      console.warn(
        "⚠️ [API /users/list] Could not fetch auth users, will use profile emails",
      );
    }

    console.log(
      "✅ [API /users/list] Fetched auth users:",
      authData?.users?.length || 0,
    );

    // Create lookup map for O(1) email retrieval
    const authEmailMap = new Map(
      (authData?.users || []).map((user) => [user.id, user.email]),
    );

    // Combine data in memory (no more database queries!)
    const combinedUsers = (profiles || []).map((profile: any) => {
      // Get siglas from the joined data
      const siglas = (profile.user_siglas || []).map((s: any) => s.sigla);

      // Get email from auth map with O(1) lookup
      const authEmail = authEmailMap.get(profile.user_id) || profile.email;

      return {
        id: profile.id,
        user_id: profile.user_id,
        auth_user_id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: authEmail,
        phone: profile.phone,
        notes: profile.notes,
        role_id: profile.role_id,
        departamento_id: profile.departamento_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        active: profile.active,
        siglas,
        has_profile: true,
      };
    });

    console.log(
      "✅ [API /users/list] Combined users prepared:",
      combinedUsers.length,
    );
    console.log(
      "🎯 [API /users/list] Performance: Reduced from N+1 queries to 2 total queries",
    );

    return NextResponse.json({
      users: combinedUsers,
      count: combinedUsers.length,
    });
  } catch (error: any) {
    console.error("💥 [API /users/list] Exception:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

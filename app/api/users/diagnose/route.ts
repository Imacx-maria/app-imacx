import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { createServerClient } from "@/utils/supabase";
import { cookies } from "next/headers";

/**
 * Diagnostic endpoint to find orphaned users and profiles
 *
 * GET /api/users/diagnose
 *
 * Returns:
 * - Orphaned auth users (users without profiles)
 * - Orphaned profiles (profiles without auth users)
 * - Duplicate emails
 */
export async function GET(request: Request) {
  try {
    // Verify the requesting user is authenticated and admin
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser();

    if (userAuthError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Get all auth users
    const { data: authData } = await adminClient.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    // Get all profiles
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, user_id, email, first_name, last_name");

    const allProfiles = profiles || [];

    // Find orphaned auth users (no profile)
    const orphanedAuthUsers = authUsers.filter(
      (authUser) => !allProfiles.some((profile) => profile.user_id === authUser.id)
    );

    // Find orphaned profiles (no auth user)
    const orphanedProfiles = allProfiles.filter(
      (profile) => !authUsers.some((authUser) => authUser.id === profile.user_id)
    );

    // Find duplicate emails in profiles
    const emailCounts = allProfiles.reduce((acc, profile) => {
      if (profile.email) {
        acc[profile.email.toLowerCase()] = (acc[profile.email.toLowerCase()] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const duplicateEmails = Object.entries(emailCounts)
      .filter(([_, count]) => count > 1)
      .map(([email, count]) => ({
        email,
        count,
        profiles: allProfiles.filter(
          (p) => p.email?.toLowerCase() === email
        ),
      }));

    // Summary
    const summary = {
      total_auth_users: authUsers.length,
      total_profiles: allProfiles.length,
      orphaned_auth_users_count: orphanedAuthUsers.length,
      orphaned_profiles_count: orphanedProfiles.length,
      duplicate_emails_count: duplicateEmails.length,
      healthy: orphanedAuthUsers.length === 0 &&
               orphanedProfiles.length === 0 &&
               duplicateEmails.length === 0,
    };

    return NextResponse.json({
      summary,
      orphaned_auth_users: orphanedAuthUsers.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      })),
      orphaned_profiles: orphanedProfiles.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        email: p.email,
        name: `${p.first_name} ${p.last_name}`,
      })),
      duplicate_emails: duplicateEmails,
    });
  } catch (error: any) {
    console.error("Diagnostic error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Clean up orphaned records
 *
 * DELETE /api/users/diagnose?email=user@example.com
 *
 * Deletes orphaned profiles with the specified email
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    // Verify the requesting user is authenticated
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser();

    if (userAuthError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Find profiles with this email
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, user_id, email, first_name, last_name")
      .eq("email", email.toLowerCase().trim());

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: "No profiles found with this email" },
        { status: 404 }
      );
    }

    // Check which profiles are orphaned (no auth user)
    const { data: authData } = await adminClient.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    const orphanedProfiles = profiles.filter(
      (profile) => !authUsers.some((authUser) => authUser.id === profile.user_id)
    );

    if (orphanedProfiles.length === 0) {
      return NextResponse.json(
        {
          error: "No orphaned profiles found with this email",
          info: "All profiles have valid auth users"
        },
        { status: 400 }
      );
    }

    // Delete orphaned profiles
    const deletedIds = [];
    for (const profile of orphanedProfiles) {
      const { error } = await adminClient
        .from("profiles")
        .delete()
        .eq("id", profile.id);

      if (!error) {
        deletedIds.push(profile.id);
        console.log(`🗑️ Deleted orphaned profile: ${profile.email} (${profile.id})`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedIds.length} orphaned profile(s)`,
      deleted_profiles: orphanedProfiles.map((p) => ({
        id: p.id,
        email: p.email,
        name: `${p.first_name} ${p.last_name}`,
      })),
    });
  } catch (error: any) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { createServerClient } from "@/utils/supabase";
import { cookies } from "next/headers";

// Update user (profile and optionally auth)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify the requesting user is authenticated
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);

    // SECURITY: Use getUser() instead of getSession() for server-side validation
    // getSession() reads from cookies without server verification (insecure)
    // getUser() validates the session with Supabase Auth server (secure)
    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser();

    if (userAuthError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const {
      email,
      password,
      first_name,
      last_name,
      role_id,
      phone,
      notes,
      active,
      departamento_id,
      siglas,
    } = body;

    // Create admin client
    const adminClient = createAdminClient();

    // Check if auth user exists
    const { data: authUserCheck, error: authCheckError } =
      await adminClient.auth.admin.getUserById(userId);
    const authUserExists = !!authUserCheck?.user && !authCheckError;

    // Update password if provided and auth user exists
    if (password && authUserExists) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        { password },
      );

      if (authError) {
        console.error("Auth update error:", authError);
        return NextResponse.json(
          { error: `Failed to update password: ${authError.message}` },
          { status: 400 },
        );
      }
    } else if (password && !authUserExists) {
      console.warn(
        `⚠️ Cannot update password - auth user ${userId} not found. Profile will be updated without password change.`,
      );
    }

    // Update profile
    const updateProfile: any = {
      updated_at: new Date().toISOString(),
    };

    if (email !== undefined) updateProfile.email = email;
    if (first_name !== undefined) updateProfile.first_name = first_name;
    if (last_name !== undefined) updateProfile.last_name = last_name;
    if (role_id !== undefined) updateProfile.role_id = role_id;
    if (phone !== undefined) updateProfile.phone = phone;
    if (notes !== undefined) updateProfile.notes = notes;
    if (active !== undefined) updateProfile.active = active;
    if (departamento_id !== undefined) {
      updateProfile.departamento_id = departamento_id || null;
      console.log(
        "🏢 [UPDATE USER] Updating departamento_id:",
        departamento_id || "NULL",
      );
    }

    const { data: updatedProfile, error: profileError } = await adminClient
      .from("profiles")
      .update(updateProfile)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (profileError) {
      console.error("Profile update error:", profileError);
      return NextResponse.json(
        { error: `Failed to update profile: ${profileError.message}` },
        { status: 500 },
      );
    }

    // Update siglas if provided
    if (siglas !== undefined && Array.isArray(siglas) && updatedProfile) {
      console.log("🏷️ [UPDATE USER] Updating siglas:", siglas);

      // Delete existing siglas
      const { error: deleteError } = await adminClient
        .from("user_siglas")
        .delete()
        .eq("profile_id", updatedProfile.id);

      if (deleteError) {
        console.error(
          "⚠️ [UPDATE USER] Error deleting old siglas:",
          deleteError,
        );
      }

      // Insert new siglas
      if (siglas.length > 0) {
        const siglasToInsert = siglas.map((sigla: string) => ({
          profile_id: updatedProfile.id,
          sigla: sigla.trim().toUpperCase(),
        }));

        const { error: siglasError } = await adminClient
          .from("user_siglas")
          .insert(siglasToInsert);

        if (siglasError) {
          console.error("⚠️ [UPDATE USER] Error adding siglas:", siglasError);
        } else {
          console.log("✅ [UPDATE USER] Siglas updated successfully");
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      warnings: authUserExists
        ? []
        : [
            "Auth user not found - password cannot be changed. Profile updated successfully.",
          ],
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// Delete user (both auth and profile)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify the requesting user is authenticated
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);

    // SECURITY: Use getUser() instead of getSession() for server-side validation
    // getSession() reads from cookies without server verification (insecure)
    // getUser() validates the session with Supabase Auth server (secure)
    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser();

    if (userAuthError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Prevent self-deletion
    if (user.id === userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    // Create admin client
    const adminClient = createAdminClient();

    // Delete profile first (will cascade due to FK)
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    if (profileError) {
      console.error("Profile delete error:", profileError);
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileError.message}` },
        { status: 500 },
      );
    }

    // Delete auth user
    const { error: authError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth delete error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

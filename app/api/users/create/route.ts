import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { createServerClient } from "@/utils/supabase";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
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

    // Get request body
    const body = await request.json();
    const {
      email,
      password,
      first_name,
      last_name,
      role_id,
      phone,
      notes,
      departamento_id,
      siglas,
    } = body;

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role_id) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: email, password, first_name, last_name, role_id",
        },
        { status: 400 },
      );
    }

    // Create admin client
    const adminClient = createAdminClient();

    // Check if email already exists in auth.users
    const { data: existingAuthUsers } =
      await adminClient.auth.admin.listUsers();
    const authUserWithEmail = existingAuthUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim(),
    );

    if (authUserWithEmail) {
      console.error("❌ [CREATE USER] Auth user already exists:", email);
      return NextResponse.json(
        {
          error: `Já existe um utilizador autenticado com o email ${email}`,
          details: "Este email já está registado no sistema de autenticação.",
        },
        { status: 409 },
      );
    }

    // Check if profile already exists with this email
    // IMPORTANT: Use ilike() because the UNIQUE constraint uses LOWER(email)
    const { data: existingProfiles } = await adminClient
      .from("profiles")
      .select("id, email, user_id")
      .ilike("email", email.trim());

    if (existingProfiles && existingProfiles.length > 0) {
      const existingProfile = existingProfiles[0];
      console.warn("⚠️ [CREATE USER] Profile already exists:", {
        email,
        existing_email: existingProfile.email,
        profile_id: existingProfile.id,
        user_id: existingProfile.user_id,
      });

      // Check if it's an orphaned profile (no auth user)
      const { data: authUser } = await adminClient.auth.admin.getUserById(
        existingProfile.user_id,
      );

      if (!authUser?.user) {
        console.log(
          "🗑️ [CREATE USER] Found orphaned profile, auto-cleaning...",
        );

        // Delete the orphaned profile
        const { error: deleteError } = await adminClient
          .from("profiles")
          .delete()
          .eq("id", existingProfile.id);

        if (deleteError) {
          console.error(
            "❌ [CREATE USER] Failed to delete orphaned profile:",
            deleteError,
          );
          return NextResponse.json(
            {
              error: `Existe um perfil órfão com o email ${email}`,
              details:
                "Não foi possível eliminar automaticamente. Contacte o administrador.",
              profile_id: existingProfile.id,
            },
            { status: 409 },
          );
        }

        console.log(
          "✅ [CREATE USER] Orphaned profile deleted, proceeding with creation...",
        );
        // Continue with user creation (don't return, let it proceed)
      } else {
        // Profile has a valid auth user
        console.error("❌ [CREATE USER] Profile belongs to an active user");
        return NextResponse.json(
          {
            error: `Já existe um utilizador ativo com o email ${email}`,
            details: "Este email pertence a um utilizador existente.",
          },
          { status: 409 },
        );
      }
    }

    // Create user in Supabase Auth (without email confirmation)
    console.log("🔐 [CREATE USER] Creating auth user for:", email);
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Skip email confirmation
        user_metadata: {
          first_name,
          last_name,
        },
      });

    if (authError) {
      console.error("❌ [CREATE USER] Auth error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      console.error("❌ [CREATE USER] No user returned from auth");
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    console.log("✅ [CREATE USER] Auth user created:", authData.user.id);

    // Create profile explicitly (don't rely on trigger)
    // This is more robust and ensures profile exists immediately
    console.log(
      "📝 [CREATE USER] Creating profile for user_id:",
      authData.user.id,
    );
    const { data: profile, error: profileCreateError } = await adminClient
      .from("profiles")
      .insert({
        user_id: authData.user.id,
        email: email.toLowerCase().trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        role_id: role_id,
        phone: phone || null,
        notes: notes || null,
        departamento_id: departamento_id || null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileCreateError || !profile) {
      console.error(
        "❌ [CREATE USER] Profile create error:",
        profileCreateError,
      );

      // Check if it's a duplicate email error
      const isDuplicateEmail =
        profileCreateError?.message?.includes("profiles_email_unique") ||
        profileCreateError?.code === "23505";

      // Clean up auth user since profile creation failed
      console.log("🧹 [CREATE USER] Cleaning up auth user:", authData.user.id);
      await adminClient.auth.admin.deleteUser(authData.user.id);

      if (isDuplicateEmail) {
        return NextResponse.json(
          {
            error: `O email ${email} já existe na base de dados`,
            details:
              "Existe um perfil órfão com este email. Contacte o administrador para resolver.",
            technicalDetails: profileCreateError?.message,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: `Falha ao criar perfil: ${profileCreateError?.message || "Erro desconhecido"}`,
          details: profileCreateError,
        },
        { status: 500 },
      );
    }

    console.log("✅ [CREATE USER] Profile created:", profile.id);

    // Insert siglas if provided
    if (siglas && Array.isArray(siglas) && siglas.length > 0) {
      console.log("🏷️ [CREATE USER] Adding siglas:", siglas);
      const siglasToInsert = siglas.map((sigla: string) => ({
        profile_id: profile.id,
        sigla: sigla.trim().toUpperCase(),
      }));

      const { error: siglasError } = await adminClient
        .from("user_siglas")
        .insert(siglasToInsert);

      if (siglasError) {
        console.error("⚠️ [CREATE USER] Error adding siglas:", siglasError);
        // Don't fail the entire request, just log the warning
      } else {
        console.log("✅ [CREATE USER] Siglas added successfully");
      }
    }

    console.log("✅ [CREATE USER] User creation complete:", {
      auth_user_id: authData.user.id,
      profile_id: profile.id,
      email: authData.user.email,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

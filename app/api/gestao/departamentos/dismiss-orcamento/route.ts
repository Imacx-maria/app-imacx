import { createServerClient } from "@/utils/supabase";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { orcamento_number } = body;

    if (!orcamento_number) {
      return NextResponse.json(
        { error: "orcamento_number is required" },
        { status: 400 },
      );
    }

    // Insert into orcamentos_dismissed with conflict handling
    const { data, error } = await supabase
      .from("orcamentos_dismissed")
      .insert({
        orcamento_number: orcamento_number,
        dismissed_by: user.email || user.id,
        dismissed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Check if it's a unique constraint violation (already dismissed)
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "Orçamento already dismissed", dismissed: true },
          { status: 200 },
        );
      }

      console.error("Error dismissing orçamento:", error);
      return NextResponse.json(
        { error: "Failed to dismiss orçamento", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Orçamento dismissed successfully",
        dismissed: true,
        data,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error in dismiss-orcamento:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

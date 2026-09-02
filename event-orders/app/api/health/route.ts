import { getSupabaseClient } from "@/libs/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("products").select("id").limit(1);

    if (error) throw error;

    return Response.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);

    return Response.json({ status: "error", database: "unavailable" }, { status: 500 });
  }
}

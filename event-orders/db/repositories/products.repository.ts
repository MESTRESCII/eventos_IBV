import { getSupabaseClient } from "@/libs/supabase";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function findActiveProducts(): Promise<Product[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) throw error;

  return data ?? [];
}

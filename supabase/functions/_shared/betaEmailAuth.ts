// Validates the caller is Lee. Returns the user email or throws Response.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LEE_EMAILS = new Set([
  "lee@survivestudios.com",
  "lee@surviveaccounting.com",
]);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function requireLee(req: Request): Promise<{ email: string; userId: string }> {
  const auth = req.headers.get("Authorization");
  if (!auth) throw forbidden("Missing Authorization");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw forbidden("Invalid session");
  const email = (data.user.email || "").toLowerCase();
  if (!LEE_EMAILS.has(email)) throw forbidden("Admin only");
  return { email, userId: data.user.id };
}

function forbidden(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

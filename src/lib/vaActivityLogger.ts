import { supabase } from "@/integrations/supabase/client";

/**
 * Log a VA activity event. Fire-and-forget — never blocks UI.
 */
export async function logVaActivity(params: {
  userId: string;
  chapterId?: string;
  actionType: string;
  assetId?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await supabase.from("va_activity_log").insert({
      user_id: params.userId,
      chapter_id: params.chapterId || null,
      action_type: params.actionType,
      asset_id: params.assetId || null,
      payload_json: params.payload || {},
    } as any);

    // Update last_action_at (and first_action_at if null)
    const now = new Date().toISOString();
    await supabase
      .from("va_accounts")
      .update({ last_action_at: now } as any)
      .eq("user_id", params.userId);

    // Set first_action_at if not yet set
    await supabase
      .from("va_accounts")
      .update({ first_action_at: now } as any)
      .eq("user_id", params.userId)
      .is("first_action_at", null);
  } catch {
    // Silent — never block production flow
  }
}

/**
 * Record first login timestamp for a VA account.
 */
export async function recordVaLogin(userId: string) {
  try {
    const now = new Date().toISOString();
    await supabase
      .from("va_accounts")
      .update({ first_login_at: now } as any)
      .eq("user_id", userId)
      .is("first_login_at", null);
  } catch {
    // Silent
  }
}

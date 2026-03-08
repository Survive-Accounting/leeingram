import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface VaAccount {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  assigned_course_id: string | null;
  assigned_chapter_id: string | null;
  account_status: string;
  test_assigned_at: string;
  first_login_at: string | null;
  first_action_at: string | null;
  last_action_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Returns the current user's VA account if one exists.
 * Non-VA users get null.
 */
export function useVaAccount() {
  const { user } = useAuth();

  const { data: vaAccount, isLoading } = useQuery({
    queryKey: ["va-account", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as VaAccount | null;
    },
    enabled: !!user?.id,
  });

  const isVa = !!vaAccount && vaAccount.role === "va_test";
  const isActive = isVa && vaAccount.account_status === "active";

  return { vaAccount, isVa, isActive, isLoading };
}

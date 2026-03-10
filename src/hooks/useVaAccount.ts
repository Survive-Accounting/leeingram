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

export interface VaAssignment {
  id: string;
  va_account_id: string;
  course_id: string;
  chapter_id: string;
  assigned_role: string;
  assigned_at: string;
  status: string;
  hours_logged: number;
  notes: string | null;
}

export type VaRole = "content_creation_va" | "sheet_prep_va" | "lead_va" | "admin";

export const VA_ROLE_LABELS: Record<string, string> = {
  content_creation_va: "Content Creation VA",
  sheet_prep_va: "Sheet Prep VA",
  lead_va: "Lead VA",
  va_test: "VA Test (Legacy)",
  admin: "Admin",
};

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

  // Fetch assignments for the VA
  const { data: assignments } = useQuery({
    queryKey: ["va-assignments", vaAccount?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_assignments")
        .select("*")
        .eq("va_account_id", vaAccount!.id);
      if (error) throw error;
      return data as VaAssignment[];
    },
    enabled: !!vaAccount?.id,
  });

  const isVa = !!vaAccount && ["va_test", "content_creation_va", "sheet_prep_va", "lead_va"].includes(vaAccount.role);
  const isActive = isVa && vaAccount.account_status === "active";

  // Determine the primary role from assignments or account role
  const primaryRole: VaRole | "admin" = vaAccount?.role === "va_test"
    ? "content_creation_va"  // default legacy VA test accounts to content creation
    : (vaAccount?.role as VaRole) || "admin";

  // Get assigned chapter IDs from assignments
  const assignedChapterIds = assignments?.map(a => a.chapter_id) ?? [];

  return { vaAccount, isVa, isActive, isLoading, assignments, primaryRole, assignedChapterIds };
}

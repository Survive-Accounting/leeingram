import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTeachingAssets() {
  return useQuery({
    queryKey: ["admin-teaching-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, course_id, chapter_id, asset_name, problem_type, difficulty, google_sheet_url, google_sheet_status, banked_generation_status, video_production_status, deployment_status, asset_approved_at, banked_generated_at, csv_export_status, lw_import_status, source_type, source_number, source_ref")
        .neq("google_sheet_status", "archived");
      if (error) throw error;
      return data;
    },
  });
}

export function useChaptersWithCourses() {
  return useQuery({
    queryKey: ["admin-chapters-courses"],
    queryFn: async () => {
      const { data: chapters, error: chErr } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("chapter_number");
      if (chErr) throw chErr;

      const { data: courses, error: coErr } = await supabase
        .from("courses")
        .select("id, course_name, code");
      if (coErr) throw coErr;

      return { chapters, courses };
    },
  });
}

export function useVaAccounts() {
  return useQuery({
    queryKey: ["admin-va-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAssetFlags() {
  return useQuery({
    queryKey: ["admin-asset-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_flags")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useVaAssignments() {
  return useQuery({
    queryKey: ["admin-va-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_assignments")
        .select("*")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useVaActivityLog() {
  return useQuery({
    queryKey: ["admin-va-activity-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useVaQuestions() {
  return useQuery({
    queryKey: ["admin-va-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SheetPrepEntry {
  id: string;
  teaching_asset_id: string;
  va_account_id: string | null;
  submitted_at: string;
  reviewed: boolean;
  reviewed_at: string | null;
  notes: string;
  // joined
  asset_name: string;
  source_ref: string | null;
  course_name: string;
  google_sheet_url: string | null;
  va_display_name: string | null;
}

export function useSheetPrepLog() {
  return useQuery({
    queryKey: ["sheet-prep-log"],
    queryFn: async () => {
      // Fetch log entries
      const { data: logs, error } = await supabase
        .from("sheet_prep_log")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;

      if (!logs || logs.length === 0) return [] as SheetPrepEntry[];

      // Get unique asset IDs and VA IDs
      const assetIds = [...new Set(logs.map((l: any) => l.teaching_asset_id))];
      const vaIds = [...new Set(logs.map((l: any) => l.va_account_id).filter(Boolean))];

      // Fetch assets
      const { data: assets } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, course_id, google_sheet_url")
        .in("id", assetIds);

      // Fetch courses
      const courseIds = [...new Set((assets || []).map(a => a.course_id))];
      const { data: courses } = await supabase
        .from("courses")
        .select("id, course_name")
        .in("id", courseIds.length ? courseIds : ["__none__"]);

      // Fetch VA accounts
      const { data: vas } = vaIds.length
        ? await supabase.from("va_accounts").select("id, full_name, email").in("id", vaIds)
        : { data: [] as any[] };

      const assetMap = new Map((assets || []).map(a => [a.id, a]));
      const courseMap = new Map((courses || []).map(c => [c.id, c]));
      const vaMap = new Map((vas || []).map(v => [v.id, v]));

      return logs.map((l: any): SheetPrepEntry => {
        const asset = assetMap.get(l.teaching_asset_id);
        const course = asset ? courseMap.get(asset.course_id) : null;
        const va = l.va_account_id ? vaMap.get(l.va_account_id) : null;
        return {
          id: l.id,
          teaching_asset_id: l.teaching_asset_id,
          va_account_id: l.va_account_id,
          submitted_at: l.submitted_at,
          reviewed: l.reviewed,
          reviewed_at: l.reviewed_at,
          notes: l.notes || "",
          asset_name: asset?.asset_name || "—",
          source_ref: asset?.source_ref || null,
          course_name: course?.course_name || "—",
          google_sheet_url: asset?.google_sheet_url || null,
          va_display_name: va?.full_name || va?.email || null,
        };
      });
    },
  });
}

export function useToggleSheetPrepReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reviewed }: { id: string; reviewed: boolean }) => {
      const { error } = await supabase
        .from("sheet_prep_log")
        .update({ reviewed, reviewed_at: reviewed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheet-prep-log"] }),
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type V2Status = "draft" | "ready" | "embedded";

export type V2AssetRow = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  chapter_id: string;
  chapter_number: number | null;
  course_id: string;
  course_code: string | null;
  v2_status: V2Status;
  v2_embedded_at: string | null;
  question_count: number;
};

export type V2AssetFilters = {
  courseId?: string | null;
  chapterId?: string | null;
  status?: V2Status | "all";
  search?: string;
  page: number;
  pageSize: number;
};

type FetchResult = { rows: V2AssetRow[]; total: number };

async function fetchV2Assets(f: V2AssetFilters): Promise<FetchResult> {
  // Get chapters + courses map first (small).
  const [{ data: chapters }, { data: courses }] = await Promise.all([
    supabase.from("chapters").select("id, chapter_number, course_id"),
    supabase.from("courses").select("id, code"),
  ]);
  const chapterMap = new Map((chapters || []).map((c: any) => [c.id, c]));
  const courseMap = new Map((courses || []).map((c: any) => [c.id, c]));

  // Determine chapter IDs to filter by (when course is selected without specific chapter).
  let chapterFilterIds: string[] | null = null;
  if (f.chapterId) {
    chapterFilterIds = [f.chapterId];
  } else if (f.courseId) {
    chapterFilterIds = (chapters || [])
      .filter((c: any) => c.course_id === f.courseId)
      .map((c: any) => c.id);
    if (chapterFilterIds.length === 0) return { rows: [], total: 0 };
  }

  // Base query with count.
  let q = supabase
    .from("teaching_assets")
    .select("id, asset_name, source_ref, chapter_id, v2_status, v2_embedded_at", { count: "exact" })
    .neq("google_sheet_status", "archived");

  if (f.status && f.status !== "all") q = q.eq("v2_status", f.status);
  if (chapterFilterIds) q = q.in("chapter_id", chapterFilterIds);
  if (f.search && f.search.trim()) q = q.ilike("source_ref", `%${f.search.trim()}%`);

  q = q.order("source_ref", { ascending: true, nullsFirst: false });
  q = q.range(f.page * f.pageSize, f.page * f.pageSize + f.pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  // Question counts (unresponded) for chapters in result set.
  const chIds = Array.from(new Set((data || []).map((r: any) => r.chapter_id)));
  let qByKey = new Map<string, number>();
  if (chIds.length) {
    const { data: qs } = await supabase
      .from("chapter_questions")
      .select("chapter_id, source_ref, responded")
      .in("chapter_id", chIds)
      .eq("responded", false);
    for (const row of qs || []) {
      const k = `${row.chapter_id}::${(row.source_ref || "").toLowerCase()}`;
      qByKey.set(k, (qByKey.get(k) || 0) + 1);
    }
  }

  const rows: V2AssetRow[] = (data || []).map((r: any) => {
    const ch = chapterMap.get(r.chapter_id) as any;
    const co = ch ? (courseMap.get(ch.course_id) as any) : null;
    const k = `${r.chapter_id}::${(r.source_ref || "").toLowerCase()}`;
    return {
      id: r.id,
      asset_name: r.asset_name,
      source_ref: r.source_ref,
      chapter_id: r.chapter_id,
      chapter_number: ch?.chapter_number ?? null,
      course_id: ch?.course_id ?? "",
      course_code: co?.code ?? null,
      v2_status: (r.v2_status as V2Status) || "draft",
      v2_embedded_at: r.v2_embedded_at,
      question_count: qByKey.get(k) || 0,
    };
  });

  return { rows, total: count || 0 };
}

export function useV2Assets(filters: V2AssetFilters) {
  return useQuery({
    queryKey: ["v2-assets", filters],
    queryFn: () => fetchV2Assets(filters),
    placeholderData: (prev) => prev,
  });
}

export function useV2StatusCounts() {
  return useQuery({
    queryKey: ["v2-status-counts"],
    queryFn: async () => {
      const statuses: V2Status[] = ["draft", "ready", "embedded"];
      const [totalRes, ...perStatus] = await Promise.all([
        supabase
          .from("teaching_assets")
          .select("id", { count: "exact", head: true })
          .neq("google_sheet_status", "archived"),
        ...statuses.map((s) =>
          supabase
            .from("teaching_assets")
            .select("id", { count: "exact", head: true })
            .neq("google_sheet_status", "archived")
            .eq("v2_status", s),
        ),
      ]);
      return {
        total: totalRes.count || 0,
        draft: perStatus[0].count || 0,
        ready: perStatus[1].count || 0,
        embedded: perStatus[2].count || 0,
      };
    },
  });
}

export function useChaptersAndCourses() {
  return useQuery({
    queryKey: ["v2-chapters-courses"],
    queryFn: async () => {
      const [{ data: chapters }, { data: courses }] = await Promise.all([
        supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number"),
        supabase.from("courses").select("id, code, course_name").order("code"),
      ]);
      return { chapters: chapters || [], courses: courses || [] };
    },
    staleTime: 60_000,
  });
}

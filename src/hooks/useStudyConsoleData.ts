import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PreviewChapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

export interface ChapterEntryAssets {
  first_asset_name: string | null;
  first_je_asset_name: string | null;
}

const HOUR = 1000 * 60 * 60;

/* ─── Chapters per course (cached for the session) ─── */

export function chaptersQueryKey(courseId: string | null | undefined) {
  return ["study-console", "chapters", courseId ?? ""] as const;
}

async function fetchChapters(courseId: string): Promise<PreviewChapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, chapter_number, chapter_name")
    .eq("course_id", courseId)
    .order("chapter_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PreviewChapter[];
}

export function useChapters(courseId: string | null | undefined) {
  return useQuery({
    queryKey: chaptersQueryKey(courseId),
    queryFn: () => fetchChapters(courseId as string),
    enabled: !!courseId,
    staleTime: Infinity,
    gcTime: HOUR,
    placeholderData: (prev) => prev,
  });
}

/* ─── First-asset + first-JE-asset for a chapter (single RPC) ─── */

export function chapterEntryAssetsQueryKey(chapterId: string | null | undefined) {
  return ["study-console", "entry-assets", chapterId ?? ""] as const;
}

async function fetchChapterEntryAssets(chapterId: string): Promise<ChapterEntryAssets> {
  const { data, error } = await (supabase as any).rpc("get_chapter_entry_assets", {
    p_chapter_id: chapterId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    first_asset_name: row?.first_asset_name ?? null,
    first_je_asset_name: row?.first_je_asset_name ?? null,
  };
}

export function useChapterEntryAssets(chapterId: string | null | undefined) {
  return useQuery({
    queryKey: chapterEntryAssetsQueryKey(chapterId),
    queryFn: () => fetchChapterEntryAssets(chapterId as string),
    enabled: !!chapterId,
    staleTime: Infinity,
    gcTime: HOUR,
  });
}

/* ─── Imperative prefetch helpers ─── */

export function usePrefetchStudyConsole() {
  const qc = useQueryClient();
  return {
    prefetchChapters: (courseId: string) =>
      qc.prefetchQuery({
        queryKey: chaptersQueryKey(courseId),
        queryFn: () => fetchChapters(courseId),
        staleTime: Infinity,
      }),
    prefetchChapterEntryAssets: (chapterId: string) =>
      qc.prefetchQuery({
        queryKey: chapterEntryAssetsQueryKey(chapterId),
        queryFn: () => fetchChapterEntryAssets(chapterId),
        staleTime: Infinity,
      }),
  };
}

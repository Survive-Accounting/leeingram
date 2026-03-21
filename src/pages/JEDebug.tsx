import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function JEDebug() {
  const [chapterId, setChapterId] = useState<string>("");

  const { data: chapters } = useQuery({
    queryKey: ["je-debug-chapters"],
    queryFn: async () => {
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("code", "IA2")
        .single();
      if (!course) return [];
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", course.id)
        .order("chapter_number");
      return data ?? [];
    },
  });

  const { data: assets, isLoading } = useQuery({
    queryKey: ["je-debug-assets", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, journal_entry_completed_json, supplementary_je_json, journal_entry_template_json")
        .eq("chapter_id", chapterId)
        .not("journal_entry_completed_json", "is", null)
        .order("asset_name");
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">JE Data Structure Debug (IA2)</h1>

      <Select value={chapterId} onValueChange={setChapterId}>
        <SelectTrigger className="w-80">
          <SelectValue placeholder="Select IA2 chapter" />
        </SelectTrigger>
        <SelectContent>
          {chapters?.map((ch) => (
            <SelectItem key={ch.id} value={ch.id}>
              Ch {ch.chapter_number} — {ch.chapter_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {assets && (
        <p className="text-sm text-muted-foreground">
          {assets.length} assets with JE data in this chapter
        </p>
      )}

      <div className="space-y-8">
        {assets?.map((asset) => (
          <div key={asset.id} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 flex items-center gap-3">
              <span className="font-semibold text-sm">{asset.asset_name}</span>
              <Badge variant="outline" className="text-[10px]">{asset.id}</Badge>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">journal_entry_completed_json</p>
                <pre className="bg-muted/20 border border-border rounded p-3 text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(asset.journal_entry_completed_json, null, 2)}
                </pre>
              </div>

              {asset.supplementary_je_json && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">supplementary_je_json</p>
                  <pre className="bg-muted/20 border border-border rounded p-3 text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(asset.supplementary_je_json, null, 2)}
                  </pre>
                </div>
              )}

              {asset.journal_entry_template_json && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">journal_entry_template_json</p>
                  <pre className="bg-muted/20 border border-border rounded p-3 text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(asset.journal_entry_template_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

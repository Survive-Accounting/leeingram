import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Copy, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const APP_URL = window.location.origin;

export default function ACCY304Admin() {
  const qc = useQueryClient();
  const [enrollInput, setEnrollInput] = useState("");
  const [enrollLoaded, setEnrollLoaded] = useState(false);

  // Fetch current enroll URL from app_settings
  const { data: currentEnrollUrl } = useQuery({
    queryKey: ["app-setting", "learnworlds_enroll_url"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "learnworlds_enroll_url")
        .maybeSingle();
      const val = data?.value || "";
      if (!enrollLoaded) {
        setEnrollInput(val);
        setEnrollLoaded(true);
      }
      return val;
    },
  });

  // Save enroll URL
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "learnworlds_enroll_url", value: enrollInput, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-setting", "learnworlds_enroll_url"] });
      toast.success("Enrollment URL saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch IA2 course
  const { data: courseData } = useQuery({
    queryKey: ["accy304-admin-course"],
    queryFn: async () => {
      const { data: courses } = await supabase.from("courses").select("id").eq("code", "IA2").limit(1);
      return courses?.[0] || null;
    },
  });

  // Fetch chapters 13-22
  const { data: chapters } = useQuery({
    queryKey: ["accy304-admin-chapters", courseData?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseData!.id)
        .gte("chapter_number", 13)
        .lte("chapter_number", 22)
        .order("chapter_number");
      return data || [];
    },
    enabled: !!courseData?.id,
  });

  // Fetch all IA2 core assets with view counts
  const { data: assets } = useQuery({
    queryKey: ["accy304-admin-assets", courseData?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("id, chapter_id, phase2_status, asset_approved_at, solutions_page_views, practice_page_views")
        .eq("course_id", courseData!.id);
      return (data || []).filter(
        (a: any) => a.phase2_status === "core_asset" || a.asset_approved_at != null
      );
    },
    enabled: !!courseData?.id,
  });

  // Fetch .edu lead emails
  const { data: eduLeads } = useQuery({
    queryKey: ["accy304-edu-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("edu_preview_sessions")
        .select("email, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const totalAssets = assets?.length || 0;
  const totalSolutionViews = assets?.reduce((s: number, a: any) => s + (a.solutions_page_views || 0), 0) || 0;
  const totalPracticeViews = assets?.reduce((s: number, a: any) => s + (a.practice_page_views || 0), 0) || 0;

  const getChapterStats = (chapterId: string) => {
    const chAssets = assets?.filter((a: any) => a.chapter_id === chapterId) || [];
    const count = chAssets.length;
    const totalViews = chAssets.reduce((s: number, a: any) => s + (a.solutions_page_views || 0) + (a.practice_page_views || 0), 0);
    return { count, avgViews: count > 0 ? Math.round(totalViews / count) : 0, hasSolutions: count > 0 };
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <SurviveSidebarLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-xl font-bold text-foreground">🚀 ACCY 304 Beta Launch</h1>

        {/* ── Launch Links ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Launch Links</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(`${APP_URL}/accy304`, "Landing page URL")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Landing Page URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copyToClipboard(
                  `<iframe src="${APP_URL}/accy304" width="100%" height="900" frameborder="0" style="border:none;border-radius:8px"></iframe>`,
                  "iFrame code"
                )
              }
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Landing Page iFrame
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/accy304", "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Landing Page →
            </Button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Core Assets", value: totalAssets },
              { label: "Solutions Views", value: totalSolutionViews },
              { label: "Practice Views", value: totalPracticeViews },
            ].map((m) => (
              <div key={m.label} className="bg-muted/30 border border-border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{m.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chapter Readiness ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Chapter Readiness</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Chapter</TableHead>
                  <TableHead className="text-xs text-center">Core Assets</TableHead>
                  <TableHead className="text-xs text-center">Solutions</TableHead>
                  <TableHead className="text-xs text-center">Avg Views</TableHead>
                  <TableHead className="text-xs text-right">Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chapters?.map((ch) => {
                  const stats = getChapterStats(ch.id);
                  return (
                    <TableRow key={ch.id}>
                      <TableCell className="text-sm font-medium">
                        Ch {ch.chapter_number} — {ch.chapter_name}
                      </TableCell>
                      <TableCell className="text-center text-sm">{stats.count}</TableCell>
                      <TableCell className="text-center">
                        {stats.hasSolutions ? (
                          <span className="text-emerald-500">✓</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{stats.avgViews}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => window.open(`/accy304?chapter=${ch.id}`, "_blank")}
                        >
                          Preview →
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Enrollment Link Setting ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Enrollment Link</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">LearnWorlds Enrollment URL</label>
              <Input
                value={enrollInput}
                onChange={(e) => setEnrollInput(e.target.value)}
                placeholder="https://school.surviveaccounting.com/course/..."
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
          {currentEnrollUrl && (
            <p className="text-xs text-muted-foreground">
              Current: <a href={currentEnrollUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentEnrollUrl}</a>
            </p>
          )}
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}

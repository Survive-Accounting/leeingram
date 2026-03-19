import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle, Copy, FileText, Sparkles, Image } from "lucide-react";
import { toast } from "sonner";

type QARecord = {
  id: string;
  teaching_asset_id: string;
  asset_name: string;
  chapter_id: string;
  course_id: string;
  qa_status: string;
  issue_description: string | null;
  screenshot_url: string | null;
  fix_description: string | null;
  lovable_prompt_generated: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export default function SolutionsQAAdmin() {
  const qc = useQueryClient();
  const [fixDescriptions, setFixDescriptions] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptIds, setPromptIds] = useState<string[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [allAssetsFilter, setAllAssetsFilter] = useState<string>("all");
  const [allAssetsChapter, setAllAssetsChapter] = useState<string>("all");

  const { data: records, isLoading } = useQuery({
    queryKey: ["qa-admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solutions_qa_reviews")
        .select("*")
        .order("asset_name");
      if (error) throw error;
      return data as QARecord[];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["qa-admin-chapters"],
    queryFn: async () => {
      const { data: ia2 } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!ia2?.length) return [];
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name").eq("course_id", ia2[0].id).order("chapter_number");
      return data || [];
    },
  });

  const counts = useMemo(() => {
    if (!records) return { total: 0, pending: 0, clean: 0, issues: 0, fixApproved: 0, generated: 0 };
    return {
      total: records.length,
      pending: records.filter(r => r.qa_status === "pending").length,
      clean: records.filter(r => r.qa_status === "reviewed_clean").length,
      issues: records.filter(r => r.qa_status === "reviewed_issues").length,
      fixApproved: records.filter(r => r.qa_status === "fix_approved").length,
      generated: records.filter(r => r.lovable_prompt_generated).length,
    };
  }, [records]);

  const issueRecords = useMemo(() => records?.filter(r => r.qa_status === "reviewed_issues") || [], [records]);
  const fixReadyRecords = useMemo(() => records?.filter(r => r.qa_status === "fix_approved" && !r.lovable_prompt_generated) || [], [records]);

  const allAssetsFiltered = useMemo(() => {
    if (!records) return [];
    let r = records;
    if (allAssetsFilter !== "all") r = r.filter(rec => rec.qa_status === allAssetsFilter);
    if (allAssetsChapter !== "all") r = r.filter(rec => rec.chapter_id === allAssetsChapter);
    return r;
  }, [records, allAssetsFilter, allAssetsChapter]);

  const approveMutation = useMutation({
    mutationFn: async ({ id, fixDesc }: { id: string; fixDesc: string }) => {
      const { error } = await supabase
        .from("solutions_qa_reviews")
        .update({
          qa_status: "fix_approved",
          fix_description: fixDesc,
          approved_by: "admin",
          approved_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-reviews"] });
      toast.success("Fix approved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markCleanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solutions_qa_reviews")
        .update({ qa_status: "reviewed_clean" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-reviews"] });
      toast.success("Marked as clean");
    },
  });

  const generatePrompt = () => {
    if (fixReadyRecords.length === 0) return;

    const lines = fixReadyRecords.map((r, i) => `${i + 1}. **${r.asset_name}**: ${r.fix_description || r.issue_description || "No description"}`);

    const prompt = `Read src/pages/SolutionsViewer.tsx and src/components/SolutionTextRenderer.tsx fully before making any changes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIXES REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines.join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not change any other behaviour. Files to modify: src/pages/SolutionsViewer.tsx, src/components/SolutionTextRenderer.tsx only.`;

    setGeneratedPrompt(prompt);
    setPromptIds(fixReadyRecords.map(r => r.id));
  };

  const markGeneratedMutation = useMutation({
    mutationFn: async () => {
      for (const id of promptIds) {
        const { error } = await supabase
          .from("solutions_qa_reviews")
          .update({ lovable_prompt_generated: true, qa_status: "fix_generated" } as any)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-reviews"] });
      toast.success("All marked as generated");
      setGeneratedPrompt("");
      setPromptIds([]);
    },
  });

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      reviewed_clean: "bg-emerald-500/20 text-emerald-400",
      reviewed_issues: "bg-amber-500/20 text-amber-400",
      fix_approved: "bg-blue-500/20 text-blue-400",
      fix_generated: "bg-purple-500/20 text-purple-400",
    };
    return <Badge className={`text-[10px] ${colors[s] || colors.pending}`}>{s.replace(/_/g, " ")}</Badge>;
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Solutions QA — Admin</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Pending", value: counts.pending, color: "text-muted-foreground" },
            { label: "Clean", value: counts.clean, color: "text-emerald-400" },
            { label: "Issues", value: counts.issues, color: "text-amber-400" },
            { label: "Fix Approved", value: counts.fixApproved, color: "text-blue-400" },
            { label: "Generated", value: counts.generated, color: "text-purple-400" },
          ].map(c => (
            <Card key={c.label} className="bg-card/50">
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="issues">
          <TabsList>
            <TabsTrigger value="issues" className="text-xs">Issues to Review ({counts.issues})</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs">Generate Prompt ({fixReadyRecords.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All Assets ({counts.total})</TabsTrigger>
          </TabsList>

          {/* TAB 1: Issues */}
          <TabsContent value="issues" className="space-y-3 mt-3">
            {issueRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No issues to review.</p>
            ) : issueRecords.map(rec => (
              <Card key={rec.id} className="bg-card/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sm text-foreground">{rec.asset_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        reviewed by {rec.reviewed_by}
                      </span>
                    </div>
                    {statusBadge(rec.qa_status)}
                  </div>

                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
                    <p className="text-xs text-amber-300">{rec.issue_description}</p>
                  </div>

                  {rec.screenshot_url && (
                    <div>
                      <img
                        src={rec.screenshot_url}
                        alt="Issue screenshot"
                        className="max-h-32 rounded border border-border cursor-pointer hover:opacity-80"
                        onClick={() => setExpandedImage(rec.screenshot_url)}
                      />
                    </div>
                  )}

                  <Textarea
                    value={fixDescriptions[rec.id] ?? rec.issue_description ?? ""}
                    onChange={e => setFixDescriptions(prev => ({ ...prev, [rec.id]: e.target.value }))}
                    placeholder="Edit fix description..."
                    className="text-xs min-h-[60px]"
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      onClick={() => approveMutation.mutate({
                        id: rec.id,
                        fixDesc: fixDescriptions[rec.id] ?? rec.issue_description ?? "",
                      })}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Approve Fix
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => markCleanMutation.mutate(rec.id)}
                      disabled={markCleanMutation.isPending}
                    >
                      Mark as Clean
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* TAB 2: Generate Prompt */}
          <TabsContent value="prompt" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {fixReadyRecords.length} fixes ready to compile
              </p>
              <Button
                size="sm"
                className="text-xs"
                onClick={generatePrompt}
                disabled={fixReadyRecords.length === 0}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Generate Lovable Prompt
              </Button>
            </div>

            {generatedPrompt && (
              <div className="space-y-3">
                <Textarea
                  value={generatedPrompt}
                  readOnly
                  className="text-xs font-mono min-h-[300px] bg-muted/30"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPrompt);
                      toast.success("Prompt copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => markGeneratedMutation.mutate()}
                    disabled={markGeneratedMutation.isPending}
                  >
                    <FileText className="h-3 w-3 mr-1" /> Mark All as Generated
                  </Button>
                </div>
              </div>
            )}

            {fixReadyRecords.length > 0 && !generatedPrompt && (
              <div className="space-y-2">
                {fixReadyRecords.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border pb-2">
                    <span className="font-mono font-medium text-foreground">{r.asset_name}</span>
                    <span>— {r.fix_description}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: All Assets */}
          <TabsContent value="all" className="space-y-3 mt-3">
            <div className="flex items-center gap-2 mb-3">
              <Select value={allAssetsFilter} onValueChange={v => setAllAssetsFilter(v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed_clean">Clean</SelectItem>
                  <SelectItem value="reviewed_issues">Issues</SelectItem>
                  <SelectItem value="fix_approved">Fix Approved</SelectItem>
                  <SelectItem value="fix_generated">Generated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={allAssetsChapter} onValueChange={v => setAllAssetsChapter(v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All chapters</SelectItem>
                  {chapters?.map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">{allAssetsFiltered.length} results</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium">Asset</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Reviewed By</th>
                    <th className="text-left px-3 py-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {allAssetsFiltered.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="px-3 py-2 font-mono">{r.asset_name}</td>
                      <td className="px-3 py-2">{statusBadge(r.qa_status)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.reviewed_by || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                        {r.issue_description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Screenshot expand dialog */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-3xl">
          {expandedImage && <img src={expandedImage} alt="Expanded screenshot" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}

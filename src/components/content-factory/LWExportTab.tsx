import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterId: string;
  chapterNumber: number;
  courseName: string;
  courseCode: string;
}

export function LWExportTab({ chapterId, chapterNumber, courseName, courseCode }: Props) {
  const qc = useQueryClient();
  const [exportScope, setExportScope] = useState<string>("chapter");
  const [selectedTopic, setSelectedTopic] = useState<string>("");

  const { data: topics } = useQuery({
    queryKey: ["chapter-topics", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_topics")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: lwItems } = useQuery({
    queryKey: ["lw-items", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lw_items")
        .select("*, chapter_topics(topic_name)")
        .eq("chapter_id", chapterId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const exportableItems = (lwItems ?? []).filter(
    i => i.include_in_bank && i.status === "approved"
  );

  const scopedItems = exportScope === "topic" && selectedTopic
    ? exportableItems.filter(i => i.topic_id === selectedTopic)
    : exportableItems;

  const bankName = `${courseCode} | Ch${String(chapterNumber).padStart(2, "0")} | ${courseName}`;

  const generateCSV = () => {
    if (scopedItems.length === 0) {
      toast.error("No exportable items found");
      return;
    }

    const headers = [
      "Group", "Type", "Question", "CorAns",
      "Answer1", "Answer2", "Answer3", "Answer4", "Answer5",
      "Answer6", "Answer7", "Answer8", "Answer9", "Answer10",
      "CorrectExplanation", "IncorrectExplanation",
    ];

    const rows = scopedItems.map(item => {
      const topicName = item.chapter_topics?.topic_name ?? "General";
      const group = `Ch${String(chapterNumber).padStart(2, "0")} | ${topicName}`;
      return [
        group,
        item.lw_type,
        item.question_text,
        item.correct_answer,
        item.answer_1, item.answer_2, item.answer_3, item.answer_4, item.answer_5,
        item.answer_6, item.answer_7, item.answer_8, item.answer_9, item.answer_10,
        item.correct_explanation,
        item.incorrect_explanation,
      ].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LW_Export_Ch${chapterNumber}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${scopedItems.length} items`);
  };

  const markBankedMutation = useMutation({
    mutationFn: async () => {
      const ids = scopedItems.map(i => i.id);
      if (ids.length === 0) throw new Error("No items to mark");
      const { error } = await supabase
        .from("lw_items")
        .update({ status: "banked", banked_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
      toast.success("Items marked as banked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalItems = lwItems?.length ?? 0;
  const draftedCount = (lwItems ?? []).filter(i => i.status === "drafted").length;
  const approvedCount = (lwItems ?? []).filter(i => i.status === "approved").length;
  const bankedCount = (lwItems ?? []).filter(i => i.status === "banked").length;

  return (
    <div className="space-y-4">
      {/* Stats overview */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Items", value: totalItems, color: "" },
          { label: "Drafted", value: draftedCount, color: "text-muted-foreground" },
          { label: "Approved", value: approvedCount, color: "text-amber-400" },
          { label: "Banked", value: bankedCount, color: "text-emerald-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bank name */}
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LearnWorlds Bank Name</p>
          <p className="text-sm font-mono font-medium text-foreground">{bankName}</p>
        </CardContent>
      </Card>

      {/* Export controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Export to LearnWorlds CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={exportScope} onValueChange={setExportScope}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chapter">Entire Chapter</SelectItem>
                <SelectItem value="topic">Single Topic</SelectItem>
              </SelectContent>
            </Select>

            {exportScope === "topic" && (
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder="Select topic…" />
                </SelectTrigger>
                <SelectContent>
                  {(topics ?? []).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.topic_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {scopedItems.length} items ready for export (approved + include_in_bank)
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateCSV} disabled={scopedItems.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mark as banked */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Mark Exported Items as Banked</p>
            <p className="text-xs text-muted-foreground">Sets status to "banked" and records timestamp for {scopedItems.length} items.</p>
          </div>
          <Button
            size="sm"
            onClick={() => markBankedMutation.mutate()}
            disabled={scopedItems.length === 0 || markBankedMutation.isPending}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as Banked
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterId: string;
  courseId: string;
  chapterNumber: number;
}

const STATUS_COLORS: Record<string, string> = {
  drafted: "bg-muted text-muted-foreground",
  approved: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  banked: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export function DraftReviewMode({ chapterId, courseId, chapterNumber }: Props) {
  const qc = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);

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
        .select("*, chapter_topics(topic_name), chapter_problems(source_label)")
        .eq("chapter_id", chapterId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("lw_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
    },
  });

  const approveItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lw_items").update({ status: "approved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
      toast.success("Item approved");
    },
  });

  const filtered = (lwItems ?? []).filter(item => {
    if (selectedTopic !== "all" && item.topic_id !== selectedTopic) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const statusCounts = {
    drafted: (lwItems ?? []).filter(i => i.status === "drafted").length,
    approved: (lwItems ?? []).filter(i => i.status === "approved").length,
    banked: (lwItems ?? []).filter(i => i.status === "banked").length,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Topic:</Label>
          <Select value={selectedTopic} onValueChange={setSelectedTopic}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {(topics ?? []).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.topic_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="drafted">Drafted ({statusCounts.drafted})</SelectItem>
              <SelectItem value="approved">Approved ({statusCounts.approved})</SelectItem>
              <SelectItem value="banked">Banked ({statusCounts.banked})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <Badge variant="outline">{filtered.length} items</Badge>
        </div>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No LW items match the current filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <LWItemCard
              key={item.id}
              item={item}
              isEditing={editingItem === item.id}
              onToggleEdit={() => setEditingItem(editingItem === item.id ? null : item.id)}
              onUpdate={(updates) => updateItem.mutate({ id: item.id, updates })}
              onApprove={() => approveItem.mutate(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LWItemCard({
  item,
  isEditing,
  onToggleEdit,
  onUpdate,
  onApprove,
}: {
  item: any;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Record<string, any>) => void;
  onApprove: () => void;
}) {
  const sourceLabel = item.chapter_problems?.source_label ?? "—";
  const topicName = item.chapter_topics?.topic_name ?? "Unassigned";

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-mono font-bold text-foreground">{item.item_key}</span>
            <Badge variant="outline" className="text-[10px]">{item.item_label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.status] || ""}`}>
              {item.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Include</span>
              <Switch
                checked={item.include_in_bank}
                onCheckedChange={(v) => onUpdate({ include_in_bank: v })}
                className="scale-75"
              />
            </div>
            {item.status === "drafted" && (
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onApprove}>
                <Check className="h-3 w-3 mr-1" /> Approve
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={onToggleEdit}>
              {isEditing ? "Close" : "Edit"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
          <span>Source: {sourceLabel}</span>
          <span>•</span>
          <span>Topic: {topicName}</span>
          <span>•</span>
          <span>Type: {item.lw_type}</span>
        </div>

        {item.question_text && !isEditing && (
          <p className="text-xs text-foreground/80 line-clamp-2">{item.question_text}</p>
        )}

        {isEditing && (
          <LWItemEditor item={item} onUpdate={onUpdate} />
        )}
      </CardContent>
    </Card>
  );
}

function LWItemEditor({ item, onUpdate }: { item: any; onUpdate: (u: Record<string, any>) => void }) {
  const [questionText, setQuestionText] = useState(item.question_text || "");
  const [correctAnswer, setCorrectAnswer] = useState(item.correct_answer || "");
  const [correctExplanation, setCorrectExplanation] = useState(item.correct_explanation || "");
  const [incorrectExplanation, setIncorrectExplanation] = useState(item.incorrect_explanation || "");
  const [answers, setAnswers] = useState<string[]>(
    Array.from({ length: 10 }, (_, i) => item[`answer_${i + 1}`] || "")
  );
  const [topicId, setTopicId] = useState(item.topic_id || "");

  const save = () => {
    const updates: Record<string, any> = {
      question_text: questionText,
      correct_answer: correctAnswer,
      correct_explanation: correctExplanation,
      incorrect_explanation: incorrectExplanation,
    };
    answers.forEach((a, i) => { updates[`answer_${i + 1}`] = a; });
    if (topicId) updates.topic_id = topicId;
    onUpdate(updates);
    toast.success("Item updated");
  };

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border">
      <div>
        <Label className="text-xs">Question Text</Label>
        <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="min-h-[60px] text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {answers.map((a, i) => (
          <div key={i}>
            <Label className="text-[10px]">Answer {i + 1}</Label>
            <Input
              value={a}
              onChange={(e) => { const na = [...answers]; na[i] = e.target.value; setAnswers(na); }}
              className="h-7 text-xs"
              placeholder={i < 4 ? `Answer ${i + 1}` : "Optional"}
            />
          </div>
        ))}
      </div>
      <div>
        <Label className="text-xs">Correct Answer</Label>
        <Input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Correct Explanation</Label>
          <Textarea value={correctExplanation} onChange={(e) => setCorrectExplanation(e.target.value)} className="min-h-[50px] text-xs" />
        </div>
        <div>
          <Label className="text-xs">Incorrect Explanation</Label>
          <Textarea value={incorrectExplanation} onChange={(e) => setIncorrectExplanation(e.target.value)} className="min-h-[50px] text-xs" />
        </div>
      </div>
      <Button size="sm" onClick={save}>Save Changes</Button>
    </div>
  );
}

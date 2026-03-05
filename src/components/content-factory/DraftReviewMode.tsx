import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, FileText, Lock, AlertTriangle, RotateCw, Sparkles, Loader2, ClipboardCopy } from "lucide-react";
import { renderQuestionHtml, copyHtmlToClipboard } from "@/lib/questionHtmlRenderer";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { assignTopicByRules } from "@/lib/topicAssignment";

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
  const [showNeedsReview, setShowNeedsReview] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [rerunOverrideLocked, setRerunOverrideLocked] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refining, setRefining] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

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
        .select("*, chapter_topics(topic_name), chapter_problems(source_label, problem_text, title)")
        .eq("chapter_id", chapterId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: course } = useQuery({
    queryKey: ["course-for-rules", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("code").eq("id", courseId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: topicRules } = useQuery({
    queryKey: ["topic-rules", course?.code, chapterNumber],
    queryFn: async () => {
      if (!course?.code) return [];
      const { data, error } = await supabase
        .from("topic_rules")
        .select("*")
        .eq("course_short", course.code)
        .eq("chapter_number", chapterNumber)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!course?.code,
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

  // Handle topic change with lock
  const changeTopicForItem = (itemId: string, topicId: string) => {
    updateItem.mutate({
      id: itemId,
      updates: { topic_id: topicId, topic_locked: true, needs_topic_review: false },
    });
    toast.success("Topic updated & locked");
  };

  // Re-run topic assignment
  const handleRerunTopicAssignment = async () => {
    if (!lwItems || !topics || !topicRules) return;
    setRerunning(true);

    const activeTopics = topics.filter(t => t.is_active);
    let updated = 0;

    for (const item of lwItems) {
      if (item.topic_locked && !rerunOverrideLocked) continue;

      const context = {
        problem_text: (item as any).chapter_problems?.problem_text || "",
        problem_title: (item as any).chapter_problems?.title || "",
        lw_question_text: item.question_text || "",
      };

      const { topicId, usedFallback } = assignTopicByRules(
        topicRules as any[],
        activeTopics as any[],
        context,
        item.item_label
      );

      if (topicId && topicId !== item.topic_id) {
        await supabase.from("lw_items").update({
          topic_id: topicId,
          needs_topic_review: usedFallback,
          ...(rerunOverrideLocked ? { topic_locked: false } : {}),
        }).eq("id", item.id);
        updated++;
      }
    }

    setRerunning(false);
    setRerunOpen(false);
    qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
    toast.success(`Re-assigned topics for ${updated} items`);
  };

  // AI Refine Topics
  const handleRefineSuggestions = async () => {
    setRefining(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("refine-topics", {
        body: {
          chapterId,
          chapterNumber,
          courseCode: course?.code || "",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestions(data.suggestions || []);
      setRefineOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI suggestions");
    } finally {
      setRefining(false);
    }
  };

  // Accept suggestion
  const acceptSuggestion = async (suggestion: any, index: number) => {
    try {
      const d = suggestion.details;
      switch (suggestion.type) {
        case "rename": {
          await supabase.from("chapter_topics").update({ topic_name: d.newName }).eq("id", d.topicId);
          break;
        }
        case "merge": {
          await supabase.from("lw_items").update({ topic_id: d.targetTopicId }).eq("topic_id", d.sourceTopicId);
          await supabase.from("chapter_topics").update({ is_active: false }).eq("id", d.sourceTopicId);
          break;
        }
        case "create": {
          const maxOrder = (topics ?? []).reduce((max, t) => Math.max(max, t.display_order), 0) + 1;
          const { data: newTopic } = await supabase.from("chapter_topics").insert({
            chapter_id: chapterId,
            topic_name: d.newTopicName,
            display_order: maxOrder,
          }).select("id").single();
          if (newTopic && d.itemKeysToMove?.length) {
            await supabase.from("lw_items")
              .update({ topic_id: newTopic.id })
              .eq("chapter_id", chapterId)
              .in("item_key", d.itemKeysToMove);
          }
          break;
        }
        case "split": {
          const maxOrder2 = (topics ?? []).reduce((max, t) => Math.max(max, t.display_order), 0) + 1;
          const { data: splitTopic } = await supabase.from("chapter_topics").insert({
            chapter_id: chapterId,
            topic_name: d.newTopicName,
            display_order: maxOrder2,
          }).select("id").single();
          if (splitTopic && d.itemKeysToMove?.length) {
            await supabase.from("lw_items")
              .update({ topic_id: splitTopic.id })
              .eq("chapter_id", chapterId)
              .in("item_key", d.itemKeysToMove);
          }
          break;
        }
        case "rule_add": {
          await supabase.from("topic_rules").insert({
            course_short: course?.code || "",
            chapter_number: chapterNumber,
            topic_name: d.topicName,
            pattern: d.pattern,
            match_field: d.matchField || "problem_text",
            priority: 5,
          });
          break;
        }
      }

      setSuggestions(prev => prev.filter((_, i) => i !== index));
      qc.invalidateQueries({ queryKey: ["chapter-topics", chapterId] });
      qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
      qc.invalidateQueries({ queryKey: ["topic-rules"] });
      toast.success(`Applied: ${suggestion.description}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = (lwItems ?? []).filter(item => {
    if (selectedTopic !== "all" && item.topic_id !== selectedTopic) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (showNeedsReview && !item.needs_topic_review) return false;
    return true;
  });

  const statusCounts = {
    drafted: (lwItems ?? []).filter(i => i.status === "drafted").length,
    approved: (lwItems ?? []).filter(i => i.status === "approved").length,
    banked: (lwItems ?? []).filter(i => i.status === "banked").length,
    needsReview: (lwItems ?? []).filter(i => i.needs_topic_review).length,
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
        {statusCounts.needsReview > 0 && (
          <Button
            size="sm"
            variant={showNeedsReview ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setShowNeedsReview(!showNeedsReview)}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Review ({statusCounts.needsReview})
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRerunOpen(true)}>
            <RotateCw className="h-3 w-3 mr-1" /> Re-run Assignment
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleRefineSuggestions}
            disabled={refining}
          >
            {refining ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Refine Topics (AI)
          </Button>
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
              topics={topics ?? []}
              isEditing={editingItem === item.id}
              onToggleEdit={() => setEditingItem(editingItem === item.id ? null : item.id)}
              onUpdate={(updates) => updateItem.mutate({ id: item.id, updates })}
              onApprove={() => approveItem.mutate(item.id)}
              onChangeTopic={(topicId) => changeTopicForItem(item.id, topicId)}
            />
          ))}
        </div>
      )}

      {/* Re-run Dialog */}
      <Dialog open={rerunOpen} onOpenChange={setRerunOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Re-run Topic Assignment</DialogTitle>
            <DialogDescription>
              Re-apply topic rules to all LW items. Locked items are skipped by default.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={rerunOverrideLocked}
              onCheckedChange={(v) => setRerunOverrideLocked(!!v)}
            />
            <Label className="text-xs">Override locked topics (reset manual assignments)</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRerunOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleRerunTopicAssignment} disabled={rerunning}>
              {rerunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCw className="h-3 w-3 mr-1" />}
              {rerunning ? "Running…" : "Re-run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggestions Dialog */}
      <Dialog open={refineOpen} onOpenChange={setRefineOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI Topic Suggestions
            </DialogTitle>
            <DialogDescription>
              Review each suggestion and accept or dismiss.
            </DialogDescription>
          </DialogHeader>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Topics look well-organized — no suggestions.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Badge variant="outline" className="text-[10px] mb-1">{s.type}</Badge>
                        <p className="text-xs text-foreground">{s.description}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => setSuggestions(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => acceptSuggestion(s, i)}
                        >
                          <Check className="h-3 w-3 mr-1" /> Accept
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LWItemCard({
  item,
  topics,
  isEditing,
  onToggleEdit,
  onUpdate,
  onApprove,
  onChangeTopic,
}: {
  item: any;
  topics: any[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Record<string, any>) => void;
  onApprove: () => void;
  onChangeTopic: (topicId: string) => void;
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
            {item.topic_locked && (
              <span title="Topic manually locked"><Lock className="h-3 w-3 text-muted-foreground" /></span>
            )}
            {item.needs_topic_review && (
              <span title="Needs topic review (fallback used)"><AlertTriangle className="h-3 w-3 text-amber-400" /></span>
            )}
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              onClick={async () => {
                const answers = Array.from({ length: 10 }, (_, i) => item[`answer_${i + 1}`] || "").filter(Boolean);
                const html = renderQuestionHtml({
                  questionId: item.item_key || "Q",
                  questionText: item.question_text || "",
                  answers,
                  correctAnswer: item.correct_answer || "",
                  explanation: item.correct_explanation || "",
                });
                await copyHtmlToClipboard(html);
                toast.success("HTML copied successfully");
              }}
            >
              <ClipboardCopy className="h-3 w-3 mr-1" /> Copy HTML
            </Button>
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
          <Select
            value={item.topic_id || ""}
            onValueChange={(v) => onChangeTopic(v)}
          >
            <SelectTrigger className="h-5 w-auto min-w-[120px] text-[10px] border-none bg-transparent p-0 gap-1">
              <span>Topic: {topicName}</span>
            </SelectTrigger>
            <SelectContent>
              {topics.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">{t.topic_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

  const save = () => {
    const updates: Record<string, any> = {
      question_text: questionText,
      correct_answer: correctAnswer,
      correct_explanation: correctExplanation,
      incorrect_explanation: incorrectExplanation,
    };
    answers.forEach((a, i) => { updates[`answer_${i + 1}`] = a; });
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

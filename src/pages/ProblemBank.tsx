import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Eye, ArrowLeft, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type ChapterProblem = {
  id: string;
  course_id: string;
  chapter_id: string;
  problem_type: "exercise" | "problem" | "custom";
  source_label: string;
  title: string;
  problem_text: string;
  solution_text: string;
  journal_entry_text: string | null;
  difficulty_internal: "easy" | "medium" | "hard" | "tricky" | null;
  status: string;
  created_at: string;
};

type AssetForm = Omit<ChapterProblem, "id" | "created_at" | "status">;

const EMPTY_FORM: AssetForm = {
  course_id: "",
  chapter_id: "",
  problem_type: "exercise",
  source_label: "",
  title: "",
  problem_text: "",
  solution_text: "",
  journal_entry_text: null,
  difficulty_internal: null,
};

export default function ProblemBank() {
  const qc = useQueryClient();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewingProblem, setViewingProblem] = useState<ChapterProblem | null>(null);

  // Asset Factory state
  const [afDifficulty, setAfDifficulty] = useState("standard");
  const [afNotes, setAfNotes] = useState("");
  const [afRequiresJE, setAfRequiresJE] = useState(false);
  const [generatedAssetId, setGeneratedAssetId] = useState<string | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("course_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters", courseFilter],
    queryFn: async () => {
      let q = supabase.from("chapters").select("*").order("chapter_number");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: problems, isLoading } = useQuery({
    queryKey: ["chapter-problems", courseFilter, chapterFilter, typeFilter, search],
    queryFn: async () => {
      let q = supabase.from("chapter_problems").select("*").order("created_at", { ascending: false });
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      if (typeFilter !== "all") q = q.eq("problem_type", typeFilter as any);
      if (search.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,source_label.ilike.%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as ChapterProblem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      if (data.id) {
        const { id, ...rest } = data;
        const { error } = await supabase.from("chapter_problems").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chapter_problems").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setDialogOpen(false);
      toast.success(editingId ? "Problem updated" : "Problem created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_problems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setDeleteId(null);
      toast.success("Problem deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: async (problem: ChapterProblem) => {
      const { data, error } = await supabase.functions.invoke("convert-to-asset", {
        body: {
          problemId: problem.id,
          courseId: problem.course_id,
          chapterId: problem.chapter_id,
          sourceLabel: problem.source_label,
          title: problem.title,
          problemText: problem.problem_text,
          solutionText: problem.solution_text,
          journalEntryText: problem.journal_entry_text,
          difficulty: afDifficulty,
          notes: afNotes,
          requiresJournalEntry: afRequiresJE,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      setGeneratedAssetId(data.asset?.id ?? null);
      if (viewingProblem) {
        setViewingProblem({ ...viewingProblem, status: "converted" });
      }
      toast.success("Teaching Asset generated successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      course_id: courseFilter !== "all" ? courseFilter : courses?.[0]?.id ?? "",
      chapter_id: chapterFilter !== "all" ? chapterFilter : "",
    });
    setDialogOpen(true);
  };

  const openEdit = (p: ChapterProblem) => {
    setEditingId(p.id);
    setForm({
      course_id: p.course_id,
      chapter_id: p.chapter_id,
      problem_type: p.problem_type,
      source_label: p.source_label,
      title: p.title,
      problem_text: p.problem_text,
      solution_text: p.solution_text,
      journal_entry_text: p.journal_entry_text,
      difficulty_internal: p.difficulty_internal,
    });
    setDialogOpen(true);
  };

  const openDetail = (p: ChapterProblem) => {
    setViewingProblem(p);
    setAfDifficulty("standard");
    setAfNotes("");
    setAfRequiresJE(false);
    setGeneratedAssetId(null);
  };

  const handleSave = () => {
    if (!form.course_id || !form.chapter_id) {
      toast.error("Select a course and chapter");
      return;
    }
    saveMutation.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const patch = (k: string, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  const chapterName = (chId: string) => {
    const ch = chapters?.find((c) => c.id === chId);
    return ch ? `Ch ${ch.chapter_number}` : "";
  };

  // ─── Detail View ───
  if (viewingProblem) {
    const p = viewingProblem;
    const isConverted = p.status === "converted";

    return (
      <SurviveSidebarLayout>
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setViewingProblem(null)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to Problem Inbox
          </Button>
        </div>

        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">{p.source_label}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{p.problem_type}</Badge>
                <Badge
                  variant={isConverted ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {isConverted ? "Converted" : "Raw"}
                </Badge>
              </div>
              <h1 className="text-xl font-bold text-foreground">{p.title}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{chapterName(p.chapter_id)}</p>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => { openEdit(p); setViewingProblem(null); }}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
          </div>

          {/* Problem & Solution */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{p.problem_text || "—"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Solution</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{p.solution_text || "—"}</p>
            </div>
          </div>

          {p.journal_entry_text && (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Journal Entry</h2>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">{p.journal_entry_text}</pre>
            </div>
          )}

          {/* ─── Asset Factory ─── */}
          <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Asset Factory</h2>
              {isConverted && <Badge variant="default" className="text-[10px]">Already converted</Badge>}
            </div>

            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <div>
                <Label className="text-xs">Difficulty</Label>
                <Select value={afDifficulty} onValueChange={setAfDifficulty}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="slightly_harder">Slightly Harder</SelectItem>
                    <SelectItem value="tricky">Tricky</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Notes for AI (optional)</Label>
                <Input
                  value={afNotes}
                  onChange={(e) => setAfNotes(e.target.value)}
                  placeholder="e.g., Focus on premium bonds, use small numbers"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                id="requires-je"
                checked={afRequiresJE}
                onCheckedChange={(v) => setAfRequiresJE(v === true)}
              />
              <Label htmlFor="requires-je" className="text-xs cursor-pointer">
                This concept requires a journal entry
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => generateMutation.mutate(p)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1" /> Generate Teaching Asset</>
                )}
              </Button>

              {generatedAssetId && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/assets-library">
                    <ExternalLink className="h-3 w-3 mr-1" /> Open Asset
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </SurviveSidebarLayout>
    );
  }

  // ─── Table View ───
  return (
    <SurviveSidebarLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Problem Inbox</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Problem
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setChapterFilter("all"); }}>
          <SelectTrigger className="h-8 text-xs bg-white/[0.07] border-white/10">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={chapterFilter} onValueChange={setChapterFilter}>
          <SelectTrigger className="h-8 text-xs bg-white/[0.07] border-white/10">
            <SelectValue placeholder="All Chapters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chapters</SelectItem>
            {chapters?.map((c) => (
              <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-xs bg-white/[0.07] border-white/10">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="exercise">Exercise</SelectItem>
            <SelectItem value="problem">Problem</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search label or title…"
            className="h-8 text-xs pl-7 bg-white/[0.07] border-white/10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden border border-white/10 bg-white/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-xs">Label</TableHead>
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Chapter</TableHead>
              <TableHead className="text-xs w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs">Loading…</TableCell></TableRow>
            ) : !problems?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs">No problems found</TableCell></TableRow>
            ) : (
              problems.map((p) => (
                <TableRow key={p.id} className="border-white/10">
                  <TableCell className="text-xs font-mono">{p.source_label}</TableCell>
                  <TableCell className="text-xs">{p.title}</TableCell>
                  <TableCell className="text-xs capitalize">{p.problem_type}</TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={p.status === "converted" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {p.status === "converted" ? "Converted" : "Raw"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{chapterName(p.chapter_id)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(p)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Problem" : "New Problem"}</DialogTitle>
            <DialogDescription>Fill in the problem details below.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Course</Label>
              <Select value={form.course_id} onValueChange={(v) => { patch("course_id", v); patch("chapter_id", ""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Chapter</Label>
              <Select value={form.chapter_id} onValueChange={(v) => patch("chapter_id", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select chapter" /></SelectTrigger>
                <SelectContent>
                  {chapters?.filter((c) => !form.course_id || c.course_id === form.course_id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.problem_type} onValueChange={(v) => patch("problem_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exercise">Exercise</SelectItem>
                  <SelectItem value="problem">Problem</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Source Label</Label>
              <Input value={form.source_label} onChange={(e) => patch("source_label", e.target.value)} placeholder="E13-4" className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => patch("title", e.target.value)} placeholder="Bond amortization premium" className="h-8 text-xs" />
          </div>

          <div>
            <Label className="text-xs">Problem Text</Label>
            <Textarea value={form.problem_text} onChange={(e) => patch("problem_text", e.target.value)} rows={4} className="text-xs" />
          </div>

          <div>
            <Label className="text-xs">Solution Text</Label>
            <Textarea value={form.solution_text} onChange={(e) => patch("solution_text", e.target.value)} rows={4} className="text-xs" />
          </div>

          <div>
            <Label className="text-xs">Journal Entry (optional)</Label>
            <Textarea value={form.journal_entry_text ?? ""} onChange={(e) => patch("journal_entry_text", e.target.value || null)} rows={3} className="text-xs" />
          </div>

          <div>
            <Label className="text-xs">Difficulty</Label>
            <Select value={form.difficulty_internal ?? "none"} onValueChange={(v) => patch("difficulty_internal", v === "none" ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Not set" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="tricky">Tricky</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Problem</DialogTitle>
            <DialogDescription>This will permanently remove this problem. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}

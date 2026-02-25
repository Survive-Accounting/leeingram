import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Eye, Library, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type TeachingAsset = {
  id: string;
  course_id: string;
  chapter_id: string;
  base_raw_problem_id: string | null;
  asset_name: string;
  tags: string[];
  survive_problem_text: string;
  journal_entry_block: string | null;
  survive_solution_text: string;
  created_at: string;
  updated_at: string;
};

type AssetForm = Omit<TeachingAsset, "id" | "created_at" | "updated_at">;

const EMPTY_FORM: AssetForm = {
  course_id: "",
  chapter_id: "",
  base_raw_problem_id: null,
  asset_name: "",
  tags: [],
  survive_problem_text: "",
  journal_entry_block: null,
  survive_solution_text: "",
};

export default function AssetsLibrary() {
  const qc = useQueryClient();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingAsset, setViewingAsset] = useState<TeachingAsset | null>(null);
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");

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

  const { data: assets, isLoading } = useQuery({
    queryKey: ["teaching-assets", courseFilter, chapterFilter, search],
    queryFn: async () => {
      let q = supabase.from("teaching_assets").select("*").order("created_at", { ascending: false });
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      if (search.trim()) {
        q = q.or(`asset_name.ilike.%${search.trim()}%,survive_problem_text.ilike.%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as TeachingAsset[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AssetForm & { id?: string }) => {
      if (data.id) {
        const { id, ...rest } = data;
        const { error } = await supabase.from("teaching_assets").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teaching_assets").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      setDialogOpen(false);
      toast.success(editingId ? "Asset updated" : "Asset created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teaching_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      setDeleteId(null);
      toast.success("Asset deleted");
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
    setTagInput("");
    setDialogOpen(true);
  };

  const openEdit = (a: TeachingAsset) => {
    setEditingId(a.id);
    setForm({
      course_id: a.course_id,
      chapter_id: a.chapter_id,
      base_raw_problem_id: a.base_raw_problem_id,
      asset_name: a.asset_name,
      tags: a.tags ?? [],
      survive_problem_text: a.survive_problem_text,
      journal_entry_block: a.journal_entry_block,
      survive_solution_text: a.survive_solution_text,
    });
    setTagInput("");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.course_id || !form.chapter_id) {
      toast.error("Select a course and chapter");
      return;
    }
    if (!form.asset_name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    saveMutation.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const patch = (k: keyof AssetForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      patch("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    patch("tags", form.tags.filter((t) => t !== tag));
  };

  const chapterLabel = (chId: string) => {
    const ch = chapters?.find((c) => c.id === chId);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "";
  };

  // Detail view
  if (viewingAsset) {
    return (
      <SurviveSidebarLayout>
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setViewingAsset(null)} className="text-muted-foreground hover:text-foreground">
            ← Back to Library
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">{viewingAsset.asset_name}</h1>
            <p className="text-xs text-muted-foreground mt-1">{chapterLabel(viewingAsset.chapter_id)}</p>
          </div>

          {viewingAsset.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {viewingAsset.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Survive Problem</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{viewingAsset.survive_problem_text || "—"}</p>
            </div>

            {viewingAsset.journal_entry_block && (
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Journal Entry Block</h2>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">{viewingAsset.journal_entry_block}</pre>
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Full Solution Steps</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{viewingAsset.survive_solution_text || "—"}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => { openEdit(viewingAsset); setViewingAsset(null); }}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setDeleteId(viewingAsset.id); setViewingAsset(null); }}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          Assets Library
        </h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Asset
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
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

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, tags, or problem text…"
            className="h-8 text-xs pl-7 bg-white/[0.07] border-white/10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden border border-white/10 bg-white/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-xs">Asset Name</TableHead>
              <TableHead className="text-xs">Tags</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs">Loading…</TableCell></TableRow>
            ) : !assets?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs">No assets found</TableCell></TableRow>
            ) : (
              assets.map((a) => (
                <TableRow key={a.id} className="border-white/10">
                  <TableCell className="text-xs font-medium">{a.asset_name}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {(a.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                      {(a.tags ?? []).length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{a.tags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "MMM d")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingAsset(a)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(a.id)}>
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
            <DialogTitle>{editingId ? "Edit Asset" : "New Teaching Asset"}</DialogTitle>
            <DialogDescription>Define a reusable teaching asset with problem, solution, and tags.</DialogDescription>
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
          </div>

          <div>
            <Label className="text-xs">Asset Name</Label>
            <Input value={form.asset_name} onChange={(e) => patch("asset_name", e.target.value)} placeholder="Bond Amortization — Premium" className="h-8 text-xs" />
          </div>

          <div>
            <Label className="text-xs">Tags</Label>
            <div className="flex gap-2 mb-1.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Type a tag and press Enter"
                className="h-8 text-xs flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={addTag} className="h-8 text-xs">Add</Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Survive Problem Text</Label>
            <Textarea value={form.survive_problem_text} onChange={(e) => patch("survive_problem_text", e.target.value)} rows={5} className="text-xs" placeholder="The owned practice problem students will see…" />
          </div>

          <div>
            <Label className="text-xs">Journal Entry Block (optional)</Label>
            <Textarea value={form.journal_entry_block ?? ""} onChange={(e) => patch("journal_entry_block", e.target.value || null)} rows={4} className="text-xs font-mono" placeholder="Date | Account | Debit | Credit" />
          </div>

          <div>
            <Label className="text-xs">Survive Solution Text</Label>
            <Textarea value={form.survive_solution_text} onChange={(e) => patch("survive_solution_text", e.target.value)} rows={5} className="text-xs" placeholder="Full step-by-step solution…" />
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
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>This will permanently remove this teaching asset. Continue?</DialogDescription>
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

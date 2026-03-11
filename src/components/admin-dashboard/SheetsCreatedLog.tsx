import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Search, Sheet, Archive } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const PAGE_SIZE = 25;

type ViewMode = "active" | "archived";

interface SheetAsset {
  id: string;
  asset_name: string;
  source_ref: string | null;
  course_id: string;
  chapter_id: string;
  google_sheet_status: string;
  google_sheet_url: string | null;
  sheet_master_url: string | null;
  sheet_practice_url: string | null;
  sheet_promo_url: string | null;
  created_at: string;
  course_name?: string;
  chapter_label?: string;
}

export function SheetsCreatedLog() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["sheets-created-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, course_id, chapter_id, google_sheet_status, google_sheet_url, sheet_master_url, sheet_practice_url, sheet_promo_url, created_at")
        .in("google_sheet_status", ["auto_created", "archived"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const courseIds = [...new Set((data || []).map(a => a.course_id))];
      const chapterIds = [...new Set((data || []).map(a => a.chapter_id))];

      const [{ data: courses }, { data: chapters }] = await Promise.all([
        supabase.from("courses").select("id, course_name").in("id", courseIds.length ? courseIds : ["__none__"]),
        supabase.from("chapters").select("id, chapter_number, chapter_name").in("id", chapterIds.length ? chapterIds : ["__none__"]),
      ]);

      const courseMap = new Map((courses || []).map(c => [c.id, c.course_name]));
      const chapterMap = new Map((chapters || []).map(c => [c.id, `Ch ${c.chapter_number}`]));

      return (data || []).map((a): SheetAsset => ({
        ...a,
        course_name: courseMap.get(a.course_id) || "—",
        chapter_label: chapterMap.get(a.chapter_id) || "—",
      }));
    },
  });

  const courses = useMemo(() => {
    if (!assets) return [];
    return [...new Set(assets.map(a => a.course_name!))].sort();
  }, [assets]);

  const filtered = useMemo(() => {
    if (!assets) return [];
    return assets.filter(a => {
      if (viewMode === "active" && a.google_sheet_status === "archived") return false;
      if (viewMode === "archived" && a.google_sheet_status !== "archived") return false;
      if (courseFilter !== "all" && a.course_name !== courseFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${a.asset_name} ${a.source_ref || ""} ${a.course_name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [assets, courseFilter, search, viewMode]);

  const archivedCount = useMemo(() => assets?.filter(a => a.google_sheet_status === "archived").length || 0, [assets]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pageEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageEntries.map(e => e.id)));
    }
  };

  const handleArchive = async () => {
    const selected = assets?.filter(a => selectedIds.has(a.id)) || [];
    if (selected.length === 0) return;

    setIsArchiving(true);
    try {
      const teachingAssetIds = selected.map(a => a.id);

      const { data, error } = await supabase.functions.invoke("archive-sheets", {
        body: { teaching_asset_ids: teachingAssetIds, sheet_prep_log_ids: [] },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Archived ${data.archived} sheet(s)${data.failed ? `, ${data.failed} failed` : ""}`);
      if (data.errors?.length) {
        data.errors.forEach((e: string) => toast.error(e, { duration: 5000 }));
      }

      setSelectedIds(new Set());
      setArchiveConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["sheets-created-log"] });
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
    } catch (e: any) {
      toast.error(`Archive failed: ${e.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sheets created log…
      </div>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sheet className="h-4 w-4 text-primary" /> Sheets Created Log
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {filtered.length} {filtered.length === 1 ? "sheet" : "sheets"}
            </Badge>
          </CardTitle>

          {selectedIds.size > 0 && viewMode === "active" && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{selectedIds.size} selected</Badge>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setArchiveConfirmOpen(true)}>
                <Archive className="h-3 w-3 mr-1" /> Archive Sheets
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search asset, source…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Select value={courseFilter} onValueChange={v => { setCourseFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              className={`px-3 h-9 text-xs font-medium transition-colors ${viewMode === "active" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setViewMode("active"); setPage(0); setSelectedIds(new Set()); }}
            >
              Active
            </button>
            <button
              className={`px-3 h-9 text-xs font-medium transition-colors ${viewMode === "archived" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setViewMode("archived"); setPage(0); setSelectedIds(new Set()); }}
            >
              Archived {archivedCount > 0 && `(${archivedCount})`}
            </button>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                {viewMode === "active" && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={pageEntries.length > 0 && selectedIds.size === pageEntries.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead>Asset Code</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px] text-center">Sheets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={viewMode === "active" ? 7 : 6} className="text-center text-muted-foreground py-8 text-xs">
                    {viewMode === "archived" ? "No archived sheets." : "No auto-created sheets found."}
                  </TableCell>
                </TableRow>
              )}
              {pageEntries.map(a => (
                <TableRow key={a.id}>
                  {viewMode === "active" && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(a.id)}
                        onCheckedChange={() => toggleSelect(a.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-xs font-medium text-foreground">{a.asset_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.source_ref || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.course_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.chapter_label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(a.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {viewMode === "archived" ? (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Archived</Badge>
                      ) : a.sheet_master_url ? (
                        <>
                          <a href={a.sheet_master_url} target="_blank" rel="noopener noreferrer" title="Master" className="hover:scale-110 transition-transform">📋</a>
                          {a.sheet_practice_url && (
                            <a href={a.sheet_practice_url} target="_blank" rel="noopener noreferrer" title="Practice" className="hover:scale-110 transition-transform">✏️</a>
                          )}
                          {a.sheet_promo_url && (
                            <a href={a.sheet_promo_url} target="_blank" rel="noopener noreferrer" title="Promo" className="hover:scale-110 transition-transform">📣</a>
                          )}
                        </>
                      ) : a.google_sheet_url ? (
                        <a href={a.google_sheet_url} target="_blank" rel="noopener noreferrer" title="Open Google Sheet" className="hover:scale-110 transition-transform">📋</a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Prev
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive Sheets</DialogTitle>
            <DialogDescription>
              This will move {selectedIds.size} selected sheet(s) to their Archive folders in Google Drive and mark them as archived. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setArchiveConfirmOpen(false)} disabled={isArchiving}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Archiving…</> : <><Archive className="h-3 w-3 mr-1" /> Archive</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

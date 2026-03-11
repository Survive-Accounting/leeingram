import { useState, useMemo } from "react";
import { useSheetPrepLog, useToggleSheetPrepReviewed } from "@/hooks/useSheetPrepLog";
import { useVaAccount } from "@/hooks/useVaAccount";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Search, Sheet, Archive, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 25;

type ViewMode = "active" | "archived";

export function SheetPrepLog() {
  const { data: entries, isLoading } = useSheetPrepLog();
  const toggleMutation = useToggleSheetPrepReviewed();
  const { isVa } = useVaAccount();
  const isAdmin = !isVa;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [vaFilter, setVaFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Derive filter options from non-archived entries
  const courses = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map(e => e.course_name))].sort();
  }, [entries]);

  const vas = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map(e => e.va_display_name).filter(Boolean))] as string[];
  }, [entries]);

  // Filter + search + archived
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter(e => {
      // archived filter
      if (viewMode === "active" && e.archived) return false;
      if (viewMode === "archived" && !e.archived) return false;
      if (courseFilter !== "all" && e.course_name !== courseFilter) return false;
      if (vaFilter !== "all" && e.va_display_name !== vaFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${e.asset_name} ${e.source_ref || ""} ${e.course_name} ${e.va_display_name || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, courseFilter, vaFilter, search, viewMode]);

  const archivedCount = useMemo(() => entries?.filter(e => e.archived).length || 0, [entries]);

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

  const handleMarkReviewed = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const entry = entries?.find(e => e.id === id);
      if (entry && !entry.reviewed) {
        toggleMutation.mutate({ id, reviewed: true });
      }
    }
    setSelectedIds(new Set());
    toast.success(`Marked ${ids.length} entries as reviewed`);
  };

  const handleArchive = async () => {
    const selected = entries?.filter(e => selectedIds.has(e.id)) || [];
    if (selected.length === 0) return;

    setIsArchiving(true);
    try {
      const teachingAssetIds = [...new Set(selected.map(e => e.teaching_asset_id))];
      const logIds = selected.map(e => e.id);

      const { data, error } = await supabase.functions.invoke("archive-sheets", {
        body: { teaching_asset_ids: teachingAssetIds, sheet_prep_log_ids: logIds },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Archived ${data.archived} asset sheets${data.failed ? `, ${data.failed} failed` : ""}`);
      if (data.errors?.length) {
        data.errors.forEach((e: string) => toast.error(e, { duration: 5000 }));
      }

      setSelectedIds(new Set());
      setArchiveConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["sheet-prep-log"] });
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
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sheet prep log…
      </div>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sheet className="h-4 w-4 text-primary" /> Sheet Prep Log
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </Badge>
          </CardTitle>

          {/* Admin bulk actions */}
          {isAdmin && selectedIds.size > 0 && viewMode === "active" && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{selectedIds.size} selected</Badge>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleMarkReviewed}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Reviewed
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setArchiveConfirmOpen(true)}>
                <Archive className="h-3 w-3 mr-1" /> Archive Sheets
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search asset, source, VA…"
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
          <Select value={vaFilter} onValueChange={v => { setVaFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="All VAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All VAs</SelectItem>
              {vas.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* View mode toggle */}
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

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                {isAdmin && viewMode === "active" && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={pageEntries.length > 0 && selectedIds.size === pageEntries.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[60px] text-center">Reviewed</TableHead>
                <TableHead>Asset Code</TableHead>
                <TableHead>Source Code</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>VA Account</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="w-[100px] text-center">Sheets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin && viewMode === "active" ? 8 : 7} className="text-center text-muted-foreground py-8 text-xs">
                    {viewMode === "archived" ? "No archived entries." : "No sheet prep entries found."}
                  </TableCell>
                </TableRow>
              )}
              {pageEntries.map(e => (
                <TableRow key={e.id} className={e.reviewed ? "opacity-60" : ""}>
                  {isAdmin && viewMode === "active" && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(e.id)}
                        onCheckedChange={() => toggleSelect(e.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <Checkbox
                      checked={e.reviewed}
                      disabled={toggleMutation.isPending || !isAdmin || viewMode === "archived"}
                      onCheckedChange={(checked) => {
                        if (isAdmin) {
                          toggleMutation.mutate({ id: e.id, reviewed: !!checked });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">{e.asset_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.source_ref || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.course_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.va_display_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(e.submitted_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {viewMode === "archived" ? (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Archived</Badge>
                      ) : e.sheet_master_url ? (
                        <>
                          <a href={e.sheet_master_url} target="_blank" rel="noopener noreferrer" title="Master: tutoring / filming" className="hover:scale-110 transition-transform">📋</a>
                          {e.sheet_practice_url && (
                            <a href={e.sheet_practice_url} target="_blank" rel="noopener noreferrer" title="Practice: student practice" className="hover:scale-110 transition-transform">✏️</a>
                          )}
                          {e.sheet_promo_url && (
                            <a href={e.sheet_promo_url} target="_blank" rel="noopener noreferrer" title="Promo: shareable promo" className="hover:scale-110 transition-transform">📣</a>
                          )}
                        </>
                      ) : e.google_sheet_url ? (
                        <a href={e.google_sheet_url} target="_blank" rel="noopener noreferrer" title="Open Google Sheet" className="hover:scale-110 transition-transform">📋</a>
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

        {/* Pagination */}
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

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive Sheets</DialogTitle>
            <DialogDescription>
              This will move {selectedIds.size} selected asset sheets to their respective Archive folders in Google Drive and mark them as archived. This cannot be undone.
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

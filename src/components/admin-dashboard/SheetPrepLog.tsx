import { useState, useMemo } from "react";
import { useSheetPrepLog, useToggleSheetPrepReviewed } from "@/hooks/useSheetPrepLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ExternalLink, Search, Sheet } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 25;

export function SheetPrepLog() {
  const { data: entries, isLoading } = useSheetPrepLog();
  const toggleMutation = useToggleSheetPrepReviewed();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [vaFilter, setVaFilter] = useState("all");
  const [page, setPage] = useState(0);

  // Derive filter options
  const courses = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map(e => e.course_name))].sort();
  }, [entries]);

  const vas = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map(e => e.va_display_name).filter(Boolean))] as string[];
  }, [entries]);

  // Filter + search
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter(e => {
      if (courseFilter !== "all" && e.course_name !== courseFilter) return false;
      if (vaFilter !== "all" && e.va_display_name !== vaFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${e.asset_name} ${e.source_ref || ""} ${e.course_name} ${e.va_display_name || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, courseFilter, vaFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sheet className="h-4 w-4 text-primary" /> Sheet Prep Log
          <Badge variant="secondary" className="ml-2 text-[10px]">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </Badge>
        </CardTitle>
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
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead className="w-[60px] text-center">Reviewed</TableHead>
                <TableHead>Asset Code</TableHead>
                <TableHead>Source Code</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>VA Account</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="w-[80px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">
                    No sheet prep entries found.
                  </TableCell>
                </TableRow>
              )}
              {pageEntries.map(e => (
                <TableRow key={e.id} className={e.reviewed ? "opacity-60" : ""}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={e.reviewed}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={(checked) => {
                        toggleMutation.mutate({ id: e.id, reviewed: !!checked });
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
                      {e.google_sheet_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={e.google_sheet_url} target="_blank" rel="noopener noreferrer" title="Open Google Sheet">
                            <Sheet className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={`/assets`} title="Open Asset Library">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
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
    </Card>
  );
}

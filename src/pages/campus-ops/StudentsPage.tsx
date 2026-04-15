import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import StudentDetailModal from "@/components/campus-ops/StudentDetailModal";

interface UnifiedRow {
  id: string;
  email: string;
  name: string | null;
  campus_id: string | null;
  campus_name?: string;
  status: "lead" | "active" | "expired";
  course_interest?: string;
  last_activity?: string;
  first_seen: string;
  has_student_record: boolean;
}

interface Campus { id: string; name: string; }

const PAGE_SIZE = 25;

const relTime = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
};

export default function StudentsPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UnifiedRow | null>(null);

  const fetchCampuses = useCallback(async () => {
    const { data } = await supabase.from("campuses").select("id, name").order("name");
    setCampuses(data ?? []);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const campMap: Record<string, string> = {};
    campuses.forEach(c => { campMap[c.id] = c.name; });

    // Fetch students with purchases
    const { data: students } = await supabase
      .from("students")
      .select("id, email, name, campus_id, created_at");

    const { data: purchases } = await (supabase as any)
      .from("student_purchases")
      .select("email, expires_at, course_id, courses(slug)")
      .order("created_at", { ascending: false });

    // Fetch leads from student_events
    const { data: leadEvents } = await (supabase as any)
      .from("student_events")
      .select("email, campus_id, course_slug, created_at")
      .eq("event_type", "email_captured")
      .order("created_at", { ascending: false });

    // Fetch last activity per email
    const { data: lastActivity } = await (supabase as any)
      .from("student_events")
      .select("email, created_at")
      .order("created_at", { ascending: false });

    // Build purchase map: email → { active, course }
    const purchaseMap = new Map<string, { active: boolean; course: string | null }>();
    (purchases ?? []).forEach((p: any) => {
      if (purchaseMap.has(p.email)) return; // keep first (most recent)
      const active = p.expires_at ? new Date(p.expires_at) > new Date() : false;
      purchaseMap.set(p.email, { active, course: p.courses?.slug || null });
    });

    // Build last activity map
    const activityMap = new Map<string, string>();
    (lastActivity ?? []).forEach((e: any) => {
      if (!activityMap.has(e.email)) activityMap.set(e.email, e.created_at);
    });

    // Build unified list - start with students
    const emailSet = new Set<string>();
    const unified: UnifiedRow[] = [];

    (students ?? []).forEach((s: any) => {
      emailSet.add(s.email);
      const purchase = purchaseMap.get(s.email);
      const status: UnifiedRow["status"] = purchase
        ? (purchase.active ? "active" : "expired")
        : "lead";

      unified.push({
        id: s.id,
        email: s.email,
        name: s.name,
        campus_id: s.campus_id,
        campus_name: s.campus_id ? campMap[s.campus_id] : undefined,
        status,
        course_interest: purchase?.course || undefined,
        last_activity: activityMap.get(s.email),
        first_seen: s.created_at,
        has_student_record: true,
      });
    });

    // Add leads not in students table
    const leadEmails = new Map<string, { campus_id: string | null; course_slug: string | null; created_at: string }>();
    (leadEvents ?? []).forEach((e: any) => {
      if (emailSet.has(e.email) || leadEmails.has(e.email)) return;
      leadEmails.set(e.email, { campus_id: e.campus_id, course_slug: e.course_slug, created_at: e.created_at });
    });

    leadEmails.forEach((val, email) => {
      unified.push({
        id: `lead-${email}`,
        email,
        name: null,
        campus_id: val.campus_id,
        campus_name: val.campus_id ? campMap[val.campus_id] : undefined,
        status: "lead",
        course_interest: val.course_slug || undefined,
        last_activity: activityMap.get(email),
        first_seen: val.created_at,
        has_student_record: false,
      });
    });

    // Sort by last_activity or first_seen descending
    unified.sort((a, b) => {
      const da = a.last_activity || a.first_seen;
      const db = b.last_activity || b.first_seen;
      return new Date(db).getTime() - new Date(da).getTime();
    });

    // Apply filters
    let filtered = unified;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r => r.email.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q));
    }
    if (campusFilter !== "all") {
      filtered = filtered.filter(r => r.campus_id === campusFilter);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    setTotal(filtered.length);
    setRows(filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
    setLoading(false);
  }, [search, campusFilter, statusFilter, page, campuses]);

  useEffect(() => { fetchCampuses(); }, [fetchCampuses]);
  useEffect(() => { if (campuses.length >= 0) fetchData(); }, [fetchData]);

  const handleDelete = async (row: UnifiedRow) => {
    if (!row.has_student_record) return;
    await supabase.from("students").delete().eq("id", row.id);
    toast.success("Student removed");
    fetchData();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusBadge = (s: UnifiedRow["status"]) => {
    switch (s) {
      case "active": return <Badge className="bg-green-600 text-[10px]">Active</Badge>;
      case "expired": return <Badge variant="secondary" className="text-[10px]">Expired</Badge>;
      case "lead": return <Badge className="bg-yellow-500 text-[10px]">Lead</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Students & Leads</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search by email…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="sm:w-64" />
        <Select value={campusFilter} onValueChange={v => { setCampusFilter(v); setPage(0); }}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campuses</SelectItem>
            {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center ml-auto">{total} result{total !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No results.</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                    <TableCell className="font-medium text-sm">{r.email}</TableCell>
                    <TableCell className="text-sm">{r.name || "—"}</TableCell>
                    <TableCell className="text-sm">{r.campus_name || "—"}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.course_interest || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.last_activity ? relTime(r.last_activity) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.first_seen).toLocaleDateString()}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {r.has_student_record && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete student?</AlertDialogTitle>
                              <AlertDialogDescription>Remove {r.email} from the students table. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(r)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {selected && (
        <StudentDetailModal
          open={!!selected}
          onClose={() => setSelected(null)}
          email={selected.email}
          name={selected.name}
          campusName={selected.campus_name}
        />
      )}
    </div>
  );
}

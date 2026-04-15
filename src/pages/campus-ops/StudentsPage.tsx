import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import StudentDetailModal from "@/components/campus-ops/StudentDetailModal";

interface StudentRow {
  id: string;
  email: string;
  name: string | null;
  campus_id: string | null;
  created_at: string;
  campus_name?: string;
}

interface Campus { id: string; name: string; }

const PAGE_SIZE = 25;

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const fetchCampuses = useCallback(async () => {
    const { data } = await supabase.from("campuses").select("id, name").order("name");
    setCampuses(data ?? []);
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("students").select("id, email, name, campus_id, created_at", { count: "exact" });
    if (search.trim()) q = q.ilike("email", `%${search.trim()}%`);
    if (campusFilter !== "all") q = q.eq("campus_id", campusFilter);
    q = q.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count } = await q;
    setTotal(count ?? 0);

    // map campus names
    const campMap: Record<string, string> = {};
    campuses.forEach(c => { campMap[c.id] = c.name; });
    setStudents((data ?? []).map(s => ({ ...s, campus_name: s.campus_id ? campMap[s.campus_id] : undefined })));
    setLoading(false);
  }, [search, campusFilter, page, campuses]);

  useEffect(() => { fetchCampuses(); }, [fetchCampuses]);
  useEffect(() => { if (campuses.length >= 0) fetchStudents(); }, [fetchStudents]);

  const handleDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Student removed");
    fetchStudents();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Students</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search by email…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="sm:w-64" />
        <Select value={campusFilter} onValueChange={v => { setCampusFilter(v); setPage(0); }}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campuses</SelectItem>
            {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center ml-auto">{total} student{total !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No students yet.</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s)}>
                    <TableCell className="font-medium text-sm">{s.email}</TableCell>
                    <TableCell className="text-sm">{s.name || "—"}</TableCell>
                    <TableCell className="text-sm">{s.campus_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete student?</AlertDialogTitle>
                            <AlertDialogDescription>Remove {s.email} from the students table. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(s.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";
const fmtCents = (c: number | null) => c != null ? `$${(c / 100).toFixed(2)}` : "—";

interface Campus { id: string; name: string; }

export default function PurchasesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("campuses").select("id, name").order("name").then(({ data }) => setCampuses(data ?? []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("student_purchases").select("id, email, campus_id, course_id, purchase_type, price_paid_cents, expires_at, created_at", { count: "exact" });
    if (search.trim()) q = q.ilike("email", `%${search.trim()}%`);
    if (campusFilter !== "all") q = q.eq("campus_id", campusFilter);
    if (statusFilter === "active") q = q.gt("expires_at", new Date().toISOString());
    if (statusFilter === "expired") q = q.lt("expires_at", new Date().toISOString());
    q = q.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count } = await q;
    setTotal(count ?? 0);
    const campMap: Record<string, string> = {};
    campuses.forEach(c => { campMap[c.id] = c.name; });
    setRows((data ?? []).map(r => ({ ...r, campus_name: r.campus_id ? campMap[r.campus_id] : undefined })));
    setLoading(false);
  }, [search, campusFilter, statusFilter, page, campuses]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isActive = (exp: string | null) => exp ? new Date(exp) > new Date() : false;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Purchases</h1>

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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center ml-auto">{total} purchase{total !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No purchases yet.</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Purchased</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.email || "—"}</TableCell>
                    <TableCell className="text-sm">{r.campus_name || "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{r.purchase_type?.replace(/_/g, " ") || "—"}</TableCell>
                    <TableCell className="text-sm">{fmtCents(r.price_paid_cents)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isActive(r.expires_at) ? "default" : "secondary"} className={isActive(r.expires_at) ? "bg-green-600" : ""}>
                        {isActive(r.expires_at) ? "Active" : "Expired"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.expires_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

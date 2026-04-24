import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ExternalLink } from "lucide-react";
import CampusDetailModal from "@/components/campus-ops/CampusDetailModal";

interface CampusRow {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  is_active: boolean;
  created_at: string;
  paidCount: number;
  leadCount: number;
}

export default function CampusesPage() {
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CampusRow | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("campuses")
        .select("id, name, slug, domains, is_active, created_at")
        .order("created_at", { ascending: false });

      if (!rows) { setLoading(false); return; }

      const ids = rows.map(r => r.id);
      const [{ data: students }, { data: purchases }] = await Promise.all([
        supabase.from("students").select("id, campus_id, email").in("campus_id", ids),
        (supabase as any).from("student_purchases").select("email, campus_id").in("campus_id", ids),
      ]);

      // paid emails per campus
      const paidByCampus: Record<string, Set<string>> = {};
      (purchases ?? []).forEach((p: any) => {
        if (!p.campus_id || !p.email) return;
        (paidByCampus[p.campus_id] ||= new Set()).add(p.email.toLowerCase());
      });

      // students per campus, split into paid vs lead
      const paidCount: Record<string, number> = {};
      const leadCount: Record<string, number> = {};
      (students ?? []).forEach((s: any) => {
        if (!s.campus_id) return;
        const isPaid = paidByCampus[s.campus_id]?.has((s.email || "").toLowerCase());
        if (isPaid) paidCount[s.campus_id] = (paidCount[s.campus_id] || 0) + 1;
        else leadCount[s.campus_id] = (leadCount[s.campus_id] || 0) + 1;
      });

      setCampuses(rows.map(r => ({
        ...r,
        paidCount: paidCount[r.id] || 0,
        leadCount: leadCount[r.id] || 0,
      })));
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Campuses</h1>
        <Button size="sm" onClick={() => navigate("/campus-ops/campuses/new")}>
          <Plus className="w-4 h-4 mr-1" /> Add Campus
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : campuses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No campuses yet. Add your first campus to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead className="text-center">Paid</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Landing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campuses.map(c => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(c)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{c.slug}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{c.domains?.join(", ") || "—"}</TableCell>
                  <TableCell className="text-center">{c.studentCount}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.is_active ? "default" : "secondary"} className={c.is_active ? "bg-green-600" : ""}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <a
                      href={`/campus/${c.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selected && (
        <CampusDetailModal
          open={!!selected}
          onClose={() => setSelected(null)}
          campusId={selected.id}
          campusName={selected.name}
          campusSlug={selected.slug}
          domains={selected.domains}
          isActive={selected.is_active}
          createdAt={selected.created_at}
        />
      )}
    </div>
  );
}

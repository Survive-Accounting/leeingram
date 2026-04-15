import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

interface CampusRow {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  is_active: boolean;
  created_at: string;
  studentCount: number;
}

export default function CampusesPage() {
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("campuses")
        .select("id, name, slug, domains, is_active, created_at")
        .order("created_at", { ascending: false });

      if (!rows) { setLoading(false); return; }

      // fetch student counts per campus
      const { data: counts } = await supabase
        .from("students")
        .select("campus_id")
        .in("campus_id", rows.map(r => r.id));

      const countMap: Record<string, number> = {};
      (counts ?? []).forEach((s: any) => {
        countMap[s.campus_id] = (countMap[s.campus_id] || 0) + 1;
      });

      setCampuses(rows.map(r => ({ ...r, studentCount: countMap[r.id] || 0 })));
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
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campuses.map(c => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/campus-ops/campuses/${c.slug}`)}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

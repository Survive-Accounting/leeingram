import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

interface PricingRow {
  id: string;
  campus_id: string | null;
  product_type: string;
  price_cents: number;
  label: string | null;
  is_active: boolean;
  campus_name?: string;
}

interface Campus {
  id: string;
  name: string;
  slug: string;
}

const PRODUCT_LABELS: Record<string, string> = {
  semester_pass: "Semester Pass",
  chapter_pass: "Chapter Pass",
};

const centsToStr = (c: number) => (c / 100).toFixed(2);
const strToCents = (s: string) => Math.round(parseFloat(s || "0") * 100);

export default function PricingPage() {
  const [globals, setGlobals] = useState<PricingRow[]>([]);
  const [overrides, setOverrides] = useState<PricingRow[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Add form state
  const [newCampusId, setNewCampusId] = useState("");
  const [newProductType, setNewProductType] = useState("semester_pass");
  const [newPrice, setNewPrice] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [addSaving, setAddSaving] = useState(false);

  const fetchAll = async () => {
    const [{ data: pricing }, { data: camps }] = await Promise.all([
      supabase.from("campus_pricing").select("*").order("product_type"),
      supabase.from("campuses").select("id, name, slug").order("name"),
    ]);
    setCampuses(camps ?? []);
    const campMap: Record<string, string> = {};
    (camps ?? []).forEach(c => { campMap[c.id] = c.name; });

    const rows = (pricing ?? []).map(r => ({ ...r, campus_name: r.campus_id ? campMap[r.campus_id] : undefined }));
    setGlobals(rows.filter(r => !r.campus_id));
    setOverrides(rows.filter(r => r.campus_id));

    const ev: Record<string, string> = {};
    rows.filter(r => !r.campus_id).forEach(r => { ev[r.id] = centsToStr(r.price_cents); });
    setEditValues(ev);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveGlobals = async () => {
    setSaving(true);
    for (const g of globals) {
      const newCents = strToCents(editValues[g.id] || "0");
      if (newCents !== g.price_cents) {
        await supabase.from("campus_pricing").update({ price_cents: newCents }).eq("id", g.id);
      }
    }
    toast.success("Global pricing updated");
    await fetchAll();
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!newCampusId || !newPrice) { toast.error("Campus and price are required"); return; }
    setAddSaving(true);
    const { error } = await supabase.from("campus_pricing").insert({
      campus_id: newCampusId,
      product_type: newProductType,
      price_cents: strToCents(newPrice),
      label: newLabel.trim() || null,
      is_active: newActive,
    });
    setAddSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campus pricing added");
    setAddOpen(false);
    setNewCampusId(""); setNewPrice(""); setNewLabel("");
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("campus_pricing").delete().eq("id", id);
    toast.success("Pricing removed");
    fetchAll();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Pricing</h1>
        <p className="text-sm text-muted-foreground">Manage global and campus-specific pricing</p>
      </div>

      {/* Global Defaults */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Global Defaults</CardTitle>
          <p className="text-xs text-muted-foreground">Applied when no campus-specific price exists</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {globals.map(g => (
            <div key={g.id} className="flex items-center gap-4">
              <Label className="w-32 shrink-0 text-sm">{PRODUCT_LABELS[g.product_type] || g.product_type}</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  className="w-28"
                  value={editValues[g.id] ?? ""}
                  onChange={e => setEditValues(prev => ({ ...prev, [g.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
          <Button size="sm" onClick={handleSaveGlobals} disabled={saving}>
            {saving ? "Saving…" : "Update Global Pricing"}
          </Button>
        </CardContent>
      </Card>

      {/* Campus Overrides */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Campus Pricing Overrides</h2>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Campus Pricing</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Campus Pricing</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Campus</Label>
                  <Select value={newCampusId} onValueChange={setNewCampusId}>
                    <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
                    <SelectContent>
                      {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Product Type</Label>
                  <Select value={newProductType} onValueChange={setNewProductType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semester_pass">Semester Pass</SelectItem>
                      <SelectItem value="chapter_pass">Chapter Pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Price ($)</Label>
                  <Input placeholder="125.00" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Label (optional)</Label>
                  <Input placeholder="First Semester Special" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={newActive} onCheckedChange={setNewActive} />
                </div>
                <Button className="w-full" onClick={handleAdd} disabled={addSaving}>
                  {addSaving ? "Adding…" : "Add Pricing"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No campus-specific pricing yet.</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campus</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.campus_name || "—"}</TableCell>
                    <TableCell>{PRODUCT_LABELS[o.product_type] || o.product_type}</TableCell>
                    <TableCell>${centsToStr(o.price_cents)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.label || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={o.is_active ? "default" : "secondary"} className={o.is_active ? "bg-green-600" : ""}>
                        {o.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

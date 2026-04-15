import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays, isPast, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CalendarIcon } from "lucide-react";

interface PricingRow {
  id: string;
  campus_id: string | null;
  product_type: string;
  price_cents: number;
  anchor_price_cents: number | null;
  discount_percent: number | null;
  discount_label: string | null;
  valid_from: string | null;
  valid_until: string | null;
  label: string | null;
  is_active: boolean;
  campus_name?: string;
}

interface Campus {
  id: string;
  name: string;
  slug: string;
}

interface GlobalEdit {
  anchor: string;
  discount: string;
  discountLabel: string;
  validUntil: Date | undefined;
}

const PRODUCT_LABELS: Record<string, string> = {
  semester_pass: "Semester Pass",
  chapter_pass: "Chapter Pass",
};

const DISCOUNT_OPTIONS = ["0", "10", "20", "25", "30", "40", "50", "custom"];

const centsToStr = (c: number) => (c / 100).toFixed(2);
const strToCents = (s: string) => Math.round(parseFloat(s || "0") * 100);

function calcFinal(anchorCents: number, discountPct: number, validUntil: string | null): number {
  if (discountPct <= 0) return anchorCents;
  if (validUntil && isPast(parseISO(validUntil))) return anchorCents;
  return Math.round(anchorCents * (1 - discountPct / 100));
}

function ExpiryBadge({ validUntil }: { validUntil: string | null }) {
  if (!validUntil) return null;
  const d = parseISO(validUntil);
  if (isPast(d)) return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  const days = differenceInDays(d, new Date());
  if (days <= 7) return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Expires in {days}d</Badge>;
  return null;
}

export default function PricingPage() {
  const [globals, setGlobals] = useState<PricingRow[]>([]);
  const [overrides, setOverrides] = useState<PricingRow[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalEdits, setGlobalEdits] = useState<Record<string, GlobalEdit>>({});
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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

    const rows = (pricing ?? []).map((r: any) => ({ ...r, campus_name: r.campus_id ? campMap[r.campus_id] : undefined }));
    setGlobals(rows.filter((r: any) => !r.campus_id));
    setOverrides(rows.filter((r: any) => r.campus_id));

    const edits: Record<string, GlobalEdit> = {};
    rows.filter((r: any) => !r.campus_id).forEach((r: any) => {
      const anchor = r.anchor_price_cents ?? r.price_cents;
      const pct = r.discount_percent ?? 0;
      edits[r.id] = {
        anchor: centsToStr(anchor),
        discount: DISCOUNT_OPTIONS.includes(String(pct)) ? String(pct) : "custom",
        discountLabel: r.discount_label ?? "",
        validUntil: r.valid_until ? parseISO(r.valid_until) : undefined,
      };
    });
    setGlobalEdits(edits);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const getEditPct = (id: string): number => {
    const e = globalEdits[id];
    if (!e) return 0;
    if (e.discount === "custom") return 0;
    return parseInt(e.discount) || 0;
  };

  const handleSaveGlobals = async () => {
    setSaving(true);
    for (const g of globals) {
      const e = globalEdits[g.id];
      if (!e) continue;
      const anchorCents = strToCents(e.anchor);
      const pct = e.discount === "custom" ? 0 : parseInt(e.discount) || 0;
      const finalCents = calcFinal(anchorCents, pct, e.validUntil?.toISOString() ?? null);
      await supabase.from("campus_pricing").update({
        anchor_price_cents: anchorCents,
        price_cents: finalCents,
        discount_percent: pct,
        discount_label: e.discountLabel.trim() || null,
        valid_until: e.validUntil ? e.validUntil.toISOString() : null,
      } as any).eq("id", g.id);
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

  const updateEdit = (id: string, patch: Partial<GlobalEdit>) => {
    setGlobalEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Pricing</h1>
        <p className="text-sm text-muted-foreground">Manage global and campus-specific pricing</p>
      </div>

      {/* Global Pricing & Discounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Global Pricing & Discounts</CardTitle>
          <p className="text-xs text-muted-foreground">Applied when no campus-specific price exists</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {globals.map(g => {
            const e = globalEdits[g.id];
            if (!e) return null;
            const anchorCents = strToCents(e.anchor);
            const pct = getEditPct(g.id);
            const finalCents = calcFinal(anchorCents, pct, e.validUntil?.toISOString() ?? null);
            const isExpired = e.validUntil && isPast(e.validUntil);

            return (
              <div key={g.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{PRODUCT_LABELS[g.product_type] || g.product_type}</span>
                  <ExpiryBadge validUntil={e.validUntil?.toISOString() ?? null} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Base Price */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Base Price</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        className="w-28"
                        value={e.anchor}
                        onChange={ev => updateEdit(g.id, { anchor: ev.target.value })}
                      />
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Discount</Label>
                    <Select value={e.discount} onValueChange={v => updateEdit(g.id, { discount: v })}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="10">10% off</SelectItem>
                        <SelectItem value="20">20% off</SelectItem>
                        <SelectItem value="25">25% off</SelectItem>
                        <SelectItem value="30">30% off</SelectItem>
                        <SelectItem value="40">40% off</SelectItem>
                        <SelectItem value="50">50% off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Expiry */}
                  {pct > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Discount Expires</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-44 justify-start text-left font-normal", !e.validUntil && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {e.validUntil ? format(e.validUntil, "MMM d, yyyy") : "No expiry"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={e.validUntil}
                            onSelect={d => updateEdit(g.id, { validUntil: d })}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                {/* Discount Label */}
                {pct > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Discount Label</Label>
                    <Input
                      className="w-64"
                      placeholder="e.g. Finals Special"
                      value={e.discountLabel}
                      onChange={ev => updateEdit(g.id, { discountLabel: ev.target.value })}
                    />
                  </div>
                )}

                {/* Final Price */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Final price:</span>
                  {pct > 0 && !isExpired && (
                    <span className="text-sm line-through text-muted-foreground">${centsToStr(anchorCents)}</span>
                  )}
                  <span className="text-lg font-semibold">${centsToStr(finalCents)}</span>
                  {isExpired && pct > 0 && (
                    <span className="text-xs text-muted-foreground">(discount expired — showing base price)</span>
                  )}
                </div>
              </div>
            );
          })}
          <Button size="sm" onClick={handleSaveGlobals} disabled={saving}>
            {saving ? "Saving…" : "Save Global Pricing"}
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

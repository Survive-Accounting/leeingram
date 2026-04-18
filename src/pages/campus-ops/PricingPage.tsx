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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, CalendarIcon, Copy, Pencil, ArrowRightLeft, TrendingUp, Users, Crown, CheckCircle2 } from "lucide-react";

// ─── Expansion Pricing Strategies (Mock Data) ──────────────────────────────
interface MockConfig {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  tiers: { label: string; price: number }[];
}

const MOCK_CONFIGS: MockConfig[] = [
  {
    id: "standard",
    name: "Standard Founding",
    description: "Default ladder for new campuses. First student $25, scales to $250.",
    is_default: true,
    tiers: [
      { label: "#1", price: 25 },
      { label: "#2-5", price: 50 },
      { label: "#6-10", price: 75 },
      { label: "#11-25", price: 100 },
      { label: "#26-50", price: 125 },
      { label: "#51-100", price: 150 },
      { label: "#101-200", price: 175 },
      { label: "#201+", price: 250 },
    ],
  },
  {
    id: "aggressive",
    name: "Aggressive Founding",
    description: "$10 cheaper at every tier — for campuses that need a stronger pull.",
    is_default: false,
    tiers: [
      { label: "#1", price: 15 },
      { label: "#2-5", price: 40 },
      { label: "#6-10", price: 65 },
      { label: "#11-25", price: 90 },
      { label: "#26-50", price: 115 },
      { label: "#51-100", price: 140 },
      { label: "#101-200", price: 165 },
      { label: "#201+", price: 240 },
    ],
  },
  {
    id: "greek",
    name: "Greek Org Special",
    description: "Bulk pricing for sororities & fraternities buying in cohorts.",
    is_default: false,
    tiers: [
      { label: "#1", price: 20 },
      { label: "#2-5", price: 45 },
      { label: "#6-10", price: 70 },
      { label: "#11-25", price: 95 },
      { label: "#26-50", price: 120 },
      { label: "#51-100", price: 145 },
      { label: "#101-200", price: 170 },
      { label: "#201+", price: 245 },
    ],
  },
];

const MOCK_ASSIGNMENTS = [
  { campus: "Ole Miss", config: "Standard Founding", enrolled: 5, tier: "Tier 2", price: 50 },
];

const MOCK_PERFORMANCE = [
  { config: "Standard Founding", campuses: 1, weekly: 2.4, revenue: 245, score: "—" },
  { config: "Aggressive Founding", campuses: 0, weekly: 0, revenue: 0, score: "—" },
  { config: "Greek Org Special", campuses: 0, weekly: 0, revenue: 0, score: "—" },
];

interface MockGreekConfig {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  tiers: { label: string; price: number }[];
  min_seats: number;
  founding_discount: string;
  includes_badge: boolean;
  rules: string[];
}

const MOCK_GREEK_CONFIGS: MockGreekConfig[] = [
  {
    id: "greek-standard",
    name: "Standard Greek Founding",
    description: "Founding fraternity & sorority unlock free first month, then per-seat pricing.",
    is_default: true,
    tiers: [
      { label: "5-9 seats", price: 22 },
      { label: "10-19 seats", price: 18 },
      { label: "20-49 seats", price: 15 },
      { label: "50+ seats", price: 12 },
    ],
    min_seats: 5,
    founding_discount: "Free first month",
    includes_badge: true,
    rules: [
      "First fraternity: FREE first month, then per-seat pricing",
      "First sorority: FREE first month, then per-seat pricing",
      "Orgs 3-5: 50% off first semester",
      "Orgs 6+: standard per-seat pricing",
      "Founding badge: included for first 2 orgs",
    ],
  },
  {
    id: "greek-aggressive",
    name: "Aggressive Greek Founding",
    description: "Steeper discounts to land Greek orgs faster on new campuses.",
    is_default: false,
    tiers: [
      { label: "5-9 seats", price: 15 },
      { label: "10-19 seats", price: 12 },
      { label: "20-49 seats", price: 10 },
      { label: "50+ seats", price: 8 },
    ],
    min_seats: 5,
    founding_discount: "Free first 2 months",
    includes_badge: true,
    rules: [
      "First 4 orgs: FREE first 2 months",
      "Orgs 5-10: 60% off first semester",
      "Orgs 11+: 25% off semester pricing",
      "Founding badge: included for first 4 orgs",
    ],
  },
];

const MockBadge = () => (
  <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
    Mock Data
  </span>
);

function ExpansionPricingStrategies() {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="rounded-lg bg-[#14213D] text-white px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Expansion Pricing Strategies</h2>
          <p className="text-sm text-white/70 mt-1">
            Configure founding student pricing per campus. This is your primary growth lever.
          </p>
        </div>
        <Button className="bg-white text-[#14213D] hover:bg-white/90">
          <Plus className="w-4 h-4 mr-1" /> New Config
        </Button>
      </div>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual"><Users className="w-3.5 h-3.5 mr-1.5" /> Individual Students</TabsTrigger>
          <TabsTrigger value="greek"><Crown className="w-3.5 h-3.5 mr-1.5" /> Greek Organizations</TabsTrigger>
        </TabsList>

        {/* ── INDIVIDUAL STUDENTS TAB ─────────────────────────────────── */}
        <TabsContent value="individual" className="space-y-6 mt-4">
          {/* Two columns: Configs + Assignments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT — Configs */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pricing Configs
              </h3>
              {MOCK_CONFIGS.map(cfg => (
                <Card key={cfg.id} className="relative">
                  <MockBadge />
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold">{cfg.name}</h4>
                          {cfg.is_default && (
                            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {cfg.tiers.map(t => (
                        <span
                          key={t.label}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs font-medium"
                        >
                          <span className="text-muted-foreground">{t.label}:</span>
                          <span>${t.price}</span>
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline">
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline">
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Assign to Campus
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* RIGHT — Campus Assignments */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Campus Assignments
              </h3>
              <Card className="relative">
                <MockBadge />
                <CardContent className="p-0 pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campus</TableHead>
                        <TableHead>Config</TableHead>
                        <TableHead className="text-center">Enrolled</TableHead>
                        <TableHead>Current Tier</TableHead>
                        <TableHead className="w-32" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_ASSIGNMENTS.map(a => (
                        <TableRow key={a.campus}>
                          <TableCell className="font-medium">{a.campus}</TableCell>
                          <TableCell className="text-sm">{a.config}</TableCell>
                          <TableCell className="text-center">{a.enrolled}</TableCell>
                          <TableCell className="text-sm">
                            {a.tier} <span className="text-muted-foreground">(${a.price})</span>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">Change Config</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Performance Scoring */}
          <Card className="relative overflow-hidden">
            <MockBadge />
            <div className="bg-[#14213D] text-white px-6 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Config Performance</h3>
              </div>
              <p className="text-sm text-white/70 mt-1">Which strategy converts fastest?</p>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Config Name</TableHead>
                    <TableHead className="text-center">Campuses Using</TableHead>
                    <TableHead className="text-center">Avg Students/Week</TableHead>
                    <TableHead className="text-center">Avg Revenue/Campus</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_PERFORMANCE.map(p => (
                    <TableRow key={p.config}>
                      <TableCell className="font-medium">{p.config}</TableCell>
                      <TableCell className="text-center">{p.campuses}</TableCell>
                      <TableCell className="text-center">{p.weekly.toFixed(1)}</TableCell>
                      <TableCell className="text-center">${p.revenue}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{p.score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground px-6 py-3 border-t">
                * Scoring activates at 50+ students
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── GREEK ORGANIZATIONS TAB ─────────────────────────────────── */}
        <TabsContent value="greek" className="space-y-6 mt-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Greek Org Pricing Configs
            </h3>
            {MOCK_GREEK_CONFIGS.map(cfg => (
              <Card key={cfg.id} className="relative">
                <MockBadge />
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold">{cfg.name}</h4>
                        {cfg.is_default && (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">Default</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Per-Seat Tiers</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cfg.tiers.map(t => (
                          <span key={t.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border text-xs font-medium">
                            <span className="text-muted-foreground">{t.label}:</span>
                            <span>${t.price}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 space-y-1">
                      <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Settings</p>
                      <p><span className="text-muted-foreground">Min seats / org:</span> <span className="font-medium">{cfg.min_seats}</span></p>
                      <p><span className="text-muted-foreground">Founding org discount:</span> <span className="font-medium">{cfg.founding_discount}</span></p>
                      <p><span className="text-muted-foreground">Founding badge:</span> <span className="font-medium">{cfg.includes_badge ? "Included" : "—"}</span></p>
                    </div>
                  </div>

                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {cfg.rules.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline"><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                    <Button size="sm" variant="outline"><ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Assign to Campus</Button>
                    <Button size="sm" variant="ghost"><Copy className="w-3.5 h-3.5 mr-1" /> Duplicate</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Founding Greek Orgs — Ole Miss */}
          <Card className="relative overflow-hidden">
            <MockBadge />
            <div className="bg-[#14213D] text-white px-6 py-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Founding Greek Orgs — Ole Miss</h3>
              </div>
              <p className="text-sm text-white/70 mt-1">First fraternity & sorority to onboard get founding status.</p>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Founding Fraternity — claimed */}
                <div className="rounded-lg border-2 border-green-600/30 bg-green-50 p-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Founding Fraternity</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">DKE</span>
                    <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">🏅 Founding Frat</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Claimed Apr 2026
                  </p>
                </div>

                {/* Founding Sorority — available */}
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Founding Sorority</p>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-muted-foreground">Not yet claimed</span>
                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">Available</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    First sorority to sign up gets founding status + free first month.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

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

      <ExpansionPricingStrategies />
    </div>
  );
}

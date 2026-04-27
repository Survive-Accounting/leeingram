import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Save } from "lucide-react";

type Business = {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  is_active: boolean;
  notes: string | null;
};

type ChapterDomain = {
  id: string;
  chapter_id: string;
  domain: string;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_code: string;
  course_name: string;
};

const DOMAIN_OPTIONS = [
  "retail",
  "manufacturing",
  "services",
  "professional",
  "tech",
  "hospitality",
  "construction",
  "real_estate",
  "logistics",
  "automotive",
  "healthcare",
];

export default function YouFormatAdmin() {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [chapterDomains, setChapterDomains] = useState<ChapterDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBiz, setNewBiz] = useState({ name: "", domain: "retail", description: "" });

  const load = async () => {
    setLoading(true);
    const [bizRes, chapRes, mapRes] = await Promise.all([
      supabase.from("you_format_businesses").select("*").order("domain").order("name"),
      supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, courses!inner(code, course_name)")
        .order("chapter_number"),
      supabase.from("you_format_chapter_domains").select("*"),
    ]);
    if (bizRes.data) setBusinesses(bizRes.data as Business[]);
    if (mapRes.data) setChapterDomains(mapRes.data as ChapterDomain[]);
    if (chapRes.data) {
      const flat: ChapterRow[] = (chapRes.data as any[]).map((r) => ({
        id: r.id,
        chapter_number: r.chapter_number,
        chapter_name: r.chapter_name,
        course_code: r.courses?.code ?? "",
        course_name: r.courses?.course_name ?? "",
      }));
      setChapters(flat);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, Business[]>();
    for (const b of businesses) {
      if (!m.has(b.domain)) m.set(b.domain, []);
      m.get(b.domain)!.push(b);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [businesses]);

  const COURSE_CODES = ["INTRO1", "INTRO2", "IA1", "IA2"] as const;
  const COURSE_LABELS: Record<string, string> = {
    INTRO1: "Intro Accounting 1",
    INTRO2: "Intro Accounting 2",
    IA1: "Intermediate Accounting 1",
    IA2: "Intermediate Accounting 2",
  };
  const introChapters = useMemo(
    () => chapters.filter((c) => (COURSE_CODES as readonly string[]).includes(c.course_code)),
    [chapters]
  );

  const domainsForChapter = (chapterId: string) =>
    chapterDomains.filter((d) => d.chapter_id === chapterId).map((d) => d.domain);

  const addBusiness = async () => {
    if (!newBiz.name.trim()) return;
    const { error } = await supabase.from("you_format_businesses").insert({
      name: newBiz.name.trim(),
      domain: newBiz.domain,
      description: newBiz.description.trim() || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNewBiz({ name: "", domain: "retail", description: "" });
    toast({ title: "Business added" });
    load();
  };

  const updateBusiness = async (id: string, patch: Partial<Business>) => {
    const { error } = await supabase.from("you_format_businesses").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const deleteBusiness = async (id: string) => {
    if (!confirm("Delete this business?")) return;
    const { error } = await supabase.from("you_format_businesses").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    load();
  };

  const toggleChapterDomain = async (chapterId: string, domain: string, on: boolean) => {
    if (on) {
      const { error } = await supabase
        .from("you_format_chapter_domains")
        .insert({ chapter_id: chapterId, domain });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("you_format_chapter_domains")
        .delete()
        .eq("chapter_id", chapterId)
        .eq("domain", domain);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }
    load();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Helmet>
        <title>You-Format Admin · Survive Accounting</title>
      </Helmet>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">You-Format Admin</h1>
          <p className="text-muted-foreground mt-1">
            Curate the business library, map chapters to domains, then generate &amp; QA you-format rewrites.
          </p>
        </div>

        <Tabs defaultValue="qa">
          <TabsList>
            <TabsTrigger value="qa">Generation &amp; QA</TabsTrigger>
            <TabsTrigger value="businesses">Business Library ({businesses.length})</TabsTrigger>
            <TabsTrigger value="mapping">Chapter → Domain Mapping</TabsTrigger>
          </TabsList>

          <TabsContent value="qa">
            <YouFormatQA chapters={introChapters} chapterDomains={chapterDomains} />
          </TabsContent>

          <TabsContent value="businesses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add a business</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <Label>Name</Label>
                  <Input
                    value={newBiz.name}
                    onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })}
                    placeholder="e.g. Northpine Outfitters"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Domain</Label>
                  <Select
                    value={newBiz.domain}
                    onValueChange={(v) => setNewBiz({ ...newBiz, domain: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOMAIN_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-5">
                  <Label>Description</Label>
                  <Input
                    value={newBiz.description}
                    onChange={(e) => setNewBiz({ ...newBiz, description: e.target.value })}
                    placeholder="One-line description"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button onClick={addBusiness} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loading && <p className="text-muted-foreground">Loading…</p>}

            {grouped.map(([domain, list]) => (
              <Card key={domain}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="secondary">{domain}</Badge>
                    <span className="text-muted-foreground text-sm">({list.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.map((b) => (
                    <BusinessRow
                      key={b.id}
                      biz={b}
                      onUpdate={updateBusiness}
                      onDelete={deleteBusiness}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="mapping" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Toggle which business domains the rewriter is allowed to draw from for each chapter.
              Chapters with no domains selected will fall back to all domains.
            </p>
            {COURSE_CODES.map((code) => {
              const list = introChapters.filter((c) => c.course_code === code);
              if (!list.length) return null;
              return (
                <Card key={code}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {COURSE_LABELS[code]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {list.map((c) => {
                      const active = domainsForChapter(c.id);
                      return (
                        <div key={c.id} className="border rounded p-3">
                          <div className="font-medium mb-2">
                            Ch {c.chapter_number} — {c.chapter_name}
                            {active.length > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({active.length} domain{active.length === 1 ? "" : "s"})
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {DOMAIN_OPTIONS.map((d) => {
                              const on = active.includes(d);
                              return (
                                <button
                                  key={d}
                                  onClick={() => toggleChapterDomain(c.id, d, !on)}
                                  className={`text-xs px-2 py-1 rounded border transition ${
                                    on
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background hover:bg-muted border-border"
                                  }`}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BusinessRow({
  biz,
  onUpdate,
  onDelete,
}: {
  biz: Business;
  onUpdate: (id: string, patch: Partial<Business>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(biz.name);
  const [description, setDescription] = useState(biz.description ?? "");
  const dirty = name !== biz.name || description !== (biz.description ?? "");

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-b pb-2 last:border-0">
      <Input
        className="md:col-span-3"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        className="md:col-span-6"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <div className="md:col-span-1 flex items-center gap-1">
        <Switch
          checked={biz.is_active}
          onCheckedChange={(v) => onUpdate(biz.id, { is_active: v })}
        />
        <span className="text-xs text-muted-foreground">{biz.is_active ? "On" : "Off"}</span>
      </div>
      <div className="md:col-span-2 flex justify-end gap-1">
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate(biz.id, { name, description: description || null })}
          >
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDelete(biz.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Generation & QA tab
// ─────────────────────────────────────────────────────────────────────────

type AssetQA = {
  id: string;
  asset_name: string;
  survive_problem_text: string | null;
  problem_text_backup: string | null;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  instruction_4: string | null;
  instruction_5: string | null;
  you_problem_text: string | null;
  you_instruction_1: string | null;
  you_instruction_2: string | null;
  you_instruction_3: string | null;
  you_instruction_4: string | null;
  you_instruction_5: string | null;
  you_business_name: string | null;
  you_format_status: string;
  you_format_notes: string | null;
};

const STATUS_FILTERS = ["all", "pending", "generated", "approved", "failed", "rejected", "skipped"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function YouFormatQA({
  chapters,
  chapterDomains,
}: {
  chapters: ChapterRow[];
  chapterDomains: ChapterDomain[];
}) {
  const { toast } = useToast();
  const [courseCode, setCourseCode] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [assets, setAssets] = useState<AssetQA[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const COURSE_ORDER: Record<string, number> = { INTRO1: 0, INTRO2: 1, IA1: 2, IA2: 3 };
  const COURSE_LABELS: Record<string, string> = {
    INTRO1: "Intro Accounting 1",
    INTRO2: "Intro Accounting 2",
    IA1: "Intermediate Accounting 1",
    IA2: "Intermediate Accounting 2",
  };

  const availableCourses = useMemo(() => {
    const set = new Set<string>();
    chapters.forEach((c) => c.course_code && set.add(c.course_code));
    return Array.from(set).sort((a, b) => (COURSE_ORDER[a] ?? 99) - (COURSE_ORDER[b] ?? 99));
  }, [chapters]);

  const filteredChapters = useMemo(() => {
    const list = courseCode ? chapters.filter((c) => c.course_code === courseCode) : chapters;
    return [...list].sort((a, b) => {
      const co = (COURSE_ORDER[a.course_code] ?? 99) - (COURSE_ORDER[b.course_code] ?? 99);
      if (co !== 0) return co;
      return a.chapter_number - b.chapter_number;
    });
  }, [chapters, courseCode]);

  const chapterDomainsForSelected = useMemo(
    () => chapterDomains.filter((d) => d.chapter_id === chapterId).map((d) => d.domain),
    [chapterDomains, chapterId],
  );

  const loadAssets = async (cid: string) => {
    if (!cid) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("teaching_assets")
      .select(
        "id, asset_name, survive_problem_text, problem_text_backup, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, you_problem_text, you_instruction_1, you_instruction_2, you_instruction_3, you_instruction_4, you_instruction_5, you_business_name, you_format_status, you_format_notes",
      )
      .eq("chapter_id", cid)
      .order("asset_name");
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
    } else {
      setAssets((data ?? []) as AssetQA[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (chapterId) loadAssets(chapterId);
  }, [chapterId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length };
    for (const a of assets) c[a.you_format_status] = (c[a.you_format_status] ?? 0) + 1;
    return c;
  }, [assets]);

  const visible = useMemo(
    () => (filter === "all" ? assets : assets.filter((a) => a.you_format_status === filter)),
    [assets, filter],
  );

  const runBatch = async (force: boolean) => {
    if (!chapterId) return;
    if (force && !confirm("Re-generate ALL assets in this chapter (including approved/generated)? This will overwrite existing rewrites.")) return;
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("you-format-batch", {
      body: { chapter_id: chapterId, force },
    });
    setRunning(false);
    if (error) {
      toast({ title: "Batch failed", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Batch complete",
        description: `Generated: ${data?.generated ?? 0} · Failed: ${data?.failed ?? 0} · Skipped: ${data?.skipped ?? 0}`,
      });
      loadAssets(chapterId);
    }
  };

  const regenerateOne = async (id: string) => {
    const { error } = await supabase.functions.invoke("you-format-rewrite", {
      body: { asset_id: id, force: true },
    });
    if (error) {
      toast({ title: "Regenerate failed", description: error.message, variant: "destructive" });
    } else {
      loadAssets(chapterId);
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const patch: Record<string, unknown> = { you_format_status: status };
    if (status === "approved") patch.you_format_approved_at = new Date().toISOString();
    const { error } = await supabase.from("teaching_assets").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      setAssets((prev) =>
        prev.map((a) => (a.id === id ? { ...a, you_format_status: status } : a)),
      );
    }
  };

  const selectedChapter = chapters.find((c) => c.id === chapterId);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <Label>Chapter</Label>
              <Select value={chapterId} onValueChange={setChapterId}>
                <SelectTrigger><SelectValue placeholder="Choose a chapter…" /></SelectTrigger>
                <SelectContent>
                  {chapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.course_code} · Ch {c.chapter_number} — {c.chapter_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => runBatch(false)}
              disabled={!chapterId || running}
            >
              {running ? "Running…" : "Generate pending"}
            </Button>
            <Button
              variant="outline"
              onClick={() => runBatch(true)}
              disabled={!chapterId || running}
            >
              Re-generate all
            </Button>
          </div>
          {selectedChapter && (
            <p className="text-sm text-muted-foreground">
              Allowed domains:{" "}
              {chapterDomainsForSelected.length === 0
                ? <span className="text-destructive">None set — will fall back to all domains</span>
                : chapterDomainsForSelected.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {chapterId && (
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1 rounded border transition ${
                filter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              {s} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}

      {visible.map((a) => (
        <AssetQACard
          key={a.id}
          asset={a}
          onApprove={() => setStatus(a.id, "approved")}
          onReject={() => setStatus(a.id, "rejected")}
          onReset={() => setStatus(a.id, "pending")}
          onRegenerate={() => regenerateOne(a.id)}
        />
      ))}

      {chapterId && !loading && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No assets in this filter.</p>
      )}
    </div>
  );
}

function AssetQACard({
  asset,
  onApprove,
  onReject,
  onReset,
  onRegenerate,
}: {
  asset: AssetQA;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
  onRegenerate: () => void;
}) {
  const original = asset.survive_problem_text ?? asset.problem_text_backup ?? "";
  const rewritten = asset.you_problem_text ?? "";
  const origInstr = [
    asset.instruction_1, asset.instruction_2, asset.instruction_3, asset.instruction_4, asset.instruction_5,
  ].filter(Boolean) as string[];
  const newInstr = [
    asset.you_instruction_1, asset.you_instruction_2, asset.you_instruction_3, asset.you_instruction_4, asset.you_instruction_5,
  ].filter(Boolean) as string[];

  const statusVariant: Record<string, string> = {
    approved: "bg-green-600 text-white",
    generated: "bg-blue-600 text-white",
    failed: "bg-destructive text-destructive-foreground",
    rejected: "bg-muted text-muted-foreground",
    pending: "bg-amber-500 text-white",
    skipped: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="font-mono">{asset.asset_name}</span>
          <span className="flex items-center gap-2">
            {asset.you_business_name && (
              <Badge variant="outline">{asset.you_business_name}</Badge>
            )}
            <span className={`text-xs px-2 py-0.5 rounded ${statusVariant[asset.you_format_status] ?? "bg-muted"}`}>
              {asset.you_format_status}
            </span>
          </span>
        </CardTitle>
        {asset.you_format_notes && (
          <p className="text-xs text-muted-foreground">{asset.you_format_notes}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">ORIGINAL</div>
            <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-3 max-h-72 overflow-y-auto">
              {original || <em className="text-muted-foreground">No source text</em>}
            </div>
            {origInstr.length > 0 && (
              <ol className="text-xs mt-2 list-decimal pl-5 space-y-1 text-muted-foreground">
                {origInstr.map((x, i) => <li key={i}>{x}</li>)}
              </ol>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">YOU-FORMAT</div>
            <div className="text-sm whitespace-pre-wrap bg-primary/5 rounded p-3 max-h-72 overflow-y-auto">
              {rewritten || <em className="text-muted-foreground">Not generated yet</em>}
            </div>
            {newInstr.length > 0 && (
              <ol className="text-xs mt-2 list-decimal pl-5 space-y-1">
                {newInstr.map((x, i) => <li key={i}>{x}</li>)}
              </ol>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onRegenerate}>Regenerate</Button>
          {asset.you_format_status !== "pending" && (
            <Button size="sm" variant="ghost" onClick={onReset}>Reset</Button>
          )}
          {asset.you_format_status !== "rejected" && (
            <Button size="sm" variant="outline" onClick={onReject}>Reject</Button>
          )}
          {rewritten && asset.you_format_status !== "approved" && (
            <Button size="sm" onClick={onApprove}>Approve</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

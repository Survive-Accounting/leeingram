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

  const introChapters = useMemo(
    () => chapters.filter((c) => c.course_code === "INTRO1" || c.course_code === "INTRO2"),
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
            Phase A: curate the business library and map chapters to allowed business domains.
            Generation runs in Phase B.
          </p>
        </div>

        <Tabs defaultValue="businesses">
          <TabsList>
            <TabsTrigger value="businesses">Business Library ({businesses.length})</TabsTrigger>
            <TabsTrigger value="mapping">Chapter → Domain Mapping</TabsTrigger>
          </TabsList>

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
            {(["INTRO1", "INTRO2"] as const).map((code) => {
              const list = introChapters.filter((c) => c.course_code === code);
              if (!list.length) return null;
              return (
                <Card key={code}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {code === "INTRO1" ? "Intro Accounting 1" : "Intro Accounting 2"}
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

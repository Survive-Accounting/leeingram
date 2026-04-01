import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface PaymentLink {
  id?: string;
  course_id: string | null;
  chapter_id: string | null;
  link_type: string;
  label: string;
  price_cents: number;
  original_price_cents: number | null;
  sale_label: string | null;
  sale_expires_at: string | null;
  url: string;
  is_active: boolean;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(0);
}

function displayToCents(display: string): number {
  const num = parseFloat(display.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export default function PaymentLinksAdmin() {
  const qc = useQueryClient();

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ["pl-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name, code").order("created_at");
      return data || [];
    },
  });

  // Fetch ALL chapters for all courses
  const { data: chapters } = useQuery({
    queryKey: ["pl-chapters-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("course_id")
        .order("chapter_number");
      return data || [];
    },
  });

  // Fetch existing payment links
  const { data: existingLinks } = useQuery({
    queryKey: ["payment-links-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_links").select("*").order("created_at");
      return (data || []) as PaymentLink[];
    },
  });

  // ── Full Pass state ──
  const [fullPassLinks, setFullPassLinks] = useState<Record<string, PaymentLink>>({});
  const [fullPassLoaded, setFullPassLoaded] = useState(false);

  useEffect(() => {
    if (!courses || !existingLinks || fullPassLoaded) return;
    const map: Record<string, PaymentLink> = {};
    for (const c of courses) {
      const existing = existingLinks.find(l => l.link_type === "full_pass" && l.course_id === c.id);
      map[c.id] = existing || {
        course_id: c.id,
        chapter_id: null,
        link_type: "full_pass",
        label: `Full Study Pass — ${c.course_name}`,
        price_cents: 12500,
        original_price_cents: 25000,
        sale_label: "Spring 2026 Sale",
        sale_expires_at: "2026-05-16T00:00:00Z",
        url: "",
        is_active: true,
      };
    }
    setFullPassLinks(map);
    setFullPassLoaded(true);
  }, [courses, existingLinks, fullPassLoaded]);

  // ── Chapter Links state ──
  const [chapterLinks, setChapterLinks] = useState<Record<string, PaymentLink>>({});
  const [chapterLinksLoaded, setChapterLinksLoaded] = useState(false);

  useEffect(() => {
    if (!chapters || !existingLinks || chapterLinksLoaded) return;
    const map: Record<string, PaymentLink> = {};
    for (const ch of chapters) {
      const existing = existingLinks.find(l => l.link_type === "chapter" && l.chapter_id === ch.id);
      map[ch.id] = existing || {
        course_id: ch.course_id,
        chapter_id: ch.id,
        link_type: "chapter",
        label: `Chapter ${ch.chapter_number} Only`,
        price_cents: 3000,
        original_price_cents: null,
        sale_label: null,
        sale_expires_at: null,
        url: "",
        is_active: true,
      };
    }
    setChapterLinks(map);
    setChapterLinksLoaded(true);
  }, [chapters, existingLinks, chapterLinksLoaded]);

  // ── Save full pass link ──
  const saveFullPassMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const link = fullPassLinks[courseId];
      if (!link) return;
      if (link.id) {
        const { error } = await supabase.from("payment_links").update({
          label: link.label,
          price_cents: link.price_cents,
          original_price_cents: link.original_price_cents,
          sale_label: link.sale_label,
          sale_expires_at: link.sale_expires_at,
          url: link.url,
          is_active: link.is_active,
        }).eq("id", link.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_links").insert({
          course_id: link.course_id,
          chapter_id: null,
          link_type: "full_pass",
          label: link.label,
          price_cents: link.price_cents,
          original_price_cents: link.original_price_cents,
          sale_label: link.sale_label,
          sale_expires_at: link.sale_expires_at,
          url: link.url,
          is_active: link.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-links-admin"] });
      setFullPassLoaded(false);
      toast.success("Full pass link saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Save all chapter links ──
  const [savingChapters, setSavingChapters] = useState(false);
  const saveAllChapterLinks = async () => {
    setSavingChapters(true);
    try {
      for (const ch of chapters || []) {
        const link = chapterLinks[ch.id];
        if (!link) continue;
        if (link.id) {
          await supabase.from("payment_links").update({
            label: link.label,
            price_cents: link.price_cents,
            url: link.url,
            is_active: link.is_active,
          }).eq("id", link.id);
        } else {
          await supabase.from("payment_links").insert({
            course_id: link.course_id,
            chapter_id: link.chapter_id,
            link_type: "chapter",
            label: link.label,
            price_cents: link.price_cents,
            url: link.url,
            is_active: link.is_active,
          });
        }
      }
      qc.invalidateQueries({ queryKey: ["payment-links-admin"] });
      setChapterLinksLoaded(false);
      toast.success("All chapter links saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save chapter links");
    } finally {
      setSavingChapters(false);
    }
  };

  const updateFullPass = (courseId: string, patch: Partial<PaymentLink>) => {
    setFullPassLinks(prev => ({ ...prev, [courseId]: { ...prev[courseId], ...patch } }));
  };

  const updateChapter = (chapterId: string, patch: Partial<PaymentLink>) => {
    setChapterLinks(prev => ({ ...prev, [chapterId]: { ...prev[chapterId], ...patch } }));
  };

  return (
    <SurviveSidebarLayout>
      <div className="max-w-5xl mx-auto space-y-10">
        <h1 className="text-xl font-bold text-foreground">💳 Payment Links</h1>

        {/* ── Full Pass Links ── */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Full Pass Links</h2>

          {courses?.map((course) => {
            const link = fullPassLinks[course.id];
            if (!link) return null;
            return (
              <div key={course.id} className="rounded-lg border border-border p-4 space-y-3">
                <p className="font-semibold text-sm text-foreground">{course.course_name} ({course.code})</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Label</label>
                    <Input
                      value={link.label}
                      onChange={e => updateFullPass(course.id, { label: e.target.value })}
                      className="text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">URL</label>
                    <Input
                      value={link.url}
                      onChange={e => updateFullPass(course.id, { url: e.target.value })}
                      placeholder="https://school.surviveaccounting.com/..."
                      className="text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Price ($)</label>
                    <Input
                      value={centsToDisplay(link.price_cents)}
                      onChange={e => updateFullPass(course.id, { price_cents: displayToCents(e.target.value) })}
                      className="text-sm mt-1 w-28"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Original Price ($) — strikethrough</label>
                    <Input
                      value={link.original_price_cents ? centsToDisplay(link.original_price_cents) : ""}
                      onChange={e => updateFullPass(course.id, { original_price_cents: e.target.value ? displayToCents(e.target.value) : null })}
                      placeholder="e.g. 250"
                      className="text-sm mt-1 w-28"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Sale Label</label>
                    <Input
                      value={link.sale_label || ""}
                      onChange={e => updateFullPass(course.id, { sale_label: e.target.value || null })}
                      placeholder="Spring 2026 Sale"
                      className="text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Sale Expires (YYYY-MM-DD)</label>
                    <Input
                      type="date"
                      value={link.sale_expires_at ? link.sale_expires_at.split("T")[0] : ""}
                      onChange={e => updateFullPass(course.id, { sale_expires_at: e.target.value ? `${e.target.value}T00:00:00Z` : null })}
                      className="text-sm mt-1 w-44"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={link.is_active} onCheckedChange={v => updateFullPass(course.id, { is_active: v })} />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <Button size="sm" onClick={() => saveFullPassMutation.mutate(course.id)} disabled={saveFullPassMutation.isPending}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {saveFullPassMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Chapter Links ── */}
        <section className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Chapter Links (All Courses)</h2>

          {courses?.map((course) => {
            const courseChapters = chapters?.filter(ch => ch.course_id === course.id) || [];
            if (courseChapters.length === 0) return null;
            return (
              <div key={course.id} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{course.course_name} ({course.code})</h3>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Chapter</TableHead>
                        <TableHead className="text-xs">Label</TableHead>
                        <TableHead className="text-xs">Price ($)</TableHead>
                        <TableHead className="text-xs">URL</TableHead>
                        <TableHead className="text-xs text-center">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseChapters.map(ch => {
                        const link = chapterLinks[ch.id];
                        if (!link) return null;
                        return (
                          <TableRow key={ch.id}>
                            <TableCell className="text-sm font-medium whitespace-nowrap">
                              Ch {ch.chapter_number} — {ch.chapter_name}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={link.label}
                                onChange={e => updateChapter(ch.id, { label: e.target.value })}
                                className="text-xs h-8 w-40"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={centsToDisplay(link.price_cents)}
                                onChange={e => updateChapter(ch.id, { price_cents: displayToCents(e.target.value) })}
                                className="text-xs h-8 w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={link.url}
                                onChange={e => updateChapter(ch.id, { url: e.target.value })}
                                placeholder="Paste LearnWorlds link…"
                                className="text-xs h-8"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch checked={link.is_active} onCheckedChange={v => updateChapter(ch.id, { is_active: v })} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}

          <Button onClick={saveAllChapterLinks} disabled={savingChapters}>
            {savingChapters && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Save className="h-4 w-4 mr-2" />
            Save All Chapter Links
          </Button>
        </section>
      </div>
    </SurviveSidebarLayout>
  );
}

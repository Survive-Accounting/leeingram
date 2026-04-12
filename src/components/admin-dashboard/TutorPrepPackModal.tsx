/**
 * TutorPrepPackModal — Selection modal for generating a Tutor Prep Pack PDF.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateTutorPrepPack, type ChapterPdfData, type TutorPrepPackOptions } from "@/lib/generateChapterPdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chapterId: string;
  chapterNumber: number;
  chapterName: string;
  courseCode: string;
  courseName: string;
}

const SECTION_OPTIONS = [
  { key: "purpose", label: "What's the Point" },
  { key: "memoryItems", label: "Memory Items" },
  { key: "keyTerms", label: "Key Terms" },
  { key: "formulas", label: "Formulas" },
  { key: "jes", label: "Journal Entries" },
  { key: "mistakes", label: "Common Mistakes" },
  { key: "accounts", label: "Accounts" },
] as const;

type SectionKey = typeof SECTION_OPTIONS[number]["key"];

const ASSET_TYPES = [
  { value: "all", label: "All Types" },
  { value: "BE", label: "Brief Exercises" },
  { value: "QS", label: "Quick Studies" },
  { value: "EX", label: "Exercises" },
  { value: "P", label: "Problems" },
];

export function TutorPrepPackModal({ open, onOpenChange, chapterId, chapterNumber, chapterName, courseCode, courseName }: Props) {
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    purpose: true,
    memoryItems: true,
    keyTerms: true,
    formulas: true,
    jes: true,
    mistakes: true,
    accounts: false,
  });
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<"blank" | "with_solution" | "both">("blank");
  const [generating, setGenerating] = useState(false);

  // Fetch approved assets for this chapter
  const { data: assets = [] } = useQuery({
    queryKey: ["prep-pack-assets", chapterId],
    enabled: open && !!chapterId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_text, instructions, solution_text, je_data, problem_screenshot_url, solution_screenshot_url")
        .eq("chapter_id", chapterId)
        .eq("status", "approved")
        .order("source_ref");
      return (data || []) as any[];
    },
  });

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (typeFilter !== "all") {
      list = list.filter((a: any) => {
        const prefix = (a.source_ref || "").replace(/[0-9.]/g, "").toUpperCase();
        return prefix === typeFilter;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a: any) =>
        (a.source_ref || "").toLowerCase().includes(q) ||
        (a.problem_text || "").toLowerCase().includes(q) ||
        (a.asset_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [assets, typeFilter, search]);

  const toggleSection = (key: SectionKey) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleProblem = (id: string) => {
    setSelectedProblems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (filteredAssets.length === selectedProblems.size) {
      setSelectedProblems(new Set());
    } else {
      setSelectedProblems(new Set(filteredAssets.map((a: any) => a.id)));
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    toast.loading("Building Tutor Prep Pack…", { id: "prep-pack" });
    try {
      // Fetch chapter content
      const [purposeRes, termsRes, accRes, formRes, catRes, jeRes, mistRes, memRes] = await Promise.all([
        supabase.from("chapter_purpose").select("*").eq("chapter_id", chapterId).eq("is_approved", true).maybeSingle(),
        supabase.from("chapter_key_terms").select("*").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_accounts").select("*").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_formulas").select("*").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_je_categories").select("*").eq("chapter_id", chapterId).order("sort_order"),
        supabase.from("chapter_journal_entries").select("*").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_exam_mistakes").select("*").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_memory_items").select("*").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order"),
      ]);

      const chapterData: ChapterPdfData = {
        chapterName,
        chapterNumber,
        courseCode,
        courseName,
        purpose: purposeRes.data ? {
          purpose_bullets: Array.isArray(purposeRes.data.purpose_bullets) ? purposeRes.data.purpose_bullets as string[] : null,
          consequence_bullets: Array.isArray(purposeRes.data.consequence_bullets) ? purposeRes.data.consequence_bullets as string[] : null,
        } : null,
        keyTerms: (termsRes.data || []).map((t: any) => ({ term: t.term, definition: t.definition, category: t.category })),
        accounts: (accRes.data || []).map((a: any) => ({ account_name: a.account_name, account_type: a.account_type, normal_balance: a.normal_balance, account_description: a.account_description })),
        formulas: (formRes.data || []).map((f: any) => ({ formula_name: f.formula_name, formula_expression: f.formula_expression, formula_explanation: f.formula_explanation, sort_order: f.sort_order })),
        jeCategories: (catRes.data || []).map((c: any) => ({ id: c.id, category_name: c.category_name, sort_order: c.sort_order ?? 0 })),
        jeEntries: (jeRes.data || []).map((j: any) => ({ transaction_label: j.transaction_label, category_id: j.category_id, je_lines: j.je_lines, sort_order: j.sort_order ?? 0 })),
        mistakes: (mistRes.data || []).map((m: any) => ({ mistake: m.mistake, explanation: m.explanation, sort_order: m.sort_order ?? 0 })),
        memoryItems: (memRes.data || []).map((mi: any) => ({ title: mi.title, subtitle: mi.subtitle, item_type: mi.item_type, items: mi.items || [], sort_order: mi.sort_order ?? 0 })),
      };

      const selectedAssets = assets.filter((a: any) => selectedProblems.has(a.id));
      const problems = selectedAssets.map((a: any) => ({
        asset_name: a.asset_name,
        source_ref: a.source_ref || a.asset_name,
        problem_text: a.problem_text || "",
        instructions: a.instructions || "",
        solution_text: a.solution_text || "",
        je_data: Array.isArray(a.je_data) ? a.je_data : null,
        problem_screenshot_url: a.problem_screenshot_url || null,
        solution_screenshot_url: a.solution_screenshot_url || null,
      }));

      generateTutorPrepPack({
        chapterData,
        sections,
        problems,
        problemFormat: format,
      });

      toast.success("Tutor Prep Pack downloaded!", { id: "prep-pack" });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate", { id: "prep-pack" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm">Tutor Prep Pack — Ch {chapterNumber} {chapterName}</DialogTitle>
          <DialogDescription className="sr-only">Select sections and problems to include</DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* ── Section selection ── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Include Chapter Content</p>
            <div className="space-y-1.5">
              {SECTION_OPTIONS.map(s => (
                <label key={s.key} className="flex items-center gap-2.5 cursor-pointer py-1">
                  <Checkbox
                    checked={sections[s.key]}
                    onCheckedChange={() => toggleSection(s.key)}
                  />
                  <span className="text-sm text-foreground">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* ── Problem selection ── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Select Practice Problems</p>
            <div className="flex items-center gap-2 mb-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-8 text-xs flex-1"
              />
            </div>

            <div className="max-h-[200px] overflow-y-auto border rounded-md">
              {filteredAssets.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No approved assets found</p>
              ) : (
                <div className="divide-y divide-border">
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer bg-muted/30">
                    <Checkbox
                      checked={filteredAssets.length > 0 && filteredAssets.every((a: any) => selectedProblems.has(a.id))}
                      onCheckedChange={selectAll}
                    />
                    <span className="text-xs font-semibold text-muted-foreground">Select all ({filteredAssets.length})</span>
                  </label>
                  {filteredAssets.map((a: any) => (
                    <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/20">
                      <Checkbox
                        checked={selectedProblems.has(a.id)}
                        onCheckedChange={() => toggleProblem(a.id)}
                      />
                      <span className="text-xs text-foreground truncate">
                        <span className="font-semibold">{a.source_ref || a.asset_name}</span>
                        {a.problem_text && <span className="text-muted-foreground"> — {a.problem_text.substring(0, 50)}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Selected: {selectedProblems.size} problem{selectedProblems.size !== 1 ? "s" : ""}</p>
          </div>

          <div className="h-px bg-border" />

          {/* ── Format selection ── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem Format</p>
            <div className="space-y-1.5">
              {[
                { value: "blank" as const, label: "Blank (problem + instructions only)" },
                { value: "with_solution" as const, label: "With solution explanation" },
                { value: "both" as const, label: "Both (blank first, solution after)" },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input
                    type="radio"
                    name="prepPackFormat"
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* ── Generate button ── */}
          <Button
            className="w-full h-10 text-sm font-semibold"
            disabled={generating || (!Object.values(sections).some(Boolean) && selectedProblems.size === 0)}
            onClick={handleGenerate}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
            ) : (
              <><FileDown className="h-4 w-4 mr-2" /> Generate PDF →</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

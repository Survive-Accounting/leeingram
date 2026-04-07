/**
 * CourseZipExporter — Generates PDFs for every chapter in a selected course
 * and bundles them into a single zip download.
 */
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateChapterPdfBlob, type ChapterPdfData } from "@/lib/generateChapterPdf";
import JSZip from "jszip";

const COURSE_OPTIONS = [
  { label: "Intro 1", code: "ACCY201" },
  { label: "Intro 2", code: "ACCY202" },
  { label: "IA1", code: "ACCY303" },
  { label: "IA2", code: "ACCY304" },
];

export function CourseZipExporter() {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const handleExport = async () => {
    if (!selectedCourse) return;

    const courseOpt = COURSE_OPTIONS.find(c => c.code === selectedCourse);
    if (!courseOpt) return;

    setRunning(true);
    setProgress("Loading chapters…");

    try {
      // Get course
      const { data: course } = await supabase
        .from("courses")
        .select("id, code, course_name")
        .eq("code", selectedCourse)
        .maybeSingle();

      if (!course) {
        toast.error("Course not found");
        setRunning(false);
        return;
      }

      // Get chapters for this course
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", course.id)
        .order("chapter_number");

      if (!chapters?.length) {
        toast.error("No chapters found");
        setRunning(false);
        return;
      }

      const zip = new JSZip();
      let completed = 0;

      for (const ch of chapters) {
        setProgress(`Ch ${ch.chapter_number} of ${chapters.length} — ${ch.chapter_name}`);

        // Fetch all approved content for this chapter
        const [purposeRes, termsRes, accRes, formRes, catRes, jeRes, mistRes] = await Promise.all([
          supabase.from("chapter_purpose").select("*").eq("chapter_id", ch.id).eq("is_approved", true).maybeSingle(),
          supabase.from("chapter_key_terms").select("*").eq("chapter_id", ch.id).eq("is_approved", true).order("sort_order"),
          supabase.from("chapter_accounts").select("*").eq("chapter_id", ch.id).eq("is_approved", true).order("sort_order"),
          supabase.from("chapter_formulas").select("*").eq("chapter_id", ch.id).eq("is_approved", true).order("sort_order"),
          supabase.from("chapter_je_categories").select("*").eq("chapter_id", ch.id).order("sort_order"),
          supabase.from("chapter_journal_entries").select("*").eq("chapter_id", ch.id).eq("is_approved", true).order("sort_order"),
          supabase.from("chapter_exam_mistakes").select("*").eq("chapter_id", ch.id).eq("is_approved", true).order("sort_order"),
        ]);

        const pdfData: ChapterPdfData = {
          chapterName: ch.chapter_name,
          chapterNumber: ch.chapter_number,
          courseCode: course.code,
          courseName: course.course_name,
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
        };

        const { blob, filename } = generateChapterPdfBlob(pdfData);
        zip.file(filename, blob);
        completed++;
      }

      setProgress("Compressing zip…");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SA_${course.code}_AllChapters.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${completed} chapter PDFs zipped and downloaded!`);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={running}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Select course" />
        </SelectTrigger>
        <SelectContent>
          {COURSE_OPTIONS.map(c => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={handleExport} disabled={!selectedCourse || running}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
        {running ? progress : "Export Course PDFs"}
      </Button>
    </div>
  );
}

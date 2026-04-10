import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ChapterOption = { id: string; chapter_number: number; chapter_name: string };

export function ChapterQAReportExporter() {
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: courses } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!courses?.length) return;
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name").eq("course_id", courses[0].id).order("chapter_number");
      if (data) setChapters(data);
    })();
  }, []);

  const handleExport = async () => {
    if (!selectedChapter) return;
    const ch = chapters.find(c => c.id === selectedChapter);
    if (!ch) return;
    setRunning(true);

    try {
      // Parallel data fetch
      const [assetsRes, issuesRes] = await Promise.all([
        (async () => {
          let all: any[] = [];
          let from = 0;
          while (true) {
            const { data, error } = await supabase
              .from("teaching_assets")
              .select("id, asset_name, source_ref, fix_status, fix_notes, source_type")
              .eq("chapter_id", ch.id)
              .neq("google_sheet_status", "archived")
              .range(from, from + 999);
            if (error) throw error;
            all = all.concat(data);
            if (data.length < 1000) break;
            from += 1000;
          }
          return all;
        })(),
        supabase.from("solutions_qa_issues" as any).select("asset_name, issue_description").order("created_at"),
      ]);

      const issues = (issuesRes.data || []) as { asset_name: string; issue_description: string }[];

      // Build issues lookup
      const issueMap: Record<string, string[]> = {};
      for (const i of issues) {
        if (!issueMap[i.asset_name]) issueMap[i.asset_name] = [];
        issueMap[i.asset_name].push(i.issue_description);
      }

      // Sort assets: BE/QS first, then EX, then P — then numerically
      const typeOrder: Record<string, number> = { BE: 0, QS: 0, EX: 1, E: 1, P: 2 };
      const assets = assetsRes.sort((a: any, b: any) => {
        const ta = typeOrder[a.source_type] ?? 1;
        const tb = typeOrder[b.source_type] ?? 1;
        if (ta !== tb) return ta - tb;
        return (a.source_ref || a.asset_name || "").localeCompare(b.source_ref || b.asset_name || "", undefined, { numeric: true });
      });

      // Count stats
      const total = assets.length;
      const fixApplied = assets.filter((a: any) => a.fix_status === "fix_applied").length;
      const readyForStudents = assets.filter((a: any) => a.fix_status === "ready_for_students" || a.fix_status === "fix_verified").length;
      const needsLee = assets.filter((a: any) => a.fix_status === "needs_lee").length;
      const noStatus = assets.filter((a: any) => !a.fix_status).length;

      // Build PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      // ── Cover block ──
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Survive Accounting — Post-Fix Review Sheet", margin, 50);

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Chapter ${ch.chapter_number}: ${ch.chapter_name}`, margin, 72);

      doc.setFontSize(11);
      doc.text("Reviewer: ____________  ·  Date: ________", margin, 92);

      // Thank-you box
      const tyTop = 112;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, tyTop, pageW - margin * 2, 72, 4, 4);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      const tyText = "King, Mae, Rona, Ella, EJ — thank you. Seriously. The work you've put into reviewing these assets is what makes this platform worth building. This final pass is the last step before students start using this material for real. Let's get it across the finish line.\n\n— Lee";
      doc.text(tyText, margin + 10, tyTop + 14, { maxWidth: pageW - margin * 2 - 20 });

      // Instructions box
      const instrTop = tyTop + 84;
      doc.setDrawColor(100, 100, 100);
      doc.roundedRect(margin, instrTop, pageW - margin * 2, 136, 4, 4);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("HOW TO USE THIS SHEET", margin + 10, instrTop + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const instrLines = [
        "Goal: get every asset to Ready for Students ✓",
        "",
        "For each asset in the table below:",
        "1. Open the asset at learn.surviveaccounting.com/solutions/[Ref] (replace [Ref] with the code in column 1)",
        "2. Read the Explanation section",
        "3. If it looks correct and complete — circle: Ready ✓",
        "4. If something still looks wrong or is missing — circle: Needs Lee 🚩",
        "5. Log your decision in the admin tool at learn.surviveaccounting.com/solutions-qa",
        "",
        "Tip: assets highlighted in amber already have a known issue flagged. Pay extra attention to these.",
        "Assets already in green are provisionally signed off — but give them a quick look anyway.",
        "",
        "When done: share your completed sheet findings in Slack #asset-fixes. Thank you — this matters.",
      ];
      doc.text(instrLines.join("\n"), margin + 10, instrTop + 30, { maxWidth: pageW - margin * 2 - 20 });

      // Summary line
      const summTop = instrTop + 148;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${total} assets total · ${fixApplied} fix_applied · ${readyForStudents} ready_for_students · ${needsLee} needs_lee · ${noStatus} no status`, margin, summTop);

      // Asset table
      const tableRows = assets.map((a: any) => {
        const assetIssues = issueMap[a.asset_name] || [];
        const issueTxt = assetIssues.length > 0
          ? assetIssues.slice(0, 2).map(t => t.length > 100 ? t.slice(0, 97) + "..." : t).join("\n")
          : "No issues logged";
        const fixNotes = a.fix_notes ? (a.fix_notes.length > 120 ? a.fix_notes.slice(0, 117) + "..." : a.fix_notes) : "—";
        const fixStatus = a.fix_status ? a.fix_status.replace(/_/g, " ") : "—";
        return [
          a.source_ref || a.asset_name,
          issueTxt,
          fixStatus,
          fixNotes,
          "  Ready ✓     |     Needs Lee 🚩  ",
        ];
      });

      autoTable(doc, {
        startY: summTop + 14,
        head: [["Ref", "Issue Reported", "Fix Status", "Fix Notes", "Action"]],
        body: tableRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4, minCellHeight: 28, overflow: "linebreak" },
        headStyles: { fillColor: [20, 33, 61], textColor: 255, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 60, font: "courier", fontStyle: "bold" },
          1: { cellWidth: 160 },
          2: { cellWidth: 70 },
          3: { cellWidth: 140 },
          4: { cellWidth: "auto", halign: "center", fontStyle: "bold" },
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const rowIdx = data.row.index;
          const asset = assets[rowIdx];
          if (asset?.fix_status === "needs_lee") {
            data.cell.styles.fillColor = [255, 243, 205];
          } else if (asset?.fix_status === "ready_for_students" || asset?.fix_status === "fix_verified") {
            data.cell.styles.fillColor = [220, 252, 231];
          }
        },
        didDrawPage: () => {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(130, 130, 130);
          doc.text(
            `SurviveAccounting.com · Chapter ${ch.chapter_number} Review · Generated ${now} · Share results in Slack #asset-fixes`,
            pageW / 2,
            pageH - 20,
            { align: "center" },
          );
          doc.setTextColor(0, 0, 0);
        },
      });

      const safeName = ch.chapter_name.replace(/[^a-zA-Z0-9]/g, "-");
      doc.save(`QA-Review-Ch${ch.chapter_number}-${safeName}.pdf`);
      toast.success("Review PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={running}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Select chapter" />
        </SelectTrigger>
        <SelectContent>
          {chapters.map(ch => (
            <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}: {ch.chapter_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={handleExport} disabled={!selectedChapter || running}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
        {running ? "Generating…" : "Export Review PDF"}
      </Button>
    </div>
  );
}

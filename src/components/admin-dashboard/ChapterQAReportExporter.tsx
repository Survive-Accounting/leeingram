import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ChapterOption = { id: string; chapter_number: number; chapter_name: string };

// ── Shared helpers ──

const TYPE_ORDER: Record<string, number> = { BE: 0, QS: 0, EX: 1, E: 1, P: 2 };

const FIX_PATTERNS = [
  { label: "Standardize Formatting", pattern: "Standardize Formatting" },
  { label: "Remove AI Thinking", pattern: "Remove AI Thinking" },
  { label: "Remove Duplicates", pattern: "Remove Duplicates" },
  { label: "Regenerate Missing", pattern: "Regenerate Missing" },
];

async function fetchAllChapterAssets(chapterId: string) {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("teaching_assets")
      .select("id, asset_name, source_ref, fix_status, fix_notes, source_type")
      .eq("chapter_id", chapterId)
      .neq("google_sheet_status", "archived")
      .range(from, from + 999);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

function sortAssets(assets: any[]) {
  return assets.sort((a, b) => {
    const ta = TYPE_ORDER[a.source_type] ?? 1;
    const tb = TYPE_ORDER[b.source_type] ?? 1;
    if (ta !== tb) return ta - tb;
    return (a.source_ref || a.asset_name || "").localeCompare(b.source_ref || b.asset_name || "", undefined, { numeric: true });
  });
}

function countStats(assets: any[]) {
  return {
    total: assets.length,
    fixApplied: assets.filter(a => a.fix_status === "fix_applied").length,
    ready: assets.filter(a => a.fix_status === "ready_for_students" || a.fix_status === "fix_verified").length,
    needsLee: assets.filter(a => a.fix_status === "needs_lee").length,
    noStatus: assets.filter(a => !a.fix_status).length,
  };
}

function getFixCounts(assets: any[], needsLee: number) {
  const counts: { label: string; count: number }[] = [];
  for (const fp of FIX_PATTERNS) {
    const count = assets.filter(a => a.fix_notes && a.fix_notes.includes(fp.pattern)).length;
    if (count > 0) counts.push({ label: fp.label, count });
  }
  if (needsLee > 0) counts.push({ label: "Flagged Needs Lee", count: needsLee });
  return counts;
}

async function fetchHeaderImage(): Promise<string | null> {
  try {
    const imgResp = await fetch("https://surviveaccounting.com/og-image.png");
    if (!imgResp.ok) return null;
    const blob = await imgResp.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildIssueMap(issues: { asset_name: string; issue_description: string }[]) {
  const map: Record<string, string[]> = {};
  for (const i of issues) {
    if (!map[i.asset_name]) map[i.asset_name] = [];
    map[i.asset_name].push(i.issue_description);
  }
  return map;
}

function drawBulkFixesBlock(doc: jsPDF, assets: any[], needsLee: number, chapterNumber: number, cursorY: number, margin: number, pageW: number, compact = false) {
  const fixCounts = getFixCounts(assets, needsLee);
  if (fixCounts.length === 0) return cursorY;

  if (compact) {
    // Compact: one-line summary
    const lines = fixCounts.map(fc => `${fc.label}: ${fc.count}`).join("  ·  ");
    const boxH = 24;
    doc.setFillColor(20, 33, 61);
    doc.roundedRect(margin, cursorY, pageW - margin * 2, boxH, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text(`Bulk Fixes: ${lines}`, margin + 8, cursorY + 15);
    doc.setTextColor(0, 0, 0);
    return cursorY + boxH + 6;
  }

  // Full block
  const boxH = 16 + fixCounts.length * 14 + 30;
  doc.setFillColor(20, 33, 61);
  doc.roundedRect(margin, cursorY, pageW - margin * 2, boxH, 4, 4, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Bulk Fixes Applied to This Chapter", margin + 10, cursorY + 14);
  doc.setFont("helvetica", "normal");
  let fy = cursorY + 28;
  for (const fc of fixCounts) {
    doc.text(`${fc.label.padEnd(28, " ")}→  ${fc.count} assets`, margin + 10, fy);
    fy += 14;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(
    `These fixes were applied automatically based on VA review findings from Ch ${chapterNumber}. Your job now is to confirm each one looks correct.`,
    margin + 10, fy + 4, { maxWidth: pageW - margin * 2 - 20 }
  );
  doc.setTextColor(0, 0, 0);
  return cursorY + boxH + 10;
}

function drawAssetTable(doc: jsPDF, assets: any[], issueMap: Record<string, string[]>, cursorY: number, margin: number, footerText: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const tableRows = assets.map((a: any) => {
    const assetIssues = issueMap[a.asset_name] || [];
    const issueTxt = assetIssues.length > 0
      ? assetIssues.slice(0, 2).map(t => t.length > 100 ? t.slice(0, 97) + "..." : t).join("\n")
      : "No issues logged";
    const fixNotes = a.fix_notes ? (a.fix_notes.length > 120 ? a.fix_notes.slice(0, 117) + "..." : a.fix_notes) : "—";
    const fixStatus = a.fix_status ? a.fix_status.replace(/_/g, " ") : "—";
    return [a.source_ref || a.asset_name, issueTxt, fixStatus, fixNotes, "  Ready ✓     |     Needs Lee 🚩  "];
  });

  autoTable(doc, {
    startY: cursorY,
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
      const asset = assets[data.row.index];
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
      doc.text(footerText, pageW / 2, pageH - 20, { align: "center" });
      doc.setTextColor(0, 0, 0);
    },
  });
}

// ── Component ──

export function ChapterQAReportExporter() {
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [running, setRunning] = useState(false);
  const [runningFull, setRunningFull] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: courses } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!courses?.length) return;
      setCourseId(courses[0].id);
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name").eq("course_id", courses[0].id).order("chapter_number");
      if (data) setChapters(data);
    })();
  }, []);

  // ── Single chapter export ──
  const handleExport = async () => {
    if (!selectedChapter) return;
    const ch = chapters.find(c => c.id === selectedChapter);
    if (!ch) return;
    setRunning(true);

    try {
      const [assets, issuesRes, headerImg] = await Promise.all([
        fetchAllChapterAssets(ch.id).then(sortAssets),
        supabase.from("solutions_qa_issues" as any).select("asset_name, issue_description").order("created_at"),
        fetchHeaderImage(),
      ]);

      const issues = (issuesRes.data || []) as unknown as { asset_name: string; issue_description: string }[];
      const issueMap = buildIssueMap(issues);
      const stats = countStats(assets);

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 40;
      const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      let cursorY = 30;

      // Header image
      if (headerImg) {
        doc.addImage(headerImg, "PNG", margin, cursorY, pageW - margin * 2, 60);
        cursorY += 70;
      }

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Survive Accounting — Post-Fix Review Sheet", margin, cursorY + 16);
      cursorY += 24;
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Chapter ${ch.chapter_number}: ${ch.chapter_name}`, margin, cursorY + 14);
      cursorY += 20;
      doc.setFontSize(11);
      doc.text("Reviewer: ____________  ·  Date: ________", margin, cursorY + 12);
      cursorY += 22;

      // Bulk fixes
      cursorY = drawBulkFixesBlock(doc, assets, stats.needsLee, ch.chapter_number, cursorY, margin, pageW);

      // Thank-you
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      const tyBoxH = 72;
      doc.roundedRect(margin, cursorY, pageW - margin * 2, tyBoxH, 4, 4);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("King, Mae, Rona, Ella, EJ — thank you. Seriously.\n\nThe work you put into reviewing these assets is what makes this platform worth building. This final pass is the last step before students start using this material for real. Let's get it across the finish line.\n\n— Lee", margin + 10, cursorY + 14, { maxWidth: pageW - margin * 2 - 20 });
      cursorY += tyBoxH + 10;

      // Instructions
      doc.setDrawColor(100, 100, 100);
      const instrBoxH = 150;
      doc.roundedRect(margin, cursorY, pageW - margin * 2, instrBoxH, 4, 4);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("HOW TO USE THIS SHEET", margin + 10, cursorY + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const instrLines = [
        "Goal: get every asset to Ready for Students ✓", "",
        "For each asset in the table below:",
        "1. Open the asset at: learn.surviveaccounting.com/solutions/[Ref]  (replace [Ref] with column 1, e.g. BE13.4)",
        "2. Read the Explanation section",
        "3. If correct and complete — circle: Ready ✓",
        "4. If something still looks wrong — circle: Needs Lee 🚩",
        "5. Log your decision in the admin tool at: learn.surviveaccounting.com/solutions-qa", "",
        "Tip: amber rows have a known issue flagged. Pay extra attention to these.",
        "Green rows are provisionally signed off — quick look still appreciated.", "",
        "When done: King can share findings in Slack. Thank you all — this is a huge help.",
      ];
      doc.text(instrLines.join("\n"), margin + 10, cursorY + 30, { maxWidth: pageW - margin * 2 - 20 });
      cursorY += instrBoxH + 10;

      // Summary line
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${stats.total} assets total · ${stats.fixApplied} fix_applied · ${stats.ready} ready_for_students · ${stats.needsLee} needs_lee · ${stats.noStatus} no status`, margin, cursorY + 4);
      cursorY += 18;

      // Table
      const footerText = `SurviveAccounting.com · Chapter ${ch.chapter_number} Review · Generated ${now} · Share results in Slack #asset-fixes`;
      drawAssetTable(doc, assets, issueMap, cursorY, margin, footerText);

      const safeName = ch.chapter_name.replace(/[^a-zA-Z0-9]/g, "-");
      doc.save(`QA-Review-Ch${ch.chapter_number}-${safeName}.pdf`);
      toast.success("Review PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setRunning(false);
    }
  };

  // ── Full course export ──
  const handleFullCourseExport = async () => {
    if (!courseId || chapters.length === 0) return;
    setRunningFull(true);

    try {
      // Fetch all issues once
      const [issuesRes, headerImg] = await Promise.all([
        supabase.from("solutions_qa_issues" as any).select("asset_name, issue_description").order("created_at"),
        fetchHeaderImage(),
      ]);
      const issues = (issuesRes.data || []) as unknown as { asset_name: string; issue_description: string }[];
      const issueMap = buildIssueMap(issues);

      // Fetch assets per chapter
      type ChapterData = { ch: ChapterOption; assets: any[]; stats: ReturnType<typeof countStats> };
      const chapterDataArr: ChapterData[] = [];

      for (const ch of chapters) {
        const assets = sortAssets(await fetchAllChapterAssets(ch.id));
        const stats = countStats(assets);

        // Include if at least one asset has fix_status or has an issue logged
        const hasFixStatus = assets.some(a => a.fix_status);
        const hasIssue = assets.some(a => issueMap[a.asset_name]?.length > 0);
        if (hasFixStatus || hasIssue) {
          chapterDataArr.push({ ch, assets, stats });
        }
      }

      if (chapterDataArr.length === 0) {
        toast.error("No chapters have fix activity or logged issues");
        setRunningFull(false);
        return;
      }

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const dateISO = new Date().toISOString().slice(0, 10);
      const footerText = `Survive Accounting · Full IA2 Review · Generated ${now} · Slack #asset-fixes`;

      // ── COVER PAGE ──
      let cursorY = 30;

      if (headerImg) {
        doc.addImage(headerImg, "PNG", margin, cursorY, pageW - margin * 2, 60);
        cursorY += 70;
      }

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Survive Accounting — Full Course Post-Fix Review", margin, cursorY + 18);
      cursorY += 28;
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Intermediate Accounting 2", margin, cursorY + 14);
      cursorY += 22;
      doc.setFontSize(11);
      doc.text("Reviewer: ____________  ·  Date: ________", margin, cursorY + 12);
      cursorY += 24;

      // Thank-you
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      const tyBoxH = 72;
      doc.roundedRect(margin, cursorY, pageW - margin * 2, tyBoxH, 4, 4);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("King, Mae, Rona, Ella, EJ — thank you. Seriously.\n\nThe work you put into reviewing these assets is what makes this platform worth building. This final pass is the last step before students start using this material for real. Let's get it across the finish line.\n\n— Lee", margin + 10, cursorY + 14, { maxWidth: pageW - margin * 2 - 20 });
      cursorY += tyBoxH + 10;

      // Instructions
      doc.setDrawColor(100, 100, 100);
      const instrBoxH = 150;
      doc.roundedRect(margin, cursorY, pageW - margin * 2, instrBoxH, 4, 4);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("HOW TO USE THIS SHEET", margin + 10, cursorY + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const instrLines = [
        "Goal: get every asset to Ready for Students ✓", "",
        "For each asset in the table below:",
        "1. Open the asset at: learn.surviveaccounting.com/solutions/[Ref]  (replace [Ref] with column 1, e.g. BE13.4)",
        "2. Read the Explanation section",
        "3. If correct and complete — circle: Ready ✓",
        "4. If something still looks wrong — circle: Needs Lee 🚩",
        "5. Log your decision in the admin tool at: learn.surviveaccounting.com/solutions-qa", "",
        "Tip: amber rows have a known issue flagged. Pay extra attention to these.",
        "Green rows are provisionally signed off — quick look still appreciated.", "",
        "When done: King can share findings in Slack. Thank you all — this is a huge help.",
      ];
      doc.text(instrLines.join("\n"), margin + 10, cursorY + 30, { maxWidth: pageW - margin * 2 - 20 });
      cursorY += instrBoxH + 10;

      // ── Course-wide summary table ──
      const courseTotals = { total: 0, fixApplied: 0, ready: 0, needsLee: 0, noStatus: 0 };
      const summaryRows = chapterDataArr.map(({ ch, stats }) => {
        courseTotals.total += stats.total;
        courseTotals.fixApplied += stats.fixApplied;
        courseTotals.ready += stats.ready;
        courseTotals.needsLee += stats.needsLee;
        courseTotals.noStatus += stats.noStatus;
        return [`Ch ${ch.chapter_number}: ${ch.chapter_name}`, String(stats.total), String(stats.fixApplied), String(stats.ready), String(stats.needsLee), String(stats.noStatus)];
      });
      summaryRows.push(["TOTAL", String(courseTotals.total), String(courseTotals.fixApplied), String(courseTotals.ready), String(courseTotals.needsLee), String(courseTotals.noStatus)]);

      autoTable(doc, {
        startY: cursorY,
        head: [["Chapter", "Total Assets", "Fix Applied", "Ready ✓", "Needs Lee", "No Status"]],
        body: summaryRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [20, 33, 61], textColor: 255, fontStyle: "bold", fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 200 },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
        },
        didParseCell: (data) => {
          // Bold total row
          if (data.section === "body" && data.row.index === summaryRows.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [230, 230, 230];
          }
        },
        didDrawPage: () => {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(130, 130, 130);
          doc.text(footerText, pageW / 2, pageH - 20, { align: "center" });
          doc.setTextColor(0, 0, 0);
        },
      });

      // ── PER-CHAPTER SECTIONS ──
      for (const { ch, assets, stats } of chapterDataArr) {
        doc.addPage();
        let cy = 30;

        // Chapter header bar
        const barH = 44;
        doc.setFillColor(20, 33, 61);
        doc.roundedRect(margin, cy, pageW - margin * 2, barH, 4, 4, "F");
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`Chapter ${ch.chapter_number} — ${ch.chapter_name}`, margin + 12, cy + 18);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`${stats.total} assets · ${stats.fixApplied} fix_applied · ${stats.ready} ready · ${stats.needsLee} needs_lee`, margin + 12, cy + 34);
        doc.setTextColor(0, 0, 0);
        cy += barH + 8;

        // Compact bulk fixes
        cy = drawBulkFixesBlock(doc, assets, stats.needsLee, ch.chapter_number, cy, margin, pageW, true);

        // Asset table
        drawAssetTable(doc, assets, issueMap, cy, margin, footerText);
      }

      doc.save(`QA-Review-IA2-Full-${dateISO}.pdf`);
      toast.success("Full course PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Full export failed");
    } finally {
      setRunningFull(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={running || runningFull}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Select chapter" />
        </SelectTrigger>
        <SelectContent>
          {chapters.map(ch => (
            <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}: {ch.chapter_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={handleExport} disabled={!selectedChapter || running || runningFull}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
        {running ? "Generating…" : "Export Review PDF"}
      </Button>
      <Button size="sm" variant="secondary" onClick={handleFullCourseExport} disabled={running || runningFull || chapters.length === 0}>
        {runningFull ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
        {runningFull ? "Building full course PDF… this may take 20-30 seconds" : "Export Full Course PDF →"}
      </Button>
    </div>
  );
}

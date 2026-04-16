import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { ChevronDown, ChevronRight, BookOpen, FileText, GraduationCap, Lock, Brain } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const NAVY = "#14213D";
const RED = "#CE1126";

interface CourseChapter {
  id: string;
  number: number;
  name: string;
}

interface ExplorerCourse {
  id: string;
  name: string;
  slug: string;
  status: "live" | "upcoming" | "future";
  chapters: CourseChapter[];
}

const COURSE_DATA: ExplorerCourse[] = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Intermediate Accounting 2",
    slug: "intermediate-accounting-2",
    status: "live",
    chapters: [
      { id: "ff12c70e-8d9f-4a8a-bc3c-d2fd42fcf2de", number: 13, name: "Long Term Liabilities" },
      { id: "71b37666-7f1a-4c88-bc47-d3cbedd37b49", number: 14, name: "Stockholder's Equity" },
      { id: "6e7d8d22-9d77-4e99-9e97-efa1b955bd89", number: 15, name: "Dilutive Securities and EPS" },
      { id: "65a9d581-f025-44d3-85cd-6462deec1532", number: 16, name: "Investments" },
      { id: "572e302c-30f6-42ba-aa5d-51d6bda24a2a", number: 17, name: "Revenue Recognition" },
      { id: "d6d10c34-1732-46dd-a741-c68daf1e480e", number: 18, name: "Income Taxes" },
      { id: "d3005950-75d6-4876-aa71-4ff49211703f", number: 19, name: "Pensions" },
      { id: "1e973354-ba1f-4629-830e-8a884fccd754", number: 20, name: "Leases" },
      { id: "f7a73bd7-65ff-494f-a06d-ac3cd380b7d8", number: 21, name: "Accounting Changes" },
      { id: "56c7d37a-cef2-4a9e-9004-3f7d958b9273", number: 22, name: "Statement of Cash Flows" },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Intro Accounting 2",
    slug: "intro-accounting-2",
    status: "upcoming",
    chapters: [
      { id: "45778a4f-2907-42c6-a150-391207976582", number: 12, name: "Cash Flow Statements" },
      { id: "810f6136-0304-4075-a976-c0663eb0c316", number: 13, name: "Financial Statement Analysis" },
      { id: "41ffcc30-171b-4389-83b2-8a54154bd72e", number: 14, name: "Managerial Accounting Concepts" },
      { id: "a8e3f5ff-c484-4a30-84cb-e1ec93591179", number: 15, name: "Job Order Costing" },
      { id: "eeb44863-192d-41a3-ae1b-701ac9a9ca19", number: 16, name: "Process Costing" },
      { id: "131d646c-37d5-4897-9500-6f28834a985c", number: 17, name: "Activity Based Costing" },
      { id: "0b650e6e-1ac6-4adb-80a5-6c63bb89cbd3", number: 18, name: "Cost Volume Profit" },
      { id: "1570a900-c92c-4fdb-a6bc-d79a66f0351f", number: 19, name: "Variable Costing" },
      { id: "72dfb3ad-6c9c-4477-a438-fed0e22c2a78", number: 20, name: "Master Budgets" },
      { id: "78efa3cf-6d22-4811-aa92-958516f5afde", number: 21, name: "Standard Costing" },
      { id: "e54e1541-a553-477d-93e7-d27ab03415be", number: 22, name: "Performance Measures" },
      { id: "de53322e-9964-412a-84ca-2160a6c159d7", number: 23, name: "Relevant Costing" },
      { id: "b989639f-9021-48a0-9198-83fe6cae887a", number: 24, name: "Capital Budgeting" },
    ],
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Intro Accounting 1",
    slug: "intro-accounting-1",
    status: "future",
    chapters: [
      { id: "e211854f-3ff4-4d5d-ba50-c7ccba24f0bf", number: 1, name: "Accounting in Business" },
      { id: "aa3bfc7a-a515-463c-9962-8e36a787bc52", number: 2, name: "Journalizing Transactions" },
      { id: "7a2f37f6-e211-4990-8674-a877ec3d602e", number: 3, name: "Adjusting Entries" },
      { id: "9aa455e5-5be1-4b10-8f68-79dbd80f048c", number: 4, name: "Merchandising" },
      { id: "d444dcb1-0ec0-48e7-b2ff-b3c2d0a43daa", number: 5, name: "FIFO/LIFO" },
      { id: "0be56e30-af34-48bc-9955-b3baff59ffe8", number: 6, name: "Cash & Internal Controls" },
      { id: "d4cd336f-95cf-4640-b233-88473a3550da", number: 7, name: "Receivables" },
      { id: "890e7db3-4485-40b2-81a4-fdf02723008f", number: 8, name: "Long Term Assets" },
      { id: "709e3c53-7877-4d1c-8bed-44da353b5623", number: 9, name: "Current Liabilities" },
      { id: "0aa9a1c6-bb12-424c-9e64-d6921d2ac7c3", number: 10, name: "Long Term Liabilities" },
      { id: "b479e31e-e594-43f0-8190-5d6f35bb3d73", number: 11, name: "Equity" },
    ],
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Intermediate Accounting 1",
    slug: "intermediate-accounting-1",
    status: "future",
    chapters: [
      { id: "b0ff4c5b-dad0-4bcc-9d8c-fecb33bc6c14", number: 1, name: "The Conceptual Framework" },
      { id: "ad7c99e3-f4a8-491e-a061-cc1a71c6251c", number: 2, name: "The Accounting System" },
      { id: "b7492915-f8e4-4008-acd6-5f1091748cbb", number: 3, name: "The Income Statement" },
      { id: "ba8fe10b-e910-4359-b8b0-3acfefc3679e", number: 4, name: "The Balance Sheet" },
      { id: "2cfa3f60-b534-46b1-b5b0-d56bad23a78c", number: 5, name: "Time Value of Money" },
      { id: "538ea27b-d155-41da-9daa-c783a1dabcb2", number: 6, name: "Cash & Receivables" },
      { id: "7591a930-ee49-4861-8457-17af58a88356", number: 7, name: "Inventories, Cost Approach" },
      { id: "b5a19bdc-8ffa-4138-8eff-e5f52ea336d7", number: 8, name: "Inventories, Additional Issues" },
      { id: "fec08715-402c-400e-bb57-3d9b877158ad", number: 9, name: "Property, Plant, and Equipment" },
      { id: "51f85b44-c889-45e6-b286-eb4bf9629461", number: 10, name: "Depreciation, Impairments, and Depletion" },
      { id: "2aaad478-8f19-4f5c-8519-677bcd1a42ef", number: 11, name: "Intangible Assets" },
      { id: "690afe15-71f8-4788-ab3f-1ac9114d7509", number: 12, name: "Current Liabilities" },
    ],
  },
];

type PreviewSection = "cram" | "be" | "ex" | "p";

interface PreviewState {
  chapterId: string;
  chapterNumber: number;
  chapterName: string;
  section: PreviewSection;
  problemId?: string;
}

interface CramCounts {
  formulas: number;
  jes: number;
  keyTerms: number;
  accounts: number;
  mistakes: number;
}

interface ProblemRow {
  id: string;
  source_ref: string;
  problem_title: string | null;
}

interface CourseExplorerSectionProps {
  onCtaClick: () => void;
}

/* ─── Highlight flash keyframes (injected once) ─── */
const HIGHLIGHT_STYLE_ID = "explorer-highlight-style";
function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    @keyframes explorer-glow {
      0% { background-color: rgba(206,17,38,0.10); }
      100% { background-color: transparent; }
    }
    .explorer-highlight {
      animation: explorer-glow 1.5s ease-out forwards;
      border-radius: 8px;
    }
  `;
  document.head.appendChild(style);
}

export default function CourseExplorerSection({ onCtaClick }: CourseExplorerSectionProps) {
  const [selectedCourseId, setSelectedCourseId] = useState(COURSE_DATA[0].id);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [expandedPractice, setExpandedPractice] = useState<string | null>(null); // chapterId that has practice expanded
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);

  const selectedCourse = useMemo(
    () => COURSE_DATA.find((c) => c.id === selectedCourseId)!,
    [selectedCourseId],
  );
  const isLive = selectedCourse.status === "live";

  // ─── Data fetching for selected chapter ───
  const activeChapterId = preview?.chapterId || null;

  const { data: cramCounts } = useQuery({
    queryKey: ["explorer-cram", activeChapterId],
    enabled: !!activeChapterId && isLive,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const chId = activeChapterId!;
      const [formulas, jes, keyTerms, accounts, mistakes] = await Promise.all([
        supabase.from("chapter_formulas").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("is_approved", true),
        supabase.from("chapter_journal_entries").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("is_approved", true),
        supabase.from("chapter_key_terms").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("is_approved", true),
        supabase.from("chapter_accounts").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("is_approved", true),
        (supabase as any).from("chapter_exam_mistakes").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("is_approved", true),
      ]);
      return {
        formulas: formulas.count || 0,
        jes: jes.count || 0,
        keyTerms: keyTerms.count || 0,
        accounts: accounts.count || 0,
        mistakes: mistakes.count || 0,
      } as CramCounts;
    },
  });

  const { data: problems } = useQuery({
    queryKey: ["explorer-problems", activeChapterId],
    enabled: !!activeChapterId && isLive,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("teaching_assets")
        .select("id, source_ref, problem_title")
        .eq("chapter_id", activeChapterId!)
        .eq("status", "approved")
        .order("source_ref");
      return (data || []) as ProblemRow[];
    },
  });

  const groupedProblems = useMemo(() => {
    const g: Record<string, ProblemRow[]> = { be: [], ex: [], p: [] };
    (problems || []).forEach((p) => {
      const s = (p.source_ref || "").toUpperCase();
      if (s.startsWith("BE") || s.startsWith("QS")) g.be.push(p);
      else if (s.startsWith("E")) g.ex.push(p);
      else g.p.push(p);
    });
    return g;
  }, [problems]);

  // ─── Highlight + scroll logic ───
  useEffect(() => { ensureHighlightStyle(); }, []);

  const flashAndScroll = useCallback((targetId: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (!el || !previewPaneRef.current) return;
      // scroll within preview pane
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("explorer-highlight");
      void el.offsetWidth; // reflow
      el.classList.add("explorer-highlight");
    });
  }, []);

  const handleSidebarClick = useCallback(
    (chId: string, chNum: number, chName: string, section: PreviewSection, problemId?: string) => {
      setPreview({ chapterId: chId, chapterNumber: chNum, chapterName: chName, section, problemId });
      const targetId = problemId ? `prob-${problemId}` : `section-${section}`;
      setTimeout(() => flashAndScroll(targetId), 120);
    },
    [flashAndScroll],
  );

  const handleChapterToggle = (chapterId: string) => {
    if (expandedChapterId === chapterId) {
      setExpandedChapterId(null);
      setExpandedPractice(null);
    } else {
      setExpandedChapterId(chapterId);
      setExpandedPractice(null);
    }
  };

  const togglePractice = (chapterId: string) => {
    setExpandedPractice((prev) => (prev === chapterId ? null : chapterId));
  };

  // ─── Preview content rendering ───
  const renderCramPreview = () => {
    if (!cramCounts) {
      return (
        <div className="space-y-3 p-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      );
    }
    const items = [
      { label: "Formulas", count: cramCounts.formulas, icon: "📐" },
      { label: "Journal Entries", count: cramCounts.jes, icon: "📒" },
      { label: "Key Terms", count: cramCounts.keyTerms, icon: "📖" },
      { label: "Accounts", count: cramCounts.accounts, icon: "🏦" },
      { label: "Exam Mistakes", count: cramCounts.mistakes, icon: "⚠️" },
    ].filter((i) => i.count > 0);

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-4 transition-all"
            style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}
          >
            <div className="text-xl mb-1">{item.icon}</div>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>{item.count}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{item.label}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderProblemList = (type: "be" | "ex" | "p", label: string) => {
    const items = groupedProblems[type];
    if (!items || items.length === 0) return null;
    return (
      <div>
        <p className="text-[12px] font-semibold mb-2 flex items-center gap-2" style={{ color: NAVY }}>
          {label}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: RED, color: "#fff", minWidth: 20, textAlign: "center" }}
          >
            {items.length}
          </span>
        </p>
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-1">
          {items.map((p) => (
            <div
              key={p.id}
              id={`prob-${p.id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors cursor-default"
              style={{
                background: preview?.problemId === p.id ? "rgba(20,33,61,0.06)" : "transparent",
                color: "#4B5563",
              }}
            >
              <span className="font-mono text-[11px] shrink-0 w-[52px]" style={{ color: "#9CA3AF" }}>
                {p.source_ref || "—"}
              </span>
              <span className="truncate">{p.problem_title ? p.problem_title.slice(0, 55) : p.source_ref}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPreviewContent = () => {
    if (!preview) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <BookOpen className="w-10 h-10 mx-auto" style={{ color: "#D1D5DB" }} />
            <p className="text-[16px] font-semibold" style={{ color: NAVY }}>
              Select a chapter to preview
            </p>
            <p className="text-[13px] max-w-[300px]" style={{ color: "#9CA3AF" }}>
              Click any chapter on the left, then explore the content.
            </p>
          </div>
        </div>
      );
    }

    if (!isLive) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <Lock className="w-10 h-10 mx-auto" style={{ color: "#D1D5DB" }} />
            <p className="text-[16px] font-semibold" style={{ color: NAVY }}>Coming Soon</p>
            <p className="text-[13px] max-w-[300px]" style={{ color: "#9CA3AF" }}>
              This course is still being built. Sign up to get notified when it launches.
            </p>
          </div>
        </div>
      );
    }

    const totalProblems = (groupedProblems.be?.length || 0) + (groupedProblems.ex?.length || 0) + (groupedProblems.p?.length || 0);

    return (
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={previewPaneRef} className="p-5 space-y-6">
            {/* Chapter header */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>
                Chapter {preview.chapterNumber}
              </p>
              <h3 className="text-[20px] font-bold" style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}>
                {preview.chapterName}
              </h3>
            </div>

            {/* Cram Tools */}
            <div id="section-cram">
              <p className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                <Brain className="w-4 h-4" />
                Chapter Cram Tools
              </p>
              {renderCramPreview()}
            </div>

            {/* Practice Problems */}
            <div id="section-be">
              <p className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                <FileText className="w-4 h-4" />
                Practice Problems
                {totalProblems > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(20,33,61,0.08)", color: NAVY }}>
                    {totalProblems} total
                  </span>
                )}
              </p>
              {!problems ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  <div id="section-be">{renderProblemList("be", "Brief Exercises")}</div>
                  <div id="section-ex">{renderProblemList("ex", "Exercises")}</div>
                  <div id="section-p">{renderProblemList("p", "Problems")}</div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "#EDEEF1" }}>
      <div className="mx-auto max-w-[1000px]">
        {/* Header */}
        <div className="text-center mb-10">
          <h2
            className="text-[24px] sm:text-[30px] font-bold tracking-tight mb-2"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            Preview before you buy
          </h2>
          <p
            className="text-[14px] sm:text-[15px] font-medium mb-1"
            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            Click around — this is the real course.
          </p>
          <p
            className="text-[13px] sm:text-[14px]"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            No demos. This is exactly what you'll use.
          </p>
        </div>

        {/* Explorer */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex flex-col lg:flex-row" style={{ minHeight: 520 }}>
            {/* Left sidebar */}
            <div
              className="w-full lg:w-[300px] shrink-0 flex flex-col"
              style={{ borderRight: "1px solid #F0F0F0" }}
            >
              {/* Course dropdown */}
              <div className="p-4" style={{ borderBottom: "1px solid #F0F0F0" }}>
                <label
                  className="block text-[11px] font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
                >
                  Course
                </label>
                <div className="relative">
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setExpandedChapterId(null);
                      setExpandedPractice(null);
                      setPreview(null);
                    }}
                    className="w-full appearance-none rounded-lg px-3 py-2.5 pr-8 text-[14px] font-semibold cursor-pointer outline-none focus:ring-2"
                    style={{
                      background: "#F8F9FA",
                      border: "1px solid #E5E7EB",
                      color: NAVY,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {COURSE_DATA.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.status !== "live" ? " (Coming Soon)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "#9CA3AF" }}
                  />
                </div>
              </div>

              {/* Chapter list */}
              <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 460 }}>
                {selectedCourse.chapters.map((ch) => {
                  const isExpanded = expandedChapterId === ch.id;
                  const isPracticeExpanded = expandedPractice === ch.id;
                  const isCramActive = preview?.chapterId === ch.id && preview?.section === "cram";
                  const isPracticeActive = preview?.chapterId === ch.id && ["be", "ex", "p"].includes(preview?.section || "");

                  return (
                    <div key={ch.id} className="mb-0.5">
                      <button
                        onClick={() => handleChapterToggle(ch.id)}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-[13px] font-medium"
                        style={{
                          color: isExpanded ? NAVY : "#4B5563",
                          background: isExpanded ? "rgba(20,33,61,0.06)" : "transparent",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#9CA3AF" }} />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#9CA3AF" }} />
                        )}
                        <span className="truncate">
                          Ch {ch.number} · {ch.name}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="ml-6 pl-3 py-1 space-y-0.5" style={{ borderLeft: "2px solid #E5E7EB" }}>
                          {/* Chapter Cram Tools */}
                          <button
                            onClick={() => handleSidebarClick(ch.id, ch.number, ch.name, "cram")}
                            className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors text-[12px] hover:bg-gray-50"
                            style={{
                              color: isCramActive ? NAVY : "#6B7280",
                              fontWeight: isCramActive ? 600 : 400,
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            <Brain className="w-3.5 h-3.5 shrink-0" />
                            <span>Chapter Cram Tools</span>
                          </button>

                          {/* Practice Problems (expandable) */}
                          <button
                            onClick={() => {
                              togglePractice(ch.id);
                              handleSidebarClick(ch.id, ch.number, ch.name, "be");
                            }}
                            className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors text-[12px] hover:bg-gray-50"
                            style={{
                              color: isPracticeActive ? NAVY : "#6B7280",
                              fontWeight: isPracticeActive ? 600 : 400,
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>Practice Problems</span>
                            <ChevronRight
                              className="w-3 h-3 ml-auto shrink-0 transition-transform duration-200"
                              style={{
                                color: "#9CA3AF",
                                transform: isPracticeExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              }}
                            />
                          </button>

                          {/* Practice subcategories */}
                          {isPracticeExpanded && (
                            <div className="ml-5 pl-2 py-0.5 space-y-0.5" style={{ borderLeft: "1px solid #E5E7EB" }}>
                              {([["be", "Brief Exercises"], ["ex", "Exercises"], ["p", "Problems"]] as const).map(
                                ([key, label]) => (
                                  <button
                                    key={key}
                                    onClick={() => handleSidebarClick(ch.id, ch.number, ch.name, key)}
                                    className="w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors hover:bg-gray-50"
                                    style={{
                                      color: preview?.section === key && preview?.chapterId === ch.id ? NAVY : "#9CA3AF",
                                      fontWeight: preview?.section === key && preview?.chapterId === ch.id ? 600 : 400,
                                      fontFamily: "Inter, sans-serif",
                                    }}
                                  >
                                    {label}
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right preview pane */}
            <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0">
              {renderPreviewContent()}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={onCtaClick}
            className="rounded-xl px-8 py-4 text-[16px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: RED,
              boxShadow: "0 4px 16px rgba(206,17,38,0.25)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Start Studying →
          </button>
        </div>
      </div>
    </section>
  );
}

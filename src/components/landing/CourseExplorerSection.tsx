import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, BookOpen, FileText, Lock, Brain, MessageCircle, X, Send, Sparkles, Target, BookOpenCheck, Check } from "lucide-react";

// Motion presets — subtle, premium, quick
const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
const stagger = (delayChildren = 0, staggerChildren = 0.06) => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
});
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  shortName: string;
  slug: string;
  status: "live" | "upcoming" | "future";
  chapters: CourseChapter[];
}

const COURSE_DATA: ExplorerCourse[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Intro Accounting 1",
    shortName: "Intro 1",
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
    id: "22222222-2222-2222-2222-222222222222",
    name: "Intro Accounting 2",
    shortName: "Intro 2",
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
    id: "33333333-3333-3333-3333-333333333333",
    name: "Intermediate Accounting 1",
    shortName: "Intermediate 1",
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
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Intermediate Accounting 2",
    shortName: "Intermediate 2",
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
];

type StudyTool = "practice" | "je";

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

export default function CourseExplorerSection({ onCtaClick }: CourseExplorerSectionProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<StudyTool | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionSending, setQuestionSending] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const chapterStepRef = useRef<HTMLDivElement>(null);
  const toolStepRef = useRef<HTMLDivElement>(null);

  const selectedCourse = useMemo(
    () => COURSE_DATA.find((c) => c.id === selectedCourseId) || null,
    [selectedCourseId],
  );
  const selectedChapter = useMemo(
    () => selectedCourse?.chapters.find((c) => c.id === selectedChapterId) || null,
    [selectedCourse, selectedChapterId],
  );
  const isLive = selectedCourse?.status === "live";

  // Reset cascading when parents change
  const handleCourseChange = (id: string) => {
    setSelectedCourseId(id);
    setSelectedChapterId(null);
    setSelectedTool(null);
    setTimeout(() => chapterStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const handleChapterChange = (id: string) => {
    setSelectedChapterId(id || null);
    setSelectedTool(null);
    if (id) {
      setTimeout(() => toolStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  };

  const handleToolPick = (tool: StudyTool) => {
    setSelectedTool(tool);
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // ─── Data ───
  const { data: cramCounts } = useQuery({
    queryKey: ["explorer-cram", selectedChapterId],
    enabled: !!selectedChapterId && isLive,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const chId = selectedChapterId!;
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
    queryKey: ["explorer-problems", selectedChapterId],
    enabled: !!selectedChapterId && isLive,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("teaching_assets")
        .select("id, source_ref, problem_title")
        .eq("chapter_id", selectedChapterId!)
        .eq("status", "approved")
        .order("source_ref");
      return (data || []) as ProblemRow[];
    },
  });

  const groupedProblems = useMemo(() => {
    const g: Record<"be" | "ex" | "p", ProblemRow[]> = { be: [], ex: [], p: [] };
    (problems || []).forEach((p) => {
      const s = (p.source_ref || "").toUpperCase();
      if (s.startsWith("BE") || s.startsWith("QS")) g.be.push(p);
      else if (s.startsWith("E")) g.ex.push(p);
      else g.p.push(p);
    });
    return g;
  }, [problems]);

  // ─── Preview renderers ───
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
        <div className="space-y-0.5">
          {items.slice(0, 12).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
              style={{ color: "#4B5563" }}
            >
              <span className="font-mono text-[11px] shrink-0 w-[52px]" style={{ color: "#9CA3AF" }}>
                {p.source_ref || "—"}
              </span>
              <span className="truncate">{p.problem_title ? p.problem_title.slice(0, 60) : p.source_ref}</span>
            </div>
          ))}
          {items.length > 12 && (
            <p className="text-[11px] px-3 py-1.5" style={{ color: "#9CA3AF" }}>
              + {items.length - 12} more
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderPracticePreview = () => {
    if (!isLive) return renderComingSoon();
    const totalProblems = groupedProblems.be.length + groupedProblems.ex.length + groupedProblems.p.length;
    return (
      <div className="p-5 space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>
            Chapter {selectedChapter!.number} · Practice Problem Helper
          </p>
          <h3 className="text-[20px] font-bold flex items-center gap-2" style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}>
            <FileText className="w-5 h-5" style={{ color: RED }} />
            {selectedChapter!.name}
            {totalProblems > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(20,33,61,0.08)", color: NAVY }}>
                {totalProblems} problems
              </span>
            )}
          </h3>
        </div>
        {!problems ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-5">
            {renderProblemList("be", "Brief Exercises")}
            {renderProblemList("ex", "Exercises")}
            {renderProblemList("p", "Problems")}
          </div>
        )}
        <div
          className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-[12px]"
          style={{ background: "rgba(20,33,61,0.03)", border: "1px dashed #D1D5DB", color: "#6B7280" }}
        >
          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "#9CA3AF" }} />
          Walkthroughs, hints, and challenge questions unlock with full access.
        </div>
      </div>
    );
  };

  const renderJEPreview = () => {
    if (!isLive) return renderComingSoon();
    if (!cramCounts) {
      return (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      );
    }
    const items = [
      { label: "Journal Entries", count: cramCounts.jes, icon: "📒" },
      { label: "Accounts", count: cramCounts.accounts, icon: "🏦" },
      { label: "Formulas", count: cramCounts.formulas, icon: "📐" },
      { label: "Key Terms", count: cramCounts.keyTerms, icon: "📖" },
      { label: "Exam Mistakes", count: cramCounts.mistakes, icon: "⚠️" },
    ].filter((i) => i.count > 0);

    return (
      <div className="p-5 space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>
            Chapter {selectedChapter!.number} · Journal Entry Helper
          </p>
          <h3 className="text-[20px] font-bold flex items-center gap-2" style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}>
            <Brain className="w-5 h-5" style={{ color: RED }} />
            {selectedChapter!.name}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-4"
              style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}
            >
              <div className="text-xl mb-1">{item.icon}</div>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>{item.count}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{item.label}</p>
            </div>
          ))}
        </div>
        <div
          className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-[12px]"
          style={{ background: "rgba(20,33,61,0.03)", border: "1px dashed #D1D5DB", color: "#6B7280" }}
        >
          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "#9CA3AF" }} />
          Interactive debits, credits, and walkthroughs unlock with full access.
        </div>
      </div>
    );
  };

  const renderComingSoon = () => (
    <div className="flex items-center justify-center p-12">
      <div className="text-center space-y-3">
        <Lock className="w-10 h-10 mx-auto" style={{ color: "#D1D5DB" }} />
        <p className="text-[16px] font-semibold" style={{ color: NAVY }}>Coming Soon</p>
        <p className="text-[13px] max-w-[300px] mx-auto" style={{ color: "#9CA3AF" }}>
          This course is still being built. Sign up to get notified when it launches.
        </p>
      </div>
    </div>
  );

  const handleQuestionSubmit = async () => {
    if (!questionText.trim()) return;
    setQuestionSending(true);
    try {
      await supabase.functions.invoke("send-contact-notification", {
        body: { name: "Course Preview Visitor", email: "anonymous@preview", message: questionText.trim() },
      });
      toast.success("Question sent — we'll get back to you!");
      setQuestionText("");
      setQuestionOpen(false);
    } catch {
      toast.error("Couldn't send. Try again.");
    } finally {
      setQuestionSending(false);
    }
  };

  // ─── Render ───
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: "#EDEEF1" }}>
      <div className="mx-auto max-w-[1120px]">
        {/* Header */}
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial="hidden"
          animate="show"
          variants={stagger(0, 0.08)}
        >
          <motion.h2
            variants={fadeUp}
            className="text-[26px] sm:text-[34px] font-bold tracking-tight mb-3"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            Built for last-minute accounting studying.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-[14px] sm:text-[16px] max-w-[620px] mx-auto"
            style={{ color: "#4B5563", fontFamily: "Inter, sans-serif" }}
          >
            Pick a course, choose a chapter, and explore the tools built to help you cram smarter for finals.
          </motion.p>
        </motion.div>

        {/* Step 1: Course pills */}
        <StepLabel number={1} label="Choose your course" active={!selectedCourseId} done={!!selectedCourseId} />
        <motion.div
          className="flex flex-wrap justify-center gap-2.5 mb-10"
          initial="hidden"
          animate="show"
          variants={stagger(0.1, 0.05)}
        >
          {COURSE_DATA.map((c) => {
            const isActive = selectedCourseId === c.id;
            return (
              <motion.button
                variants={fadeUp}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                key={c.id}
                onClick={() => handleCourseChange(c.id)}
                className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold"
                style={{
                  background: isActive ? NAVY : "#fff",
                  color: isActive ? "#fff" : NAVY,
                  border: `1px solid ${isActive ? NAVY : "#E5E7EB"}`,
                  boxShadow: isActive ? "0 6px 16px rgba(20,33,61,0.18)" : "0 1px 2px rgba(0,0,0,0.03)",
                  fontFamily: "Inter, sans-serif",
                  transition: "background 0.25s ease, color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
                }}
              >
                {c.shortName}
                {c.status !== "live" && (
                  <span
                    className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.18)" : "rgba(20,33,61,0.06)",
                      color: isActive ? "rgba(255,255,255,0.85)" : "#6B7280",
                    }}
                  >
                    Soon
                  </span>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Step 2: Chapter dropdown — only after a course is chosen */}
        <AnimatePresence initial={false}>
          {selectedCourseId && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ overflow: "hidden" }}
            >
              <div ref={chapterStepRef}>
                <StepLabel
                  number={2}
                  label="Choose a chapter"
                  active={!selectedChapterId}
                  done={!!selectedChapterId}
                />
              </div>
              <div className="max-w-[480px] mx-auto mb-10">
                <div className="relative">
                  <select
                    value={selectedChapterId || ""}
                    onChange={(e) => handleChapterChange(e.target.value)}
                    className="w-full appearance-none rounded-xl px-4 py-3.5 pr-10 text-[14.5px] font-semibold cursor-pointer outline-none transition-all"
                    style={{
                      background: "#fff",
                      border: `1px solid ${selectedChapterId ? NAVY : "#E5E7EB"}`,
                      color: NAVY,
                      fontFamily: "Inter, sans-serif",
                      boxShadow: selectedChapterId
                        ? "0 4px 14px rgba(20,33,61,0.10)"
                        : "0 0 0 4px rgba(20,33,61,0.06), 0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <option value="">Select a chapter…</option>
                    {selectedCourse?.chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        Ch {ch.number} · {ch.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: NAVY }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Study tool cards — only after a chapter is chosen */}
        <AnimatePresence initial={false}>
          {selectedChapterId && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ overflow: "hidden" }}
            >
              <div ref={toolStepRef}>
                <StepLabel
                  number={3}
                  label="Pick a study tool"
                  active={!selectedTool}
                  done={!!selectedTool}
                />
              </div>
              <motion.div
                className="grid sm:grid-cols-2 gap-5 mb-12"
                initial="hidden"
                animate="show"
                variants={stagger(0.05, 0.07)}
              >
                <motion.div variants={fadeUp}>
                  <ToolCard
                    title="Practice Problem Helper"
                    description="Practice smarter with walkthroughs, hints, challenge questions, and deeper explanations."
                    icon={<Target className="w-6 h-6" strokeWidth={2.2} />}
                    active={selectedTool === "practice"}
                    disabled={false}
                    onClick={() => handleToolPick("practice")}
                  />
                </motion.div>
                <motion.div variants={fadeUp}>
                  <ToolCard
                    title="Journal Entry Helper"
                    description="Understand debits, credits, accounts, and calculations in a way that actually sticks."
                    icon={<BookOpenCheck className="w-6 h-6" strokeWidth={2.2} />}
                    active={selectedTool === "je"}
                    disabled={false}
                    onClick={() => handleToolPick("je")}
                  />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview pane (only when a tool is chosen) */}
        <AnimatePresence mode="wait">
          {selectedTool && selectedChapter && (
            <motion.div
              key="preview-shell"
              ref={previewRef}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <motion.div
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mb-5"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: 0.05 }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{ width: 18, height: 18, background: RED }}
                  >
                    <span className="block rounded-full" style={{ width: 6, height: 6, background: "#fff" }} />
                  </span>
                  <p
                    className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                  >
                    Now previewing:{" "}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={selectedTool}
                        style={{ color: RED, display: "inline-block" }}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.22, ease: EASE }}
                      >
                        {selectedTool === "practice" ? "Practice Problem Helper" : "Journal Entry Helper"}
                      </motion.span>
                    </AnimatePresence>
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    background: "rgba(206,17,38,0.08)",
                    color: RED,
                    border: "1px solid rgba(206,17,38,0.25)",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <Sparkles className="w-3 h-3" strokeWidth={2.5} />
                  Beta Preview
                </span>
              </motion.div>

              {/* Browser-style frame */}
              <motion.div
                className="rounded-2xl overflow-hidden relative mx-auto"
                style={{
                  background: "#fff",
                  boxShadow:
                    "0 30px 80px -20px rgba(20,33,61,0.28), 0 12px 30px -10px rgba(20,33,61,0.18), 0 0 0 1px rgba(20,33,61,0.06)",
                  maxWidth: "100%",
                }}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: EASE, delay: 0.05 }}
              >
                {/* Browser chrome */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 border-b"
                  style={{ background: "linear-gradient(180deg, #F7F8FA 0%, #EFF1F4 100%)", borderColor: "#E2E5EA" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="block w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F57" }} />
                    <span className="block w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
                    <span className="block w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
                  </div>
                  <div
                    className="flex-1 mx-2 sm:mx-4 hidden sm:flex items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-medium truncate"
                    style={{
                      background: "#fff",
                      border: "1px solid #E2E5EA",
                      color: "#6B7280",
                      fontFamily: "Inter, sans-serif",
                      maxWidth: 420,
                    }}
                  >
                    learn.surviveaccounting.com/
                    {selectedTool === "practice" ? "practice" : "journal-entry"}
                  </div>
                  <button
                    onClick={() => setQuestionOpen(true)}
                    className="hidden sm:flex items-center gap-1.5 text-[11.5px] font-medium transition-colors hover:underline"
                    style={{ color: "#6B7280" }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Have questions?
                  </button>
                </div>

                <ScrollArea style={{ maxHeight: 620 }}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={selectedTool}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.28, ease: EASE }}
                    >
                      {selectedTool === "practice" ? renderPracticePreview() : renderJEPreview()}
                    </motion.div>
                  </AnimatePresence>
                </ScrollArea>

                {/* Sticky CTA */}
                <div
                  className="px-5 py-3.5 flex items-center justify-between gap-3"
                  style={{ borderTop: "1px solid #E5E7EB", background: "rgba(248,249,250,0.95)", backdropFilter: "blur(8px)" }}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" style={{ color: RED }} />
                    <p className="text-[13px] font-semibold truncate" style={{ color: NAVY }}>
                      Like what you see? Unlock the full toolkit.
                    </p>
                  </div>
                  <button
                    onClick={onCtaClick}
                    className="shrink-0 rounded-lg px-5 py-2.5 text-[13px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{ background: RED, boxShadow: "0 2px 8px rgba(206,17,38,0.2)" }}
                  >
                    Get Access →
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Microcopy under flow */}
        <p
          className="mt-6 text-center text-[12.5px]"
          style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
        >
          Free during finals. No credit card needed. Help us improve it with your feedback.
        </p>

        {/* Questions modal */}
        {questionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div
              className="relative w-full max-w-sm rounded-2xl p-6 space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
              style={{ background: "#fff", boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25)" }}
            >
              <button
                onClick={() => setQuestionOpen(false)}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" style={{ color: "#9CA3AF" }} />
              </button>
              <div>
                <h3 className="text-[18px] font-semibold" style={{ color: NAVY }}>Have a question?</h3>
                <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>Ask anything — I'll get back to you personally.</p>
              </div>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="What would you like to know?"
                rows={4}
                className="w-full rounded-xl px-4 py-3 text-[14px] outline-none resize-none transition-all"
                style={{ background: "#F8F9FA", border: "1px solid #E5E7EB", color: NAVY }}
              />
              <button
                onClick={handleQuestionSubmit}
                disabled={questionSending || !questionText.trim()}
                className="w-full rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
                style={{ minHeight: 44, background: NAVY }}
              >
                {questionSending ? "Sending…" : <><Send className="w-4 h-4" /> Send Question</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────── Subcomponents ───────── */

function StepLabel({
  number,
  label,
  active,
  done,
  disabled,
}: {
  number: number;
  label: string;
  active?: boolean;
  done?: boolean;
  disabled?: boolean;
}) {
  const color = disabled ? "#B7BCC4" : done ? "#6B7280" : active ? NAVY : "#6B7280";
  const dotBg = disabled ? "#E5E7EB" : done ? NAVY : active ? RED : "#D1D5DB";
  const dotColor = disabled ? "#9CA3AF" : "#fff";
  return (
    <div className="flex items-center justify-center gap-2.5 mb-4">
      <span
        className="inline-flex items-center justify-center text-[11px] font-bold rounded-full"
        style={{ background: dotBg, color: dotColor, width: 22, height: 22, fontFamily: "Inter, sans-serif" }}
      >
        {number}
      </span>
      <span
        className="text-[12px] font-semibold uppercase tracking-[0.12em]"
        style={{ color, fontFamily: "Inter, sans-serif" }}
      >
        Step {number} — {label}
      </span>
    </div>
  );
}

function ToolCard({
  title,
  description,
  icon,
  active,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left rounded-2xl p-6 sm:p-7 transition-all duration-200 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: "#fff",
        color: NAVY,
        border: `${active ? 2 : 1}px solid ${active ? RED : "#E5E7EB"}`,
        boxShadow: active
          ? "0 18px 44px rgba(206,17,38,0.18), 0 4px 12px rgba(20,33,61,0.06)"
          : disabled
          ? "0 1px 2px rgba(0,0,0,0.02)"
          : "0 4px 14px rgba(20,33,61,0.06)",
        transform: active ? "translateY(-3px)" : "translateY(0)",
        opacity: disabled ? 0.45 : 1,
        fontFamily: "Inter, sans-serif",
        minHeight: 168,
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(20,33,61,0.10)";
        e.currentTarget.style.borderColor = "#C7CCD4";
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(20,33,61,0.06)";
        e.currentTarget.style.borderColor = "#E5E7EB";
      }}
    >
      {active && (
        <span
          className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider"
          style={{
            background: RED,
            color: "#fff",
            boxShadow: "0 2px 8px rgba(206,17,38,0.30)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <Check className="w-3 h-3" strokeWidth={3} />
          Previewing
        </span>
      )}

      <span
        className="inline-flex items-center justify-center rounded-xl w-12 h-12 shrink-0 mb-4 transition-all"
        style={{
          background: active
            ? "linear-gradient(135deg, #CE1126 0%, #A8101F 100%)"
            : "rgba(206,17,38,0.08)",
          color: active ? "#fff" : RED,
          boxShadow: active ? "0 6px 16px rgba(206,17,38,0.28)" : "none",
        }}
      >
        {icon}
      </span>

      <h3 className="text-[17px] sm:text-[18px] font-bold mb-1.5 leading-tight" style={{ color: NAVY }}>
        {title}
      </h3>
      <p className="text-[13.5px] leading-relaxed" style={{ color: "#5B6573" }}>
        {description}
      </p>
    </button>
  );
}

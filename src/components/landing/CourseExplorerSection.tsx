import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, BookOpen, FileText, GraduationCap, Lock, Eye } from "lucide-react";

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

type PreviewItem = {
  type: "chapter-hub" | "practice";
  chapterId: string;
  chapterNumber: number;
  chapterName: string;
};

interface CourseExplorerSectionProps {
  onCtaClick: () => void;
}

export default function CourseExplorerSection({ onCtaClick }: CourseExplorerSectionProps) {
  const [selectedCourseId, setSelectedCourseId] = useState(COURSE_DATA[0].id);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  const selectedCourse = useMemo(
    () => COURSE_DATA.find((c) => c.id === selectedCourseId)!,
    [selectedCourseId],
  );

  const isLive = selectedCourse.status === "live";

  const handleChapterToggle = (chapterId: string) => {
    setExpandedChapterId((prev) => (prev === chapterId ? null : chapterId));
  };

  const handlePreviewClick = (item: PreviewItem) => {
    setPreview(item);
  };

  const previewUrl = useMemo(() => {
    if (!preview) return null;
    if (preview.type === "chapter-hub") {
      return `/cram/${preview.chapterId}?preview=true`;
    }
    return `/cram/${preview.chapterId}?preview=true`;
  }, [preview]);

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "#EDEEF1" }}>
      <div className="mx-auto max-w-[1000px]">
        {/* Header */}
        <div className="text-center mb-10">
          <p
            className="text-[14px] sm:text-[15px] font-medium mb-2"
            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            Click around — this is the actual course.
          </p>
          <p
            className="text-[13px] sm:text-[14px] mb-1"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            No demos. No marketing version. This is exactly what you'll use.
          </p>
          <p
            className="text-[12px] sm:text-[13px] italic mb-6"
            style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
          >
            I've been building and refining this since 2020 based on real student sessions.
          </p>
          <h2
            className="text-[24px] sm:text-[30px] font-bold tracking-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            Explore the course
          </h2>
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
          <div className="flex flex-col lg:flex-row min-h-[480px]">
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
              <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 420 }}>
                {selectedCourse.chapters.map((ch) => {
                  const isExpanded = expandedChapterId === ch.id;
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
                          <button
                            onClick={() =>
                              handlePreviewClick({
                                type: "chapter-hub",
                                chapterId: ch.id,
                                chapterNumber: ch.number,
                                chapterName: ch.name,
                              })
                            }
                            className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors text-[12px] hover:bg-gray-50"
                            style={{
                              color: preview?.chapterId === ch.id && preview?.type === "chapter-hub" ? NAVY : "#6B7280",
                              fontWeight: preview?.chapterId === ch.id && preview?.type === "chapter-hub" ? 600 : 400,
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                            <span>Survive This Chapter</span>
                            {isLive ? (
                              <Eye className="w-3 h-3 ml-auto shrink-0" style={{ color: "#22C55E" }} />
                            ) : (
                              <Lock className="w-3 h-3 ml-auto shrink-0" style={{ color: "#D1D5DB" }} />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              handlePreviewClick({
                                type: "practice",
                                chapterId: ch.id,
                                chapterNumber: ch.number,
                                chapterName: ch.name,
                              })
                            }
                            className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors text-[12px] hover:bg-gray-50"
                            style={{
                              color: preview?.chapterId === ch.id && preview?.type === "practice" ? NAVY : "#6B7280",
                              fontWeight: preview?.chapterId === ch.id && preview?.type === "practice" ? 600 : 400,
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>Practice Problems</span>
                            {isLive ? (
                              <Eye className="w-3 h-3 ml-auto shrink-0" style={{ color: "#22C55E" }} />
                            ) : (
                              <Lock className="w-3 h-3 ml-auto shrink-0" style={{ color: "#D1D5DB" }} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right preview */}
            <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0">
              {preview && previewUrl ? (
                <>
                  {/* Preview header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: "1px solid #F0F0F0" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                        style={{ background: isLive ? "#22C55E" : "#9CA3AF" }}
                      >
                        {isLive ? "Preview available" : "Coming soon"}
                      </span>
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                      >
                        Ch {preview.chapterNumber} · {preview.chapterName}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>
                      This is exactly how the course is structured.
                    </span>
                  </div>

                  {/* Preview content */}
                  {isLive ? (
                    <div className="flex-1 relative">
                      <iframe
                        key={previewUrl}
                        src={previewUrl}
                        className="absolute inset-0 w-full h-full"
                        style={{ border: "none" }}
                        title={`Preview: Ch ${preview.chapterNumber}`}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="text-center space-y-3">
                        <Lock className="w-10 h-10 mx-auto" style={{ color: "#D1D5DB" }} />
                        <p className="text-[16px] font-semibold" style={{ color: NAVY }}>
                          Coming Soon
                        </p>
                        <p className="text-[13px] max-w-[300px]" style={{ color: "#9CA3AF" }}>
                          This course is still being built. Sign up to get notified when it launches.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center space-y-3">
                    <BookOpen className="w-10 h-10 mx-auto" style={{ color: "#D1D5DB" }} />
                    <p className="text-[16px] font-semibold" style={{ color: NAVY }}>
                      Select a chapter to preview
                    </p>
                    <p className="text-[13px] max-w-[300px]" style={{ color: "#9CA3AF" }}>
                      Click any chapter on the left, then choose what you'd like to explore.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Debug strip */}
          <div
            className="px-4 py-2 text-[10px] font-mono flex flex-wrap gap-x-4 gap-y-1"
            style={{ background: "#F5F5F5", borderTop: "1px solid #E5E7EB", color: "#9CA3AF" }}
          >
            <span>🛠 course: {selectedCourse.name}</span>
            <span>chapter: {preview ? `Ch ${preview.chapterNumber}` : "—"}</span>
            <span>preview: {previewUrl || "—"}</span>
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

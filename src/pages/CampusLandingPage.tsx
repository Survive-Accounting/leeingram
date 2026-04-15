import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CampusHeader from "@/components/campus/CampusHeader";
import PreviewPurchaseBar from "@/components/PreviewPurchaseBar";
import { BookOpen, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChapterGrid from "@/components/campus/ChapterGrid";
import { useEventTracking } from "@/hooks/useEventTracking";

const COURSE_SLUG_MAP: Record<string, string> = {
  "intermediate-accounting-2": "44444444-4444-4444-4444-444444444444",
  "intermediate-accounting-1": "33333333-3333-3333-3333-333333333333",
  "intro-accounting-1": "11111111-1111-1111-1111-111111111111",
  "intro-accounting-2": "22222222-2222-2222-2222-222222222222",
};

const COURSE_NAMES: Record<string, string> = {
  "intermediate-accounting-2": "Intermediate Accounting 2",
  "intermediate-accounting-1": "Intermediate Accounting 1",
  "intro-accounting-1": "Introductory Accounting 1",
  "intro-accounting-2": "Introductory Accounting 2",
};

const TYPE_LABELS: Record<string, string> = {
  BE: "Brief Exercises",
  EX: "Exercises",
  P: "Problems",
};

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface Topic {
  id: string;
  topic_name: string;
  display_order: number;
  chapter_id: string;
}

interface ProblemRow {
  id: string;
  asset_name: string;
  source_ref: string;
  problem_type: string;
}

export default function CampusLandingPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2" } = useParams();
  const navigate = useNavigate();
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";
  const { trackEvent, trackPageView } = useEventTracking();

  const [campusName, setCampusName] = useState("");
  const [campusId, setCampusId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, Topic[]>>({});
  const [priceCents, setPriceCents] = useState(12500);
  const [loading, setLoading] = useState(true);

  // Tour state
  const [showCramGrid, setShowCramGrid] = useState(false);
  const [showProblemPicker, setShowProblemPicker] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [problemType, setProblemType] = useState("BE");
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(false);

  useEffect(() => {
    trackPageView('campus_landing', { campus_slug: campusSlug, course_slug: courseSlug });
  }, [campusSlug, courseSlug, trackPageView]);

  useEffect(() => {
    const load = async () => {
      if (campusSlug !== "general") {
        const { data: campus } = await supabase
          .from("campuses")
          .select("id, name")
          .eq("slug", campusSlug)
          .maybeSingle();
        if (campus) {
          setCampusName(campus.name);
          setCampusId(campus.id);
        }
      }

      const { data: priceData } = await supabase.rpc("get_campus_price", {
        p_campus_slug: campusSlug,
        p_product_type: "semester_pass",
      });
      if (priceData && priceData > 0) setPriceCents(priceData);

      const { data: chData } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseId)
        .order("chapter_number");
      if (chData) setChapters(chData);

      if (chData && chData.length > 0) {
        const chapterIds = chData.map((c) => c.id);
        const { data: topicData } = await supabase
          .from("chapter_topics")
          .select("id, topic_name, display_order, chapter_id")
          .in("chapter_id", chapterIds)
          .eq("is_active", true)
          .order("display_order");
        if (topicData) {
          const grouped: Record<string, Topic[]> = {};
          topicData.forEach((t) => {
            if (!grouped[t.chapter_id]) grouped[t.chapter_id] = [];
            grouped[t.chapter_id].push(t);
          });
          setTopicsByChapter(grouped);
        }
      }

      setLoading(false);
    };
    load();
  }, [campusSlug, courseSlug, courseId]);

  // Fetch problems when chapter + type changes
  useEffect(() => {
    if (!selectedChapterId) { setProblems([]); return; }
    setProblemsLoading(true);

    const prefix = problemType;
    supabase
      .from("teaching_assets")
      .select("id, asset_name, source_ref, problem_type")
      .eq("chapter_id", selectedChapterId)
      .eq("status", "approved")
      .ilike("source_ref", `${prefix}%`)
      .order("source_ref")
      .then(({ data }) => {
        setProblems(data ?? []);
        setProblemsLoading(false);
      });
  }, [selectedChapterId, problemType]);

  const selectedChapter = chapters.find(c => c.id === selectedChapterId);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F8FA" }}>
      <CampusHeader campusName={campusName} courseName={courseName} />

      <div className="flex-1 max-w-[780px] mx-auto w-full px-4 py-6 pb-28">
        {/* Value prop */}
        <p className="text-center text-lg mb-8" style={{ color: "#6B7280" }}>
          Everything you need to study for your exam.
        </p>

        {/* Tour section */}
        <h2 className="text-2xl font-bold text-center mb-6" style={{ color: "#14213D" }}>
          See what's included
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Cram Tools */}
          <div
            className={`bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow cursor-pointer ${showCramGrid ? "ring-2 ring-[#14213D]" : ""}`}
            style={{ border: "1px solid #E5E7EB" }}
            onClick={() => {
              trackEvent('chapter_preview', { campus_slug: campusSlug, course_slug: courseSlug });
              setShowCramGrid(!showCramGrid);
              if (!showCramGrid) setShowProblemPicker(false);
            }}
          >
            <BookOpen className="w-10 h-10 mb-3" style={{ color: "#14213D" }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: "#14213D" }}>
              Explore Cram Tools
            </h3>
            <p className="text-[14px] mb-4" style={{ color: "#6B7280" }}>
              Flashcards, formulas, journal entries & more
            </p>
            <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); setShowCramGrid(!showCramGrid); if (!showCramGrid) setShowProblemPicker(false); }}>
              {showCramGrid ? <span className="flex items-center gap-1">Hide Chapters <ChevronUp className="w-4 h-4" /></span> : <span className="flex items-center gap-1">Explore Cram Tools <ChevronDown className="w-4 h-4" /></span>}
            </Button>
          </div>

          {/* Card 2: Practice Problems */}
          <div
            className={`bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow cursor-pointer ${showProblemPicker ? "ring-2 ring-[#14213D]" : ""}`}
            style={{ border: "1px solid #E5E7EB" }}
            onClick={() => {
              trackEvent('practice_browse', { campus_slug: campusSlug, course_slug: courseSlug });
              setShowProblemPicker(!showProblemPicker);
              if (!showProblemPicker) setShowCramGrid(false);
            }}
          >
            <FileText className="w-10 h-10 mb-3" style={{ color: "#14213D" }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: "#14213D" }}>
              Browse Practice Problems
            </h3>
            <p className="text-[14px] mb-4" style={{ color: "#6B7280" }}>
              Hundreds of problems with step-by-step explanations
            </p>
            <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); setShowProblemPicker(!showProblemPicker); if (!showProblemPicker) setShowCramGrid(false); }}>
              {showProblemPicker ? <span className="flex items-center gap-1">Hide Problems <ChevronUp className="w-4 h-4" /></span> : <span className="flex items-center gap-1">Browse Problems <ChevronDown className="w-4 h-4" /></span>}
            </Button>
          </div>
        </div>

        {/* Cram Tools chapter grid */}
        {showCramGrid && (
          <ChapterGrid chapters={chapters} campusSlug={campusSlug} courseSlug={courseSlug} />
        )}

        {/* Problem Picker */}
        {showProblemPicker && (
          <div className="mt-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-xl font-bold mb-4" style={{ color: "#14213D" }}>
              Choose a chapter and problem type
            </h3>

            {/* Chapter selector */}
            <Select value={selectedChapterId || ""} onValueChange={(v) => { setSelectedChapterId(v); setProblemType("BE"); }}>
              <SelectTrigger className="w-full mb-4 bg-white">
                <SelectValue placeholder="Select a chapter" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>
                    Chapter {ch.chapter_number}: {ch.chapter_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Problem type tabs */}
            {selectedChapterId && (
              <>
                <Tabs value={problemType} onValueChange={setProblemType} className="mb-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="BE" className="flex-1">Brief Exercises</TabsTrigger>
                    <TabsTrigger value="EX" className="flex-1">Exercises</TabsTrigger>
                    <TabsTrigger value="P" className="flex-1">Problems</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Problem list */}
                {problemsLoading ? (
                  <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Loading…</p>
                ) : problems.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>No {TYPE_LABELS[problemType] || "problems"} found for this chapter.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {problems.map(p => (
                      <div
                        key={p.id}
                        className="bg-white rounded-lg px-4 py-3 cursor-pointer transition-all hover:shadow-md text-sm font-medium"
                        style={{ border: "1px solid #E5E7EB", color: "#14213D" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#14213D"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; }}
                        onClick={() => {
                          const chNum = selectedChapter?.chapter_number;
                          const code = p.source_ref?.toLowerCase().replace(/\s+/g, "-") || p.asset_name;
                          navigate(`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}/${code}`);
                        }}
                      >
                        {p.source_ref || p.asset_name}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <PreviewPurchaseBar
        priceCents={priceCents}
        campusSlug={campusSlug}
        courseSlug={courseSlug}
        email={sessionStorage.getItem("student_email") || undefined}
      />
    </div>
  );
}

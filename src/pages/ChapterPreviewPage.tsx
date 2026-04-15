import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import SiteNavbar from "@/components/landing/SiteNavbar";
import PreviewPurchaseBar from "@/components/PreviewPurchaseBar";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface CramSection {
  type: string;
  count: number;
}

interface Problem {
  id: string;
  asset_name: string;
  source_ref: string;
}

export default function ChapterPreviewPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2", chapterNumber } = useParams();
  const navigate = useNavigate();
  const { trackPageView } = useEventTracking();
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";
  const chNum = parseInt(chapterNumber?.replace("chapter-", "") || "0", 10);

  const [campusName, setCampusName] = useState("");
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [priceCents, setPriceCents] = useState(12500);
  const [loading, setLoading] = useState(true);

  // Cram tool counts
  const [cramSections, setCramSections] = useState<CramSection[]>([]);

  // Problems
  const [problems, setProblems] = useState<Problem[]>([]);
  const [problemType, setProblemType] = useState("BE");
  const [problemsLoading, setProblemsLoading] = useState(false);

  useEffect(() => {
    trackPageView("chapter_preview", { campus_slug: campusSlug, course_slug: courseSlug, chapter_number: chNum });
  }, [campusSlug, courseSlug, chNum, trackPageView]);

  useEffect(() => {
    const load = async () => {
      // Campus name
      if (campusSlug !== "general") {
        const { data: campus } = await supabase.from("campuses").select("name").eq("slug", campusSlug).maybeSingle();
        if (campus) setCampusName(campus.name);
      }

      // Price
      const { data: priceData } = await supabase.rpc("get_campus_price", { p_campus_slug: campusSlug, p_product_type: "semester_pass" });
      if (priceData && priceData > 0) setPriceCents(priceData);

      // Chapter
      const { data: chData } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseId)
        .eq("chapter_number", chNum)
        .maybeSingle();
      if (chData) {
        setChapter(chData);

        // Cram tool counts
        const [formulas, jes, keyTerms, accounts, mistakes] = await Promise.all([
          supabase.from("chapter_formulas").select("id", { count: "exact", head: true }).eq("chapter_id", chData.id).eq("is_approved", true),
          supabase.from("chapter_journal_entries").select("id", { count: "exact", head: true }).eq("chapter_id", chData.id).eq("is_approved", true),
          supabase.from("chapter_key_terms").select("id", { count: "exact", head: true }).eq("chapter_id", chData.id).eq("is_approved", true),
          supabase.from("chapter_accounts").select("id", { count: "exact", head: true }).eq("chapter_id", chData.id).eq("is_approved", true),
          (supabase as any).from("chapter_exam_mistakes").select("id", { count: "exact", head: true }).eq("chapter_id", chData.id).eq("is_approved", true),
        ]);

        const sections: CramSection[] = [];
        if (formulas.count) sections.push({ type: "Formulas", count: formulas.count });
        if (jes.count) sections.push({ type: "Journal Entries", count: jes.count });
        if (keyTerms.count) sections.push({ type: "Key Terms", count: keyTerms.count });
        if (accounts.count) sections.push({ type: "Accounts", count: accounts.count });
        if (mistakes.count) sections.push({ type: "Exam Mistakes", count: mistakes.count });
        setCramSections(sections);
      }

      setLoading(false);
    };
    load();
  }, [campusSlug, courseSlug, courseId, chNum]);

  // Load problems when type changes
  useEffect(() => {
    if (!chapter) return;
    setProblemsLoading(true);
    (supabase as any)
      .from("teaching_assets")
      .select("id, asset_name, source_ref")
      .eq("chapter_id", chapter.id)
      .eq("status", "approved")
      .ilike("source_ref", `${problemType}%`)
      .order("source_ref")
      .then(({ data }: any) => {
        setProblems(data ?? []);
        setProblemsLoading(false);
      });
  }, [chapter, problemType]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">Loading...</div>;
  }

  if (!chapter) {
    return <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">Chapter not found.</div>;
  }

  const displayCampus = campusName || "Your School";
  const seoTitle = `Chapter ${chNum}: ${chapter.chapter_name} | ${courseName} | ${displayCampus} | Survive Accounting`;
  const seoDesc = `Practice problems and exam prep for Chapter ${chNum} ${chapter.chapter_name} at ${displayCampus}. Step-by-step explanations.`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F8FA" }}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
      </Helmet>

      <SiteNavbar />

      {/* Breadcrumb */}
      <div className="max-w-[780px] mx-auto w-full px-4 pt-4">
        <nav className="flex items-center gap-1 text-xs text-[#9CA3AF] flex-wrap">
          <Link to={`/campus/${campusSlug}/${courseSlug}`} className="hover:text-[#14213D] transition-colors">
            {displayCampus}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/campus/${campusSlug}/${courseSlug}`} className="hover:text-[#14213D] transition-colors">
            {courseName}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#14213D] font-medium">Chapter {chNum}</span>
        </nav>
      </div>

      {/* Chapter header */}
      <div className="max-w-[780px] mx-auto w-full px-4 pt-4 pb-6">
        <h1 className="text-[28px] sm:text-[36px] font-bold leading-tight" style={{ color: "#14213D", fontFamily: "'DM Serif Display', serif" }}>
          Chapter {chNum}: {chapter.chapter_name}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          {displayCampus} · {courseName}
        </p>
      </div>

      <div className="flex-1 max-w-[780px] mx-auto w-full px-4 pb-28 space-y-8">
        {/* Cram Tools */}
        {cramSections.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4" style={{ color: "#14213D" }}>
              Cram Tools
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cramSections.map(s => (
                <div
                  key={s.type}
                  className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-all"
                  style={{ border: "1px solid #E5E7EB" }}
                  onClick={() => navigate(`/survive-this-chapter/${chapter.id}?preview=true`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#14213D"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; }}
                >
                  <p className="text-2xl font-bold" style={{ color: "#14213D" }}>{s.count}</p>
                  <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{s.type}</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
              Click any tool to preview · Full access with purchase
            </p>
          </section>
        )}

        {/* Practice Problems */}
        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: "#14213D" }}>
            Practice Problems
          </h2>

          <Tabs value={problemType} onValueChange={setProblemType} className="mb-4">
            <TabsList className="w-full">
              <TabsTrigger value="BE" className="flex-1">Brief Exercises</TabsTrigger>
              <TabsTrigger value="EX" className="flex-1">Exercises</TabsTrigger>
              <TabsTrigger value="P" className="flex-1">Problems</TabsTrigger>
            </TabsList>
          </Tabs>

          {problemsLoading ? (
            <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Loading…</p>
          ) : problems.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>No problems found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {problems.map(p => (
                <div
                  key={p.id}
                  className="bg-white rounded-lg px-4 py-3 cursor-pointer transition-all hover:shadow-md text-sm font-medium"
                  style={{ border: "1px solid #E5E7EB", color: "#14213D" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#14213D"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; }}
                  onClick={() => {
                    const code = p.source_ref?.toLowerCase().replace(/\s+/g, "-") || p.asset_name;
                    navigate(`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}/${code}`);
                  }}
                >
                  {p.source_ref || p.asset_name}
                </div>
              ))}
            </div>
          )}
        </section>
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

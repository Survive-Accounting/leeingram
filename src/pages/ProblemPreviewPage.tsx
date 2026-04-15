import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import SiteNavbar from "@/components/landing/SiteNavbar";
import PreviewPurchaseBar from "@/components/PreviewPurchaseBar";
import { ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEventTracking } from "@/hooks/useEventTracking";
import SmartTextRenderer from "@/components/SmartTextRenderer";

const COURSE_SLUG_MAP: Record<string, string> = {
  "intermediate-accounting-2": "44444444-4444-4444-4444-444444444444",
  "intermediate-accounting-1": "33333333-3333-3333-3333-333333333333",
  "intro-accounting-1": "11111111-1111-1111-1111-111111111111",
  "intro-accounting-2": "22222222-2222-2222-2222-222222222222",
};

const COURSE_SHORT: Record<string, string> = {
  "intermediate-accounting-2": "IA2",
  "intermediate-accounting-1": "IA1",
  "intro-accounting-1": "Intro 1",
  "intro-accounting-2": "Intro 2",
};

const COURSE_NAMES: Record<string, string> = {
  "intermediate-accounting-2": "Intermediate Accounting 2",
  "intermediate-accounting-1": "Intermediate Accounting 1",
  "intro-accounting-1": "Introductory Accounting 1",
  "intro-accounting-2": "Introductory Accounting 2",
};

interface Asset {
  id: string;
  asset_name: string;
  source_ref: string;
  problem_text: string | null;
  instructions: string | null;
  solution_text: string | null;
  chapter_id: string;
}

export default function ProblemPreviewPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2", chapterNumber, problemCode } = useParams();
  const navigate = useNavigate();
  const { trackPageView } = useEventTracking();
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";
  const courseShort = COURSE_SHORT[courseSlug] || "IA2";
  const chNum = parseInt(chapterNumber?.replace("chapter-", "") || "0", 10);

  const [campusName, setCampusName] = useState("");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [siblings, setSiblings] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });
  const [priceCents, setPriceCents] = useState(12500);
  const [loading, setLoading] = useState(true);
  const [chapterName, setChapterName] = useState("");

  useEffect(() => {
    trackPageView("problem_preview", { campus_slug: campusSlug, course_slug: courseSlug, chapter_number: chNum, problem_code: problemCode });
  }, [campusSlug, courseSlug, chNum, problemCode, trackPageView]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Campus
      if (campusSlug !== "general") {
        const { data: campus } = await supabase.from("campuses").select("name").eq("slug", campusSlug).maybeSingle();
        if (campus) setCampusName(campus.name);
      }

      // Price
      const { data: priceData } = await supabase.rpc("get_campus_price", { p_campus_slug: campusSlug, p_product_type: "semester_pass" });
      if (priceData && priceData > 0) setPriceCents(priceData);

      // Chapter
      const { data: ch } = await supabase
        .from("chapters")
        .select("id, chapter_name")
        .eq("course_id", courseId)
        .eq("chapter_number", chNum)
        .maybeSingle();

      if (!ch) { setLoading(false); return; }
      setChapterName(ch.chapter_name);

      // Normalize problem code: be15-1 → BE15.1, ex15-2 → EX15.2, p15-3 → P15.3
      const normalized = (problemCode || "")
        .toUpperCase()
        .replace(/-/g, ".");

      // Find asset by source_ref pattern match
      const { data: assets } = await (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_text, instructions, solution_text, chapter_id")
        .eq("chapter_id", ch.id)
        .eq("status", "approved")
        .order("source_ref");

      const allAssets: Asset[] = assets ?? [];
      const idx = allAssets.findIndex(a => {
        const ref = (a.source_ref || "").replace(/\s+/g, "");
        return ref === normalized || ref === normalized.replace(".", "-");
      });

      if (idx >= 0) {
        setAsset(allAssets[idx]);
        const prevRef = idx > 0 ? allAssets[idx - 1].source_ref?.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "-") : null;
        const nextRef = idx < allAssets.length - 1 ? allAssets[idx + 1].source_ref?.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "-") : null;
        setSiblings({ prev: prevRef, next: nextRef });
      }

      setLoading(false);
    };
    load();
  }, [campusSlug, courseSlug, courseId, chNum, problemCode]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">Loading...</div>;
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#F8F8FA" }}>
        <SiteNavbar />
        <p className="text-foreground/60 text-sm">Problem not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}`)}>
          Back to Chapter {chNum}
        </Button>
      </div>
    );
  }

  const displayCampus = campusName || "Your School";
  const refLabel = asset.source_ref || asset.asset_name;
  const seoTitle = `${refLabel} Solution | Chapter ${chNum} | ${courseName} | Survive Accounting`;
  const seoDesc = asset.problem_text
    ? `${asset.problem_text.slice(0, 150).replace(/\n/g, " ")}… Step-by-step explanation at Survive Accounting.`
    : `Practice problem ${refLabel} for Chapter ${chNum} ${chapterName}. Step-by-step explanations at Survive Accounting.`;

  // Truncate solution for preview
  const solutionPreview = asset.solution_text
    ? asset.solution_text.split("\n").slice(0, 6).join("\n")
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F8FA" }}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
      </Helmet>

      <SiteNavbar />

      <div className="flex-1 max-w-[780px] mx-auto w-full px-4 pb-28">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-[#9CA3AF] flex-wrap pt-4 pb-2">
          <Link to={`/campus/${campusSlug}/${courseSlug}`} className="hover:text-[#14213D] transition-colors">
            {displayCampus}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/campus/${campusSlug}/${courseSlug}`} className="hover:text-[#14213D] transition-colors">
            {courseShort}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}`} className="hover:text-[#14213D] transition-colors">
            Ch {chNum}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#14213D] font-medium">{refLabel}</span>
        </nav>

        {/* Problem header */}
        <h1 className="text-[24px] sm:text-[30px] font-bold leading-tight mb-1" style={{ color: "#14213D", fontFamily: "'DM Serif Display', serif" }}>
          {refLabel}
        </h1>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
          Chapter {chNum}: {chapterName}
        </p>

        {/* Problem text */}
        {asset.problem_text && (
          <section className="bg-white rounded-xl p-6 mb-4" style={{ border: "1px solid #E5E7EB" }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "#9CA3AF" }}>Problem</h2>
            <div className="text-sm leading-relaxed" style={{ color: "#14213D" }}>
              <SmartTextRenderer text={asset.problem_text} />
            </div>
          </section>
        )}

        {/* Instructions */}
        {asset.instructions && (
          <section className="bg-white rounded-xl p-6 mb-4" style={{ border: "1px solid #E5E7EB" }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "#9CA3AF" }}>Instructions</h2>
            <div className="text-sm leading-relaxed" style={{ color: "#14213D" }}>
              <SmartTextRenderer text={asset.instructions} />
            </div>
          </section>
        )}

        {/* Explanation preview (locked) */}
        <section className="bg-white rounded-xl p-6 mb-6 relative overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "#9CA3AF" }}>Explanation</h2>
          {solutionPreview ? (
            <>
              <div className="text-sm leading-relaxed" style={{ color: "#14213D" }}>
                <SmartTextRenderer text={solutionPreview} />
              </div>
              {/* Fade overlay */}
              <div
                className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center pb-5"
                style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 70%)" }}
              >
                <p className="text-sm font-medium" style={{ color: "#14213D" }}>
                  Get full access to see the complete explanation →
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              Get full access to see the complete explanation.
            </p>
          )}
        </section>

        {/* Prev / Next navigation */}
        <div className="flex items-center justify-between">
          {siblings.prev ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}/${siblings.prev}`)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
          ) : <div />}

          <Link
            to={`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}`}
            className="text-xs hover:underline"
            style={{ color: "#6B7280" }}
          >
            ← Back to Chapter {chNum}
          </Link>

          {siblings.next ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/campus/${campusSlug}/${courseSlug}/chapter-${chNum}/${siblings.next}`)}
            >
              Next <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Button>
          ) : <div />}
        </div>
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

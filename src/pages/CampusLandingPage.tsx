import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CampusHeader from "@/components/campus/CampusHeader";
import ChapterAccordion from "@/components/campus/ChapterAccordion";
import PurchaseBar from "@/components/campus/PurchaseBar";

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

interface Topic {
  id: string;
  topic_name: string;
  display_order: number;
  chapter_id: string;
}

export default function CampusLandingPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2" } = useParams();
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";

  const [campusName, setCampusName] = useState("Your School");
  const [campusId, setCampusId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, Topic[]>>({});
  const [priceCents, setPriceCents] = useState(12500);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fetch campus
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

      // Fetch price
      const { data: priceData } = await supabase.rpc("get_campus_price", {
        p_campus_slug: campusSlug,
        p_product_type: "semester_pass",
      });
      if (priceData && priceData > 0) setPriceCents(priceData);

      // Fetch chapters
      const { data: chData } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseId)
        .order("chapter_number");
      if (chData) setChapters(chData);

      // Fetch topics
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

      <div className="flex-1 max-w-[780px] mx-auto w-full px-4 py-6 pb-24">
        {/* Price callout */}
        <div className="text-center mb-6">
          <p className="text-[14px] font-medium" style={{ color: "#6B7280" }}>
            Full semester access
          </p>
          <p className="text-[28px] font-bold mt-1" style={{ color: "#14213D", fontFamily: "'DM Serif Display', serif" }}>
            ${Math.round(priceCents / 100)}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>
            {chapters.length} chapters · All practice problems · Explanations included
          </p>
        </div>

        {/* Chapter list */}
        <h2 className="text-[15px] font-semibold mb-3" style={{ color: "#14213D" }}>
          What's Included
        </h2>
        <ChapterAccordion chapters={chapters} topicsByChapter={topicsByChapter} />
      </div>

      <PurchaseBar
        priceCents={priceCents}
        campusId={campusId}
        campusSlug={campusSlug}
        courseId={courseId}
        courseSlug={courseSlug}
      />
    </div>
  );
}

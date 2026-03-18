import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown } from "lucide-react";
import BlurredPreview from "@/components/BlurredPreview";

const enrollUrl = import.meta.env.VITE_LEARNWORLDS_ENROLL_URL || "https://surviveaccounting.com";

export default function ACCY304Landing() {
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedType, setSelectedType] = useState("any");
  const [selectedAssetId, setSelectedAssetId] = useState("");

  // Fetch IA2 course + chapters
  const { data: courseData } = useQuery({
    queryKey: ["accy304-course"],
    queryFn: async () => {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, course_name, code")
        .eq("code", "IA2")
        .limit(1);
      const course = courses?.[0];
      if (!course) return null;

      const { data: chapters } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", course.id)
        .gte("chapter_number", 13)
        .lte("chapter_number", 22)
        .order("chapter_number");

      return { course, chapters: chapters || [] };
    },
  });

  // Fetch assets for selected chapter
  const { data: chapterAssets } = useQuery({
    queryKey: ["accy304-assets", selectedChapterId, selectedType],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      let q = supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_context, phase2_status, asset_approved_at")
        .eq("chapter_id", selectedChapterId)
        .order("source_ref");

      const { data } = await q;
      if (!data) return [];

      // Filter to approved / core assets
      let filtered = data.filter(
        (a: any) => a.phase2_status === "core_asset" || a.asset_approved_at != null
      );

      // Filter by type
      if (selectedType === "BE") filtered = filtered.filter((a: any) => a.source_ref?.startsWith("BE"));
      else if (selectedType === "E") filtered = filtered.filter((a: any) => a.source_ref?.startsWith("E") && !a.source_ref?.startsWith("EX"));
      else if (selectedType === "P") filtered = filtered.filter((a: any) => a.source_ref?.startsWith("P"));

      return filtered;
    },
    enabled: !!selectedChapterId,
  });

  // Fetch selected asset full data
  const { data: previewAsset } = useQuery({
    queryKey: ["accy304-preview", selectedAssetId],
    queryFn: async () => {
      if (!selectedAssetId) return null;
      const { data } = await supabase
        .from("teaching_assets")
        .select("*")
        .eq("id", selectedAssetId)
        .single();
      return data;
    },
    enabled: !!selectedAssetId,
  });

  const handleShowProblem = () => {
    if (chapterAssets?.length && !selectedAssetId) {
      setSelectedAssetId(chapterAssets[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ── */}
      <section style={{ background: "#131E35" }} className="px-6 py-12 md:py-16">
        <div className="max-w-[860px] mx-auto text-center">
          <p className="text-white font-bold text-[28px]">Survive Accounting</p>
          <p className="text-white text-[18px] font-normal leading-[1.5] mt-2">
            Practice any IA2 problem.<br />Instantly. Free preview.
          </p>
          <p className="text-white/70 text-[14px] mt-3 max-w-[560px] mx-auto leading-relaxed">
            Built for ACCY 304 students at your university.
            Work through real textbook problems with full worked solutions,
            journal entries, formulas, and exam traps.
          </p>
          <a
            href={enrollUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 px-8 py-3.5 rounded-md font-bold text-[16px] transition-all hover:scale-105"
            style={{ background: "#00FFFF", color: "#0A0A0A" }}
          >
            Get Full Access — $99/semester
          </a>
          <p className="mt-3">
            <a href="#picker" className="text-white/50 text-[13px] hover:underline">
              Or try a free preview below ↓
            </a>
          </p>
        </div>
      </section>

      {/* ── PROBLEM PICKER ── */}
      <section id="picker" className="px-6 py-10 md:py-14">
        <div className="max-w-[860px] mx-auto">
          <h2 className="text-center font-bold text-[22px]" style={{ color: "#131E35" }}>
            Try any problem — free preview
          </h2>
          <p className="text-center text-gray-500 text-[14px] mt-2 mb-8 max-w-[480px] mx-auto">
            Choose a chapter and problem type below. See exactly what you get with a Study Pass.
          </p>

          {/* Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Chapter */}
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">Chapter</label>
              <div className="relative">
                <select
                  value={selectedChapterId}
                  onChange={(e) => { setSelectedChapterId(e.target.value); setSelectedAssetId(""); }}
                  className="w-full appearance-none border border-gray-300 rounded-md px-3 py-2.5 text-[14px] bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-[#131E35]/20 focus:border-[#131E35]"
                >
                  <option value="">Select chapter…</option>
                  {courseData?.chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      Ch {ch.chapter_number} — {ch.chapter_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">Problem Type</label>
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => { setSelectedType(e.target.value); setSelectedAssetId(""); }}
                  className="w-full appearance-none border border-gray-300 rounded-md px-3 py-2.5 text-[14px] bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-[#131E35]/20 focus:border-[#131E35]"
                >
                  <option value="any">Any Type</option>
                  <option value="BE">Brief Exercise (BE)</option>
                  <option value="E">Exercise (E)</option>
                  <option value="P">Problem (P)</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Source # */}
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">Source #</label>
              <div className="relative">
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  disabled={!chapterAssets?.length}
                  className="w-full appearance-none border border-gray-300 rounded-md px-3 py-2.5 text-[14px] bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-[#131E35]/20 focus:border-[#131E35] disabled:opacity-50 disabled:bg-gray-50"
                >
                  <option value="">
                    {!selectedChapterId ? "Select chapter first…" : chapterAssets?.length ? "Select problem…" : "No problems found"}
                  </option>
                  {chapterAssets?.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.source_ref}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Show button */}
          <button
            onClick={handleShowProblem}
            disabled={!selectedAssetId && !chapterAssets?.length}
            className="w-full md:w-auto px-8 py-3 rounded-md font-bold text-[14px] text-white transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#131E35" }}
          >
            Show Me This Problem →
          </button>

          {/* Preview area */}
          <div className="mt-8">
            {previewAsset ? (
              <BlurredAssetPreview asset={previewAsset} />
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center" style={{ background: "#F8F9FA" }}>
                <p className="text-gray-400 text-[14px]">
                  👆 Select a chapter and problem above to see a free preview
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── WHAT YOU GET ── */}
      <section className="px-6 py-10 md:py-14 border-t border-gray-100">
        <div className="max-w-[860px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: "📝",
                title: "Full Worked Solutions",
                desc: "Step-by-step solutions for every Core problem in Chapters 13–22.",
              },
              {
                icon: "📊",
                title: "Practice Mode",
                desc: "Work problems yourself then reveal answers section by section.",
              },
              {
                icon: "🎯",
                title: "Exam Prep Tools",
                desc: "Flashcards, formula drills, journal entry builder, and problem dissector.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-lg p-6 text-center"
              >
                <p className="text-[32px] mb-3">{card.icon}</p>
                <p className="font-bold text-[15px] mb-2" style={{ color: "#131E35" }}>{card.title}</p>
                <p className="text-gray-500 text-[13px] leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: "#131E35" }} className="px-6 py-12 md:py-16">
        <div className="max-w-[860px] mx-auto text-center">
          <p className="text-white font-bold text-[24px]">Ready to stop guessing on exams?</p>
          <p className="text-white/70 text-[14px] mt-2">
            Join ACCY 304 students getting full access to every IA2 problem.
          </p>
          <a
            href={enrollUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 px-8 py-3.5 rounded-md font-bold text-[16px] transition-all hover:scale-105"
            style={{ background: "#00FFFF", color: "#0A0A0A" }}
          >
            Get Study Pass — $99/semester
          </a>
          <p className="text-white/50 text-[12px] mt-3">
            7-day refund policy · Access all semester · Covers Ch 13–22
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-6">
        <p className="text-center text-gray-400 text-[12px]">
          Survive Accounting · Lee Ingram · surviveaccounting.com
        </p>
      </footer>
    </div>
  );
}

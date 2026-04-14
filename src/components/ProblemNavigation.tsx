import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { naturalSortRef } from "@/lib/utils";

// TODO: filter courses and chapters to purchased only
// when auth is wired up

const NAVY = "#14213D";
const RED = "#CE1126";
const BORDER = "#E0E0E0";

interface ProblemNavigationProps {
  currentAsset: {
    asset_name: string;
    source_ref: string;
    chapter_id: string;
    course_id: string;
    courses?: { code?: string; course_name?: string };
  };
}

function getBELabel(courseCode: string) {
  if (courseCode === "INTRO1" || courseCode === "INTRO2" || courseCode === "FA1" || courseCode === "MA2") return "Quick Studies";
  return "Brief Exercises";
}

function detectType(sourceRef: string): "BE" | "E" | "P" {
  const ref = (sourceRef || "").toUpperCase();
  if (ref.startsWith("P")) return "P";
  if (ref.startsWith("E") && !ref.startsWith("EX")) return "E";
  return "BE";
}

export function ProblemNavigation({ currentAsset }: ProblemNavigationProps) {
  const navigate = useNavigate();
  const currentCourseCode = currentAsset.courses?.code || "";
  const currentChapterId = currentAsset.chapter_id;
  const currentType = detectType(currentAsset.source_ref);

  const [selectedCourseCode, setSelectedCourseCode] = useState(currentCourseCode);
  const [selectedChapterId, setSelectedChapterId] = useState(currentChapterId);
  const [selectedType, setSelectedType] = useState<"BE" | "E" | "P">(currentType);
  const [showPills, setShowPills] = useState(false);

  // Sync when navigating to different asset
  useEffect(() => {
    setSelectedCourseCode(currentCourseCode);
    setSelectedChapterId(currentChapterId);
    setSelectedType(detectType(currentAsset.source_ref));
  }, [currentCourseCode, currentChapterId, currentAsset.source_ref]);

  // Fetch all courses
  const { data: courses } = useQuery({
    queryKey: ["prob-nav-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, course_name, code")
        .order("course_name");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Find selected course ID from code
  const selectedCourseId = useMemo(() => {
    return courses?.find((c: any) => c.code === selectedCourseCode)?.id || "";
  }, [courses, selectedCourseCode]);

  // Fetch chapters for selected course
  const { data: chapters } = useQuery({
    queryKey: ["prob-nav-chapters", selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", selectedCourseId)
        .order("chapter_number");
      return data || [];
    },
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch assets for selected chapter
  const { data: chapterAssets } = useQuery({
    queryKey: ["prob-nav-assets", selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      const { data } = await supabase
        .from("teaching_assets")
        .select("asset_name, source_ref")
        .eq("chapter_id", selectedChapterId)
        .not("asset_approved_at", "is", null)
        .order("source_ref");
      return (data || []).sort((a: any, b: any) => naturalSortRef(a.source_ref, b.source_ref));
    },
    enabled: !!selectedChapterId,
    staleTime: 60 * 1000,
  });

  // Categorize and count assets
  const { beAssets, exAssets, pAssets, beCt, exCt, pCt } = useMemo(() => {
    const be: any[] = [], ex: any[] = [], p: any[] = [];
    (chapterAssets || []).forEach((a: any) => {
      const t = detectType(a.source_ref);
      if (t === "P") p.push(a);
      else if (t === "E") ex.push(a);
      else be.push(a);
    });
    return { beAssets: be, exAssets: ex, pAssets: p, beCt: be.length, exCt: ex.length, pCt: p.length };
  }, [chapterAssets]);

  const activeList = selectedType === "P" ? pAssets : selectedType === "E" ? exAssets : beAssets;
  const beLabel = getBELabel(selectedCourseCode);

  const handleCourseChange = (code: string) => {
    setSelectedCourseCode(code);
    setSelectedChapterId("");
  };

  const handleChapterChange = (chId: string) => {
    setSelectedChapterId(chId);
  };

  const handlePillClick = (assetName: string) => {
    navigate(`/solutions/${assetName}`);
  };

  const selectStyle: React.CSSProperties = {
    appearance: "none",
    background: "#fff",
    border: `1px solid ${BORDER}`,
    color: "#1A1A1A",
    borderRadius: 8,
    padding: "6px 28px 6px 10px",
    fontSize: 12,
    height: 34,
    minWidth: 120,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? NAVY : "transparent",
    color: active ? "#fff" : NAVY,
    border: active ? `2px solid rgba(255,255,255,0.25)` : `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 150ms ease, border 150ms ease",
    position: "relative",
  });

  return (
    <div className="w-full space-y-3">
      {/* ROW 1 — Course + Chapter selectors */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold" style={{ color: "#666", whiteSpace: "nowrap" }}>Course</label>
          <select
            value={selectedCourseCode}
            onChange={(e) => handleCourseChange(e.target.value)}
            style={selectStyle}
            className="w-full sm:w-auto"
          >
            <option value="">Select…</option>
            {(courses || []).map((c: any) => (
              <option key={c.id} value={c.code}>{c.course_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold" style={{ color: "#666", whiteSpace: "nowrap" }}>Chapter</label>
          <select
            value={selectedChapterId}
            onChange={(e) => handleChapterChange(e.target.value)}
            disabled={!selectedCourseId}
            style={{ ...selectStyle, opacity: selectedCourseId ? 1 : 0.55 }}
            className="w-full sm:w-auto"
          >
            <option value="">Select…</option>
            {(chapters || []).map((ch: any) => (
              <option key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ROW 2 — Problem type tabs */}
      {selectedChapterId && (
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: "BE" as const, label: beLabel, count: beCt },
            { key: "E" as const, label: "Exercises", count: exCt },
            { key: "P" as const, label: "Problems", count: pCt },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSelectedType(key)}
              style={tabBtnStyle(selectedType === key)}
            >
              {label}
              <span
                className="ml-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: selectedType === key ? RED : "rgba(20,33,61,0.1)",
                  color: selectedType === key ? "#fff" : NAVY,
                  width: 20,
                  height: 20,
                  lineHeight: "20px",
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* PROBLEM LIST — horizontal scroll pills */}
      {selectedChapterId && activeList.length > 0 && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {activeList.map((a: any) => {
            const isCurrent = a.asset_name === currentAsset.asset_name;
            return (
              <button
                key={a.asset_name}
                onClick={() => handlePillClick(a.asset_name)}
                className="shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all hover:opacity-80"
                style={{
                  background: isCurrent ? NAVY : "#f1f5f9",
                  color: isCurrent ? "#fff" : "#334155",
                  border: isCurrent ? "none" : `1px solid ${BORDER}`,
                  cursor: isCurrent ? "default" : "pointer",
                }}
              >
                {a.source_ref}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

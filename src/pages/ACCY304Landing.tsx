import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { toast } from "sonner";

const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";
const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const AORAKI_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png";

type Step = "email" | "picker" | "results";

interface ProblemSelection {
  chapterId: string;
  type: string;
  sourceCode: string;
  sourceLabel: string;
}

// ── Shared Select Wrapper ───────────────────────────────────────────
function StyledSelect({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full appearance-none border border-gray-300 rounded-md px-3 py-2.5 text-[14px] bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-[#14213D]/20 focus:border-[#14213D] disabled:opacity-50 disabled:bg-gray-50"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ── Problem Picker Row (for email capture section) ──────────────────
function ProblemPickerRow({
  index,
  selection,
  onChange,
  chapters,
  usedSourceCodes,
}: {
  index: number;
  selection: ProblemSelection;
  onChange: (s: ProblemSelection) => void;
  chapters: { id: string; chapter_number: number; chapter_name: string }[];
  usedSourceCodes: string[];
}) {
  const { data: problems } = useQuery({
    queryKey: ["accy304-picker-problems", selection.chapterId, selection.type],
    queryFn: async () => {
      if (!selection.chapterId) return [];
      let q = supabase
        .from("chapter_problems")
        .select("id, source_code, source_label, chapter_id")
        .eq("chapter_id", selection.chapterId)
        .order("source_code");

      const { data } = await q;
      if (!data) return [];

      let filtered = data;
      if (selection.type === "BE") filtered = filtered.filter((p: any) => p.source_code?.startsWith("BE"));
      else if (selection.type === "E") filtered = filtered.filter((p: any) => p.source_code?.startsWith("E") && !p.source_code?.startsWith("EX"));
      else if (selection.type === "P") filtered = filtered.filter((p: any) => p.source_code?.startsWith("P"));

      return filtered;
    },
    enabled: !!selection.chapterId,
  });

  const isDuplicate = selection.sourceCode && usedSourceCodes.filter(c => c === selection.sourceCode).length > 1;

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold" style={{ color: "#14213D" }}>Problem {index + 1}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StyledSelect
          value={selection.chapterId}
          onChange={(e) => onChange({ ...selection, chapterId: e.target.value, sourceCode: "", sourceLabel: "" })}
        >
          <option value="">Select chapter…</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</option>
          ))}
        </StyledSelect>

        <StyledSelect
          value={selection.type}
          onChange={(e) => onChange({ ...selection, type: e.target.value, sourceCode: "", sourceLabel: "" })}
        >
          <option value="any">Any Type</option>
          <option value="BE">Brief Exercise (BE)</option>
          <option value="E">Exercise (E)</option>
          <option value="P">Problem (P)</option>
        </StyledSelect>

        <StyledSelect
          value={selection.sourceCode}
          onChange={(e) => {
            const prob = problems?.find((p: any) => p.source_code === e.target.value);
            onChange({ ...selection, sourceCode: e.target.value, sourceLabel: prob?.source_label || e.target.value });
          }}
          disabled={!problems?.length}
        >
          <option value="">
            {!selection.chapterId ? "Select chapter first…" : problems?.length ? "Select problem…" : "No problems found"}
          </option>
          {problems?.map((p: any) => (
            <option key={p.source_code} value={p.source_code}>{p.source_label}</option>
          ))}
        </StyledSelect>
      </div>
      {isDuplicate && (
        <p className="text-red-500 text-[12px]">You've already selected this problem — please choose a different one.</p>
      )}
    </div>
  );
}

// ── Main Landing Page ───────────────────────────────────────────────
export default function ACCY304Landing() {
  const enrollUrl = useEnrollUrl();

  // ── Free Preview state (Section 2) ──
  const [previewChapterId, setPreviewChapterId] = useState("");
  const [previewType, setPreviewType] = useState("any");
  const [previewSourceCode, setPreviewSourceCode] = useState("");
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  // ── Email Capture state (Section 3) ──
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  const emptySelection = (): ProblemSelection => ({ chapterId: "", type: "any", sourceCode: "", sourceLabel: "" });
  const [selections, setSelections] = useState<ProblemSelection[]>([emptySelection(), emptySelection(), emptySelection()]);

  const [sessionResult, setSessionResult] = useState<{
    sessionId: string;
    assetLinks: { sourceLabel: string; assetName: string; assetCode: string }[];
  } | null>(null);

  // ── Shared: Fetch IA2 course + chapters ──
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

  // ── Section 2: Free preview problem list ──
  const { data: previewProblems } = useQuery({
    queryKey: ["accy304-preview-problems", previewChapterId, previewType],
    queryFn: async () => {
      if (!previewChapterId) return [];
      const { data } = await supabase
        .from("chapter_problems")
        .select("id, source_code, source_label, chapter_id")
        .eq("chapter_id", previewChapterId)
        .order("source_code");
      if (!data) return [];

      let filtered = data;
      if (previewType === "BE") filtered = filtered.filter((p: any) => p.source_code?.startsWith("BE"));
      else if (previewType === "E") filtered = filtered.filter((p: any) => p.source_code?.startsWith("E") && !p.source_code?.startsWith("EX"));
      else if (previewType === "P") filtered = filtered.filter((p: any) => p.source_code?.startsWith("P"));
      return filtered;
    },
    enabled: !!previewChapterId,
  });

  const handleShowPreview = async () => {
    if (!previewSourceCode) return;
    // Resolve source_code → teaching_asset asset_name
    const { data: assets } = await supabase
      .from("teaching_assets")
      .select("id, asset_name")
      .eq("chapter_id", previewChapterId)
      .eq("source_ref", previewSourceCode)
      .not("asset_approved_at", "is", null)
      .limit(1);

    const asset = assets?.[0];
    if (!asset) {
      toast.error("No approved asset found for this problem yet. Try a different one.");
      return;
    }
    setIframeSrc(`${STUDENT_BASE_URL}/solutions/${asset.asset_name}?preview=true`);
  };

  // ── Section 3: Email submit ──
  const handleEmailSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(".edu")) {
      setEmailError("Please use your university .edu email address");
      return;
    }
    setEmailError("");
    setSubmitting(true);

    try {
      const { data: existing } = await supabase
        .from("edu_preview_sessions")
        .select("id")
        .eq("email", trimmed)
        .maybeSingle();

      if (existing) {
        setAlreadyUsed(true);
        setSubmitting(false);
        return;
      }

      setStep("picker");
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Section 3: Problem submit ──
  const usedSourceCodes = selections.map(s => s.sourceCode).filter(Boolean);
  const hasDuplicates = new Set(usedSourceCodes).size < usedSourceCodes.length;
  const allSelected = selections.every(s => s.sourceCode);
  const canSubmitProblems = allSelected && !hasDuplicates;

  const handleProblemsSubmit = async () => {
    if (!canSubmitProblems) return;
    setSubmitting(true);

    try {
      const assetLinks: { sourceLabel: string; assetName: string; assetCode: string; assetId: string }[] = [];

      for (const sel of selections) {
        const { data: assets } = await supabase
          .from("teaching_assets")
          .select("id, asset_name, source_ref, problem_title")
          .eq("chapter_id", sel.chapterId)
          .eq("source_ref", sel.sourceCode)
          .not("asset_approved_at", "is", null)
          .limit(1);

        const asset = assets?.[0];
        if (!asset) {
          toast.error(`Could not find an approved asset for ${sel.sourceLabel}. Please choose a different problem.`);
          setSubmitting(false);
          return;
        }

        assetLinks.push({
          sourceLabel: sel.sourceLabel,
          assetName: asset.asset_name,
          assetCode: asset.asset_name,
          assetId: asset.id,
        });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: session, error: insertErr } = await supabase
        .from("edu_preview_sessions")
        .insert({
          email: trimmedEmail,
          asset_ids: assetLinks.map(a => a.assetId),
          asset_codes: assetLinks.map(a => a.assetCode),
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          setAlreadyUsed(true);
          setStep("email");
        } else {
          toast.error("Failed to create preview session. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      setSessionResult({
        sessionId: session.id,
        assetLinks: assetLinks.map(a => ({
          sourceLabel: a.sourceLabel,
          assetName: a.assetName,
          assetCode: a.assetCode,
        })),
      });
      setStep("results");
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateSelection = (index: number, sel: ProblemSelection) => {
    setSelections(prev => prev.map((s, i) => i === index ? sel : s));
  };

  return (
    <div className="min-h-screen relative" style={{ background: "#FAFBFC" }}>
      {/* ── Aoraki Watermark Background ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${AORAKI_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.06,
          zIndex: 0,
        }}
      />

      {/* ── Navy Header Bar (matches SolutionsViewer) ── */}
      <header className="relative sticky top-0" style={{ background: "#14213D", zIndex: 20 }}>
        <div className="mx-auto px-6 py-2.5 flex items-center" style={{ maxWidth: 1200 }}>
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Survive Accounting" className="h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-[12px] text-white/50">Created by Lee Ingram</span>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — HERO
         ═══════════════════════════════════════════════════════════ */}
      <section className="relative px-6 py-14 md:py-20" style={{ background: "#14213D", zIndex: 1 }}>
        <div className="max-w-[860px] mx-auto text-center">
          <h1 className="text-white font-bold text-[32px] md:text-[38px] leading-tight">Survive Accounting</h1>
          <p className="text-white/80 text-[17px] font-medium mt-2">
            Built for Ole Miss ACCY 304 students.
          </p>
          <p className="text-white/60 text-[14px] mt-4 max-w-[560px] mx-auto leading-relaxed">
            Full worked solutions, journal entries, formulas, exam traps, and more — for every problem in Intermediate Accounting 2.
          </p>

          {/* CTA */}
          <div className="mt-8">
            <p className="text-white/40 text-[14px] line-through mb-1">$250</p>
            <a
              href={enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-4 rounded-md font-bold text-[17px] transition-all hover:scale-105"
              style={{ background: "#00FFFF", color: "#0A0A0A" }}
            >
              Get Full Access — $125/semester
            </a>
            <p className="text-[13px] mt-2" style={{ color: "#00FFFF", opacity: 0.8 }}>
              50% off — Spring 2026 only
            </p>
          </div>

          <p className="mt-6">
            <a href="#free-preview" className="text-white/50 text-[13px] hover:underline">
              Or explore free below ↓
            </a>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — FREE PREVIEW (light bg)
         ═══════════════════════════════════════════════════════════ */}
      <section id="free-preview" className="relative px-6 py-12 md:py-16" style={{ background: "rgba(255,255,255,0.92)", zIndex: 1 }}>
        <div className="max-w-[860px] mx-auto">
          <h2 className="text-center font-bold text-[24px]" style={{ color: "#14213D" }}>
            Try any problem — free preview
          </h2>
          <p className="text-center text-gray-500 text-[14px] mt-2 mb-8 max-w-[560px] mx-auto leading-relaxed">
            See exactly what you get. Pick any problem below and view the full page — solutions are paywalled until you unlock with a Study Pass.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <StyledSelect
              value={previewChapterId}
              onChange={(e) => { setPreviewChapterId(e.target.value); setPreviewSourceCode(""); setIframeSrc(null); }}
            >
              <option value="">Select chapter…</option>
              {(courseData?.chapters || []).map((ch) => (
                <option key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</option>
              ))}
            </StyledSelect>

            <StyledSelect
              value={previewType}
              onChange={(e) => { setPreviewType(e.target.value); setPreviewSourceCode(""); }}
            >
              <option value="any">Any Type</option>
              <option value="BE">Brief Exercise (BE)</option>
              <option value="E">Exercise (E)</option>
              <option value="P">Problem (P)</option>
            </StyledSelect>

            <StyledSelect
              value={previewSourceCode}
              onChange={(e) => setPreviewSourceCode(e.target.value)}
              disabled={!previewProblems?.length}
            >
              <option value="">
                {!previewChapterId ? "Select chapter first…" : previewProblems?.length ? "Select problem…" : "No problems found"}
              </option>
              {previewProblems?.map((p: any) => (
                <option key={p.source_code} value={p.source_code}>{p.source_label}</option>
              ))}
            </StyledSelect>
          </div>

          <button
            onClick={handleShowPreview}
            disabled={!previewSourceCode}
            className="px-8 py-3 rounded-md font-bold text-[14px] text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            style={{ background: "#14213D" }}
          >
            Show Me This Problem →
          </button>

          {iframeSrc && (
            <div className="mt-6">
              <iframe
                src={iframeSrc}
                title="Problem Preview"
                className="w-full border-0 rounded-lg"
                style={{ height: 900 }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Section divider ── */}
      <div className="relative" style={{ height: 1, background: "linear-gradient(90deg, transparent, #14213D20, transparent)", zIndex: 1 }} />

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — EMAIL CAPTURE (slightly darker bg)
         ═══════════════════════════════════════════════════════════ */}
      <section className="relative px-6 py-12 md:py-16" style={{ background: "rgba(240,242,246,0.95)", zIndex: 1 }}>
        <div className="max-w-[860px] mx-auto">

          {/* ── STEP 1: Email ── */}
          {step === "email" && !alreadyUsed && (
            <>
              <h2 className="text-center font-bold text-[24px]" style={{ color: "#14213D" }}>
                Get 3 full solutions — free for 24 hours
              </h2>
              <p className="text-center text-gray-500 text-[14px] mt-2 mb-8 max-w-[520px] mx-auto leading-relaxed">
                Enter your Ole Miss .edu email to unlock 3 fully worked solutions normally only available to Study Pass holders. No payment required.
              </p>

              <div className="max-w-[420px] mx-auto">
                <label className="block text-[12px] font-medium text-gray-500 mb-1">University Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="yourname@olemiss.edu"
                  className="w-full border border-gray-300 rounded-md px-4 py-3 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#14213D]/20 focus:border-[#14213D]"
                />
                {emailError && (
                  <p className="text-red-500 text-[13px] mt-2">{emailError}</p>
                )}
                <button
                  onClick={handleEmailSubmit}
                  disabled={submitting || !email.trim()}
                  className="w-full mt-4 px-8 py-3 rounded-md font-bold text-[14px] text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "#14213D" }}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Already used ── */}
          {alreadyUsed && (
            <div className="text-center py-8">
              <p className="font-bold text-[20px]" style={{ color: "#14213D" }}>
                You've already used your free preview
              </p>
              <p className="text-gray-500 text-[14px] mt-2 max-w-[480px] mx-auto">
                Each .edu email gets one free preview session. Get full access to every problem with a Study Pass.
              </p>
              <a
                href={enrollUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-6 px-8 py-3.5 rounded-md font-bold text-[16px] transition-all hover:scale-105"
                style={{ background: "#00FFFF", color: "#0A0A0A" }}
              >
                Get Full Access — $125/semester →
              </a>
            </div>
          )}

          {/* ── STEP 2: Problem Picker ── */}
          {step === "picker" && (
            <>
              <h2 className="text-center font-bold text-[24px]" style={{ color: "#14213D" }}>
                Choose 3 problems to unlock
              </h2>
              <p className="text-center text-gray-500 text-[14px] mt-2 mb-8 max-w-[520px] mx-auto">
                Pick any 3 problems from Chapters 13–22. You'll get full access to their worked solutions for 24 hours.
              </p>

              <div className="space-y-6 mb-6">
                {selections.map((sel, i) => (
                  <ProblemPickerRow
                    key={i}
                    index={i}
                    selection={sel}
                    onChange={(s) => updateSelection(i, s)}
                    chapters={courseData?.chapters || []}
                    usedSourceCodes={usedSourceCodes}
                  />
                ))}
              </div>

              <button
                onClick={handleProblemsSubmit}
                disabled={!canSubmitProblems || submitting}
                className="w-full md:w-auto px-8 py-3 rounded-md font-bold text-[14px] text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#14213D" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Get My Free Preview →
              </button>
            </>
          )}

          {/* ── STEP 3: Results ── */}
          {step === "results" && sessionResult && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full mb-4" style={{ background: "#E8F5E9" }}>
                <CheckCircle className="h-6 w-6" style={{ color: "#2E7D32" }} />
              </div>
              <h2 className="font-bold text-[22px]" style={{ color: "#14213D" }}>
                Here are your 3 free problems
              </h2>
              <p className="text-gray-500 text-[14px] mt-2 mb-8">
                Links expire in 24 hours. Bookmark them or come back before they expire.
              </p>

              <div className="space-y-3 max-w-[560px] mx-auto text-left">
                {sessionResult.assetLinks.map((link, i) => {
                  const url = `${STUDENT_BASE_URL}/solutions/${link.assetCode}?preview_token=${sessionResult.sessionId}`;
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-4 rounded-lg border border-gray-200 hover:border-[#14213D]/30 transition-all hover:shadow-sm bg-white"
                    >
                      <span className="flex items-center justify-center h-8 w-8 rounded-full text-[13px] font-bold text-white shrink-0" style={{ background: "#14213D" }}>
                        {i + 1}
                      </span>
                      <span className="flex-1">
                        <span className="font-bold text-[14px]" style={{ color: "#14213D" }}>{link.sourceLabel}</span>
                      </span>
                      <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
                    </a>
                  );
                })}
              </div>

              <p className="text-gray-400 text-[12px] mt-6">
                Want full access to every problem? →{" "}
                <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "#14213D" }}>
                  Get a Study Pass
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative px-6 py-12 md:py-16" style={{ background: "#14213D", zIndex: 1 }}>
        <div className="max-w-[860px] mx-auto text-center">
          <p className="text-white font-bold text-[24px]">Ready to stop guessing on exams?</p>
          <p className="text-white/70 text-[14px] mt-2">
            Join ACCY 304 students getting full access to every Intermediate Accounting 2 problem.
          </p>
          <div className="mt-6">
            <p className="text-white/40 text-[14px] line-through mb-1">$250</p>
            <a
              href={enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-4 rounded-md font-bold text-[17px] transition-all hover:scale-105"
              style={{ background: "#00FFFF", color: "#0A0A0A" }}
            >
              Get Study Pass — $125/semester
            </a>
            <p className="text-[13px] mt-2" style={{ color: "#00FFFF", opacity: 0.8 }}>
              50% off — Spring 2026 only
            </p>
          </div>
          <p className="text-white/50 text-[12px] mt-4">
            7-day refund policy · Access all semester · Covers Ch 13–22
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative px-6 py-6" style={{ background: "#FAFBFC", zIndex: 1 }}>
        <p className="text-center text-gray-400 text-[12px]">
          Survive Accounting · Lee Ingram · surviveaccounting.com
        </p>
      </footer>
    </div>
  );
}

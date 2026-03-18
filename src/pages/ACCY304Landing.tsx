import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { toast } from "sonner";

const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";
const HERO_IMG = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png";

type Step = "email" | "picker" | "results";

interface ProblemSelection {
  chapterId: string;
  type: string;
  sourceCode: string;
  sourceLabel: string;
}

// ── Wave SVG Divider ────────────────────────────────────────────────
function WaveDivider({ topColor, bottomColor, flip }: { topColor: string; bottomColor: string; flip?: boolean }) {
  return (
    <div className="relative w-full overflow-hidden leading-[0]" style={{ background: bottomColor, marginTop: -1 }}>
      <svg
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: 60, transform: flip ? "scaleY(-1)" : undefined }}
      >
        <path
          d="M0,0 C360,100 1080,0 1440,80 L1440,0 L0,0 Z"
          fill={topColor}
        />
      </svg>
    </div>
  );
}

// ── Shared Select Wrapper ───────────────────────────────────────────
function StyledSelect({
  value,
  onChange,
  disabled,
  children,
  light,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full appearance-none rounded-md px-3 py-2.5 text-[14px] pr-8 focus:outline-none focus:ring-2 disabled:opacity-50 ${
          light
            ? "bg-white/10 border border-white/20 text-white focus:ring-white/30 focus:border-white/40"
            : "bg-white border border-gray-300 focus:ring-[#14213D]/20 focus:border-[#14213D]"
        }`}
        style={light ? { colorScheme: "dark" } : undefined}
      >
        {children}
      </select>
      <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${light ? "text-white/50" : "text-gray-400"}`} />
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
      <p className="text-[12px] font-bold text-white/70">Problem {index + 1}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StyledSelect
          value={selection.chapterId}
          onChange={(e) => onChange({ ...selection, chapterId: e.target.value, sourceCode: "", sourceLabel: "" })}
          light
        >
          <option value="">Select chapter…</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</option>
          ))}
        </StyledSelect>

        <StyledSelect
          value={selection.type}
          onChange={(e) => onChange({ ...selection, type: e.target.value, sourceCode: "", sourceLabel: "" })}
          light
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
          light
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
        <p className="text-red-300 text-[12px]">You've already selected this problem — please choose a different one.</p>
      )}
    </div>
  );
}

// ── Testimonial Widget ──────────────────────────────────────────────
function TestimonialWidget() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load iframeResizer script
    const script = document.createElement("script");
    script.src = "https://testimonial.to/js/iframeResizer.min.js";
    script.async = true;
    script.onload = () => {
      try {
        (window as any).iFrameResize(
          { log: false, checkOrigin: false },
          "#testimonialto-317c8816-eefb-469f-8173-b79efef6c2fa"
        );
      } catch (_) {}
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch (_) {} };
  }, []);

  return (
    <div ref={ref}>
      <iframe
        id="testimonialto-317c8816-eefb-469f-8173-b79efef6c2fa"
        src="https://embed-v2.testimonial.to/w/survive-accounting-with-lee-ingram?id=317c8816-eefb-469f-8173-b79efef6c2fa"
        frameBorder="0"
        scrolling="no"
        width="100%"
        style={{ minHeight: 300 }}
      />
    </div>
  );
}

// ── Main Landing Page ───────────────────────────────────────────────
export default function ACCY304Landing() {
  const enrollUrl = useEnrollUrl();

  // ── Free Preview state ──
  const [previewChapterId, setPreviewChapterId] = useState("");
  const [previewType, setPreviewType] = useState("any");
  const [previewSourceCode, setPreviewSourceCode] = useState("");
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  // ── Email Capture state ──
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

  // ── Free preview problem list ──
  const { data: previewProblems } = useQuery({
    queryKey: ["accy304-preview-problems", previewChapterId, previewType],
    queryFn: async () => {
      if (!previewChapterId) return [];

      const { data: approvedAssets } = await supabase
        .from("teaching_assets")
        .select("asset_name, source_ref")
        .eq("chapter_id", previewChapterId)
        .not("asset_approved_at", "is", null)
        .order("source_ref");

      const { data: chapterProblems } = await supabase
        .from("chapter_problems")
        .select("source_code, source_label")
        .eq("chapter_id", previewChapterId)
        .order("source_code");

      const approved = approvedAssets || [];
      const labelsByCode = new Map((chapterProblems || []).map((p: any) => [p.source_code, p.source_label]));

      let filtered = approved;
      if (previewType === "BE") filtered = filtered.filter((p: any) => p.source_ref?.startsWith("BE"));
      else if (previewType === "E") filtered = filtered.filter((p: any) => p.source_ref?.startsWith("E") && !p.source_ref?.startsWith("EX"));
      else if (previewType === "P") filtered = filtered.filter((p: any) => p.source_ref?.startsWith("P"));

      return filtered.map((p: any) => ({
        asset_name: p.asset_name,
        source_ref: p.source_ref,
        source_label: labelsByCode.get(p.source_ref) || p.source_ref,
      }));
    },
    enabled: !!previewChapterId,
  });

  const handleShowPreview = async () => {
    if (!previewSourceCode) return;
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

  // ── Email submit ──
  const handleEmailSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    const allowedExceptions = ["lee@survivestudios.com"];
    if (!trimmed.endsWith(".edu") && !allowedExceptions.includes(trimmed)) {
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

  // ── Problem submit ──
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
    <div className="min-h-screen" style={{ background: "#FAFBFC" }}>

      {/* ═══════════════════════════════════════════════════════════
          HERO IMAGE — full width
         ═══════════════════════════════════════════════════════════ */}
      <div className="w-full overflow-hidden" style={{ height: 420 }}>
        <img
          src={HERO_IMG}
          alt="Ole Miss campus"
          className="w-full h-full object-cover"
          style={{ objectPosition: "center top" }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HERO CTA — dark navy
         ═══════════════════════════════════════════════════════════ */}
      <section style={{ background: "#14213D" }} className="px-6 py-16 md:py-20">
        <div className="max-w-[760px] mx-auto text-center">
          <h1 className="text-white font-extrabold text-[34px] md:text-[46px] leading-[1.1] tracking-tight">
            Exam Prep Built for Ole Miss ACCY 304 Students
          </h1>
          <p className="text-white/75 text-[16px] md:text-[18px] mt-5 max-w-[620px] mx-auto leading-relaxed">
            Get 500+ practice problems with full worked solutions, journal entries, formulas, exam traps, and more — covering every chapter in Intermediate Accounting 2.
          </p>

          <div className="mt-10">
            <a
              href={enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full md:w-auto px-12 py-4 rounded-lg font-bold text-[18px] text-white transition-all hover:brightness-90"
              style={{ background: "#CE1126" }}
            >
              Get Full Access — $125/semester
            </a>
          </div>

          <p className="text-white/40 text-[13px] mt-4 tracking-wide">
            50% off for Spring 2026 · Normally $250 · 7-day refund policy · Access all semester · Covers Ch 13–22
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TESTIMONIALS
         ═══════════════════════════════════════════════════════════ */}
      <WaveDivider topColor="#14213D" bottomColor="#F7F8FA" />
      <section style={{ background: "#F7F8FA" }} className="px-6 py-16 md:py-20">
        <div className="max-w-[960px] mx-auto">
          <h2 className="text-center font-bold text-[26px] md:text-[30px] tracking-tight" style={{ color: "#14213D" }}>
            What Students Are Saying
          </h2>
          <div className="mt-10">
            <TestimonialWidget />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FREE PREVIEW — powder blue
         ═══════════════════════════════════════════════════════════ */}
      <WaveDivider topColor="#F7F8FA" bottomColor="#006BA6" />
      <section id="free-preview" style={{ background: "#006BA6" }} className="px-6 py-16 md:py-20">
        <div className="max-w-[760px] mx-auto">
          <h2 className="text-center text-white font-bold text-[26px] md:text-[30px] tracking-tight">
            Try Any Problem — Free Preview
          </h2>
          <p className="text-center text-white/70 text-[15px] mt-3 mb-10 max-w-[580px] mx-auto leading-relaxed">
            See exactly what you get. Pick any problem below and view the full page — solutions are locked until you buy a Study Pass.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <StyledSelect
              value={previewChapterId}
              onChange={(e) => { setPreviewChapterId(e.target.value); setPreviewSourceCode(""); setIframeSrc(null); }}
              light
            >
              <option value="">Select chapter…</option>
              {(courseData?.chapters || []).map((ch) => (
                <option key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</option>
              ))}
            </StyledSelect>

            <StyledSelect
              value={previewType}
              onChange={(e) => { setPreviewType(e.target.value); setPreviewSourceCode(""); }}
              light
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
              light
            >
              <option value="">
                {!previewChapterId ? "Select chapter first…" : previewProblems?.length ? "Select problem…" : "No problems found"}
              </option>
              {previewProblems?.map((p: any) => (
                <option key={p.asset_name} value={p.source_ref}>{p.source_label}</option>
              ))}
            </StyledSelect>
          </div>

          <button
            onClick={handleShowPreview}
            disabled={!previewSourceCode}
            className="px-8 py-3 rounded-md font-bold text-[14px] transition-all hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            style={{ background: "#FFFFFF", color: "#006BA6" }}
          >
            Show Me This Problem →
          </button>

          {iframeSrc && (
            <div className="mt-8 rounded-lg overflow-hidden" style={{ background: "#fff" }}>
              <iframe
                src={iframeSrc}
                title="Problem Preview"
                className="w-full border-0"
                style={{ height: 900 }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          EMAIL CAPTURE — dark navy
         ═══════════════════════════════════════════════════════════ */}
      <WaveDivider topColor="#006BA6" bottomColor="#14213D" />
      <section style={{ background: "#14213D" }} className="px-6 py-16 md:py-20">
        <div className="max-w-[760px] mx-auto">

          {/* ── STEP 1: Email ── */}
          {step === "email" && !alreadyUsed && (
            <div className="text-center">
              <h2 className="text-white font-bold text-[26px] md:text-[30px] tracking-tight">
                Get 3 Full Solutions — Free
              </h2>
              <p className="text-white/60 text-[15px] mt-3 mb-10 max-w-[560px] mx-auto leading-relaxed">
                Enter your olemiss.edu email to unlock 3 fully worked solutions normally only available to Study Pass holders. No payment details required.
              </p>

              <div className="max-w-[420px] mx-auto text-left">
                <label className="block text-[12px] font-medium text-white/50 mb-1.5">University Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="yourname@olemiss.edu"
                  className="w-full rounded-md px-4 py-3 text-[14px] bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
                />
                {emailError && (
                  <p className="text-red-300 text-[13px] mt-2">{emailError}</p>
                )}
                <button
                  onClick={handleEmailSubmit}
                  disabled={submitting || !email.trim()}
                  className="w-full mt-4 px-8 py-3.5 rounded-md font-bold text-[15px] text-white transition-all hover:brightness-90 disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "#CE1126" }}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── Already used ── */}
          {alreadyUsed && (
            <div className="text-center py-8">
              <p className="text-white font-bold text-[22px]">
                You've already used your free preview
              </p>
              <p className="text-white/60 text-[14px] mt-2 max-w-[480px] mx-auto">
                Each .edu email gets one free preview session. Get full access to every problem with a Study Pass.
              </p>
              <a
                href={enrollUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-6 px-8 py-3.5 rounded-md font-bold text-[16px] text-white transition-all hover:brightness-90"
                style={{ background: "#CE1126" }}
              >
                Get Full Access — $125/semester →
              </a>
            </div>
          )}

          {/* ── STEP 2: Problem Picker ── */}
          {step === "picker" && (
            <>
              <h2 className="text-center text-white font-bold text-[26px] md:text-[30px] tracking-tight">
                Choose 3 Problems to Unlock
              </h2>
              <p className="text-center text-white/60 text-[15px] mt-3 mb-10 max-w-[520px] mx-auto">
                Pick any 3 problems from Chapters 13–22. You'll get full access to their worked solutions for 24 hours.
              </p>

              <div className="space-y-6 mb-8">
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
                className="w-full md:w-auto px-8 py-3.5 rounded-md font-bold text-[15px] text-white transition-all hover:brightness-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#CE1126" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Get My Free Preview →
              </button>
            </>
          )}

          {/* ── STEP 3: Results ── */}
          {step === "results" && sessionResult && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full mb-4" style={{ background: "rgba(46,125,50,0.2)" }}>
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-[22px]">
                Here are your 3 free problems
              </h2>
              <p className="text-white/60 text-[14px] mt-2 mb-8">
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
                      className="flex items-center gap-3 px-5 py-4 rounded-lg border border-white/10 hover:border-white/30 transition-all hover:bg-white/5"
                    >
                      <span className="flex items-center justify-center h-8 w-8 rounded-full text-[13px] font-bold shrink-0" style={{ background: "#CE1126", color: "#fff" }}>
                        {i + 1}
                      </span>
                      <span className="flex-1">
                        <span className="font-bold text-[14px] text-white">{link.sourceLabel}</span>
                      </span>
                      <ExternalLink className="h-4 w-4 text-white/40 shrink-0" />
                    </a>
                  );
                })}
              </div>

              <p className="text-white/40 text-[12px] mt-6">
                Want full access to every problem? →{" "}
                <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-white/70 hover:text-white">
                  Get a Study Pass
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <WaveDivider topColor="#14213D" bottomColor="#0D1528" />
      <section style={{ background: "#0D1528" }} className="px-6 py-16 md:py-20">
        <div className="max-w-[760px] mx-auto text-center">
          <p className="text-white font-bold text-[26px] md:text-[30px] tracking-tight">Ready to stop guessing on exams?</p>
          <p className="text-white/60 text-[15px] mt-3">
            Join ACCY 304 students getting full access to every Intermediate Accounting 2 problem.
          </p>
          <div className="mt-8">
            <a
              href={enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full md:w-auto px-12 py-4 rounded-lg font-bold text-[18px] text-white transition-all hover:brightness-90"
              style={{ background: "#CE1126" }}
            >
              Get Study Pass — $125/semester
            </a>
          </div>
          <p className="text-white/35 text-[12px] mt-4 tracking-wide">
            50% off for Spring 2026 · 7-day refund policy · Access all semester · Covers Ch 13–22
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-6" style={{ background: "#0A0E1A" }}>
        <p className="text-center text-white/30 text-[12px]">
          Survive Accounting · Lee Ingram · surviveaccounting.com
        </p>
      </footer>
    </div>
  );
}

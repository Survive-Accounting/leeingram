import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, Check } from "lucide-react";
import { toast } from "sonner";
import GreekOrgSearch from "./GreekOrgSearch";

const NAVY = "#14213D";
const RED = "#CE1126";

interface Campus {
  id: string;
  name: string;
  slug: string;
}
const CATCH_ALL_SLUG = "general";
interface Course {
  id: string;
  course_name: string;
}

interface Props {
  userId: string;
  email: string;
  prefillCampusId: string | null;
  prefillCourseId: string | null;
  prefillName: string;
  onComplete: (result: {
    legacy: boolean;
    beta_number: number | null;
    campus_beta_number: number | null;
    campus_name: string | null;
  }) => void;
}

type Step = 1 | 2 | 3;

export default function OnboardingModal({
  userId,
  email,
  prefillCampusId,
  prefillCourseId,
  prefillName,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState(prefillName);
  const [campusId, setCampusId] = useState<string | null>(prefillCampusId);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [courseId] = useState<string | null>(prefillCourseId);
  const [syllabusPath, setSyllabusPath] = useState<string | null>(null);
  const [syllabusName, setSyllabusName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [campusWriteIn, setCampusWriteIn] = useState("");

  const [major, setMajor] = useState<"yes" | "no" | "definitely_not" | null>(null);
  const [inGreek, setInGreek] = useState<boolean | null>(null);
  const [greekOrgId, setGreekOrgId] = useState<string | null>(null);
  const [greekOther, setGreekOther] = useState("");

  const [confidence, setConfidence] = useState<number>(5);

  // Load campus list
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("campuses")
        .select("id, name, slug")
        .eq("status", "active")
        .order("name", { ascending: true });
      setCampuses((data || []) as Campus[]);
    })();
  }, []);

  const prefilledCampus = useMemo(
    () => campuses.find((c) => c.id === campusId) || null,
    [campuses, campusId],
  );
  const isCatchAll = prefilledCampus?.slug === CATCH_ALL_SLUG;

  // Validation per step
  const canAdvance = useMemo(() => {
    if (step === 1) {
      // Catch-all campus: name only — write-in/skip is allowed.
      if (isCatchAll) return name.trim().length > 0;
      return name.trim().length > 0 && !!campusId;
    }
    if (step === 2) {
      if (!major) return false;
      if (inGreek === null) return false;
      if (inGreek && !greekOrgId && !greekOther.trim()) return false;
      return true;
    }
    if (step === 3) {
      return confidence >= 1 && confidence <= 10;
    }
    return false;
  }, [step, name, campusId, isCatchAll, major, inGreek, greekOrgId, greekOther, confidence]);

  const handleSyllabusUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Syllabus too large (max 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `syllabi/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("chapter-resources")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setSyllabusPath(path);
      setSyllabusName(file.name);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't upload that file. Try again or skip.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("complete-onboarding", {
        body: {
          display_name: name.trim(),
          campus_id: campusId,
          course_id: courseId,
          syllabus_file_path: syllabusPath,
          is_accounting_major: major,
          is_in_greek_life: inGreek,
          greek_org_id: greekOrgId,
          greek_org_other: greekOther.trim() || null,
          confidence_1_10: confidence,
        },
      });
      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || "Couldn't save");
      }
      onComplete({
        legacy: !!data.legacy,
        beta_number: data.beta_number ?? null,
        campus_beta_number: data.campus_beta_number ?? null,
        campus_name: data.campus_name ?? null,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Something went wrong. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6"
      style={{
        background: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ border: "1px solid #E0E7F0" }}
      >
        {/* Header / progress */}
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex-1 h-1 rounded-full transition-all"
                style={{
                  background: n <= step ? RED : "#E5E7EB",
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-[11.5px] uppercase tracking-widest" style={{ color: "#94A3B8" }}>
            Step {step} of 3
          </p>
          <h2
            className="mt-1 text-[22px] sm:text-[26px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            {step === 1 && "Let's get you set up"}
            {step === 2 && "A bit about you"}
            {step === 3 && "How ready do you feel?"}
          </h2>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {step === 1 && (
            <>
              <Field label="Your first name" required>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan"
                  className="w-full rounded-lg px-3 py-2.5 text-[15px] outline-none focus:ring-2"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: NAVY,
                  }}
                />
              </Field>

              <Field label="Your campus" required>
                <select
                  value={campusId ?? ""}
                  onChange={(e) => setCampusId(e.target.value || null)}
                  className="w-full rounded-lg px-3 py-2.5 text-[15px] outline-none"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: NAVY,
                  }}
                >
                  <option value="">Select your campus…</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Upload your syllabus" optional>
                {syllabusPath ? (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px]"
                    style={{
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      color: "#065F46",
                    }}
                  >
                    <Check className="h-4 w-4" />
                    <span className="flex-1 truncate">{syllabusName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSyllabusPath(null);
                        setSyllabusName(null);
                      }}
                      className="opacity-60 hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors text-[13.5px]"
                    style={{
                      background: "#F8FAFC",
                      border: "1px dashed #CBD5E1",
                      color: "#64748B",
                    }}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{uploading ? "Uploading…" : "Choose a file (PDF, DOCX, image)"}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSyllabusUpload(f);
                      }}
                    />
                  </label>
                )}
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Are you majoring in accounting?" required>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["yes", "Yes"],
                    ["no", "No"],
                    ["definitely_not", "Definitely not"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMajor(val)}
                      className="rounded-lg py-2.5 text-[13.5px] font-medium transition-all"
                      style={{
                        background: major === val ? NAVY : "#F8FAFC",
                        color: major === val ? "#fff" : "#475569",
                        border: `1px solid ${major === val ? NAVY : "#E2E8F0"}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Are you in a fraternity or sorority?"
                required
                hint="We do bulk member deals with chapters."
              >
                <div className="grid grid-cols-2 gap-2">
                  {([
                    [true, "Yes"],
                    [false, "No"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => {
                        setInGreek(val);
                        if (!val) {
                          setGreekOrgId(null);
                          setGreekOther("");
                        }
                      }}
                      className="rounded-lg py-2.5 text-[13.5px] font-medium transition-all"
                      style={{
                        background: inGreek === val ? NAVY : "#F8FAFC",
                        color: inGreek === val ? "#fff" : "#475569",
                        border: `1px solid ${inGreek === val ? NAVY : "#E2E8F0"}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {inGreek && (
                  <div className="mt-3">
                    <GreekOrgSearch
                      campusId={campusId}
                      selectedOrgId={greekOrgId}
                      otherText={greekOther}
                      onSelect={setGreekOrgId}
                      onOtherChange={setGreekOther}
                    />
                  </div>
                )}
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field
                label="Confidence for your next exam"
                required
                hint="1 = panicking, 10 = bring it on."
              >
                <div className="flex items-center gap-3">
                  <span className="text-[12px] w-8" style={{ color: "#94A3B8" }}>
                    1
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="flex-1 accent-[var(--brand-red)]"
                    style={{ accentColor: RED }}
                  />
                  <span className="text-[12px] w-8 text-right" style={{ color: "#94A3B8" }}>
                    10
                  </span>
                </div>
                <div
                  className="mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-[13px] font-semibold"
                  style={{
                    background: NAVY,
                    color: "#fff",
                    minWidth: 40,
                  }}
                >
                  {confidence} / 10
                </div>
              </Field>

              <p className="text-[12.5px] leading-relaxed" style={{ color: "#64748B" }}>
                You're {email}. We'll use this to tailor what we recommend you tackle first.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid #F1F5F9", background: "#FAFBFC" }}
        >
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            disabled={step === 1 || submitting}
            className="text-[13px] font-medium disabled:opacity-30"
            style={{ color: "#64748B" }}
          >
            ← Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((s) => ((s + 1) as Step))}
              className="rounded-md px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance || submitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all disabled:opacity-40"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
              }}
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Enter the beta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[13px] font-semibold" style={{ color: NAVY }}>
          {label}
          {required && (
            <span className="ml-1" style={{ color: RED }}>
              *
            </span>
          )}
        </label>
        {optional && (
          <span className="text-[11px]" style={{ color: "#94A3B8" }}>
            optional
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "#94A3B8" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

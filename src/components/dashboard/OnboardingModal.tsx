import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsStaff } from "@/hooks/useIsStaff";

const NAVY = "#14213D";
const RED = "#CE1126";
const ONBOARDING_VERSION = "spring_2026_beta_v1";

type UserRole = "student" | "parent" | "professor" | "cpa_professional" | "other";
type MajorStatus = "yes" | "no" | "not_sure";

interface Props {
  userId: string;
  email: string;
  prefillCampusId: string | null;
  prefillCourseId: string | null;
  prefillName: string;
  /**
   * Simulate mode — staff-only preview. Submit does NOT call complete-onboarding;
   * it just calls onComplete with a stubbed result so changes can be UI-tested freely.
   */
  simulate?: boolean;
  onComplete: (result: {
    legacy: boolean;
    beta_number: number | null;
    campus_beta_number: number | null;
    campus_name: string | null;
  }) => void;
  onClose?: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; emoji: string }[] = [
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "parent", label: "Parent", emoji: "👨‍👩‍👧" },
  { value: "professor", label: "Professor", emoji: "📚" },
  { value: "cpa_professional", label: "CPA or professional", emoji: "💼" },
  { value: "other", label: "Other", emoji: "✨" },
];

const MAJOR_OPTIONS: { value: MajorStatus; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
];

/** Try to split a "Full Name" prefill into first/last. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function OnboardingModal({
  userId: _userId,
  email,
  prefillCampusId,
  prefillCourseId: _prefillCourseId,
  prefillName,
  simulate = false,
  onComplete,
  onClose,
}: Props) {
  const isStaff = useIsStaff();
  const [submitting, setSubmitting] = useState(false);

  // Pull first/last from auth metadata if the parent didn't supply them.
  const [authFirst, setAuthFirst] = useState<string>("");
  const [authLast, setAuthLast] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
      const first =
        (meta.first_name as string) ||
        (meta.given_name as string) ||
        "";
      const last =
        (meta.last_name as string) ||
        (meta.family_name as string) ||
        "";
      const full = (meta.full_name as string) || (meta.name as string) || "";
      if (cancelled) return;
      if (first || last) {
        setAuthFirst(first || "");
        setAuthLast(last || "");
      } else if (full) {
        const s = splitName(full);
        setAuthFirst(s.first);
        setAuthLast(s.last);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = useMemo(() => splitName(prefillName || ""), [prefillName]);

  const [firstName, setFirstName] = useState<string>(initial.first);
  const [lastName, setLastName] = useState<string>(initial.last);

  // Backfill from auth metadata if user hasn't typed anything yet.
  useEffect(() => {
    if (!firstName && authFirst) setFirstName(authFirst);
    if (!lastName && authLast) setLastName(authLast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFirst, authLast]);

  const [campusName, setCampusName] = useState<string | null>(null);
  useEffect(() => {
    if (!prefillCampusId) {
      setCampusName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("campuses")
        .select("name, slug")
        .eq("id", prefillCampusId)
        .maybeSingle();
      if (cancelled) return;
      // Hide the catch-all campus from the read-only context line — it's not
      // a real school the student would recognize.
      if (data && data.slug !== "general") {
        setCampusName(data.name);
      } else {
        setCampusName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillCampusId]);

  const [role, setRole] = useState<UserRole | null>(null);
  const [majorStatus, setMajorStatus] = useState<MajorStatus | null>(null);
  const [inGreek, setInGreek] = useState<boolean | null>(null);
  const [greekOrgName, setGreekOrgName] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (simulate) return true;
    if (!firstName.trim()) return false;
    if (!role) return false;
    if (role === "student" && !majorStatus) return false;
    return true;
  }, [simulate, firstName, role, majorStatus]);

  const handleSubmit = async () => {
    if (simulate) {
      toast.success("Simulated onboarding complete (nothing saved).");
      onComplete({
        legacy: false,
        beta_number: null,
        campus_beta_number: null,
        campus_name: null,
      });
      return;
    }
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("complete-onboarding", {
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          user_role: role,
          accounting_major_status: role === "student" ? majorStatus : null,
          campus_id: prefillCampusId,
          is_in_greek_life: inGreek,
          greek_org_other: inGreek ? (greekOrgName.trim() || null) : null,
          onboarding_version: ONBOARDING_VERSION,
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

  // Admin-only: bypass with safe defaults
  const handleAdminSkip = () => {
    if (simulate) {
      onComplete({
        legacy: false,
        beta_number: null,
        campus_beta_number: null,
        campus_name: null,
      });
      return;
    }
    setSubmitting(true);
    supabase.functions
      .invoke("complete-onboarding", {
        body: {
          first_name: firstName.trim() || authFirst || "Admin",
          last_name: lastName.trim() || authLast || "",
          user_role: role || "other",
          accounting_major_status: role === "student" ? (majorStatus || "not_sure") : null,
          campus_id: prefillCampusId,
          is_in_greek_life: inGreek,
          greek_org_other: inGreek ? (greekOrgName.trim() || null) : null,
          onboarding_version: ONBOARDING_VERSION,
        },
      })
      .then(({ data, error }) => {
        if (error || !data?.ok) {
          toast.error(error?.message || data?.error || "Couldn't save");
          setSubmitting(false);
          return;
        }
        onComplete({
          legacy: !!data.legacy,
          beta_number: data.beta_number ?? null,
          campus_beta_number: data.campus_beta_number ?? null,
          campus_name: data.campus_name ?? null,
        });
      });
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
        {/* Header */}
        <div className="px-6 pt-6 pb-2 relative">
          {simulate && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "#FEF3C7",
                  color: "#92400E",
                  border: "1px solid #FCD34D",
                }}
                title="Simulate mode — nothing is being saved"
              >
                🧪 Simulate
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close simulator"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <h2
            className="text-[24px] sm:text-[28px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Let's get you set up
          </h2>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "#64748B" }}>
            A couple quick questions so I can improve the beta.
          </p>
          {campusName && (
            <p className="mt-2 text-[12px]" style={{ color: "#94A3B8" }}>
              Campus: <span style={{ color: NAVY, fontWeight: 600 }}>{campusName}</span>
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First name" required>
              <input
                autoFocus={!firstName}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
                className="w-full rounded-lg px-3 py-2.5 text-[15px] outline-none focus:ring-2"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  color: NAVY,
                }}
              />
            </Field>
            <Field label="Last name">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
                className="w-full rounded-lg px-3 py-2.5 text-[15px] outline-none focus:ring-2"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  color: NAVY,
                }}
              />
            </Field>
          </div>

          {email && (
            <p className="text-[12px] -mt-2" style={{ color: "#94A3B8" }}>
              Signed in as <span style={{ color: NAVY, fontWeight: 600 }}>{email}</span>
            </p>
          )}

          {/* Role */}
          <Field label="Who are you?" required>
            <div className="grid grid-cols-1 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setRole(opt.value);
                      if (opt.value !== "student") setMajorStatus(null);
                    }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-[14.5px] font-medium transition-all"
                    style={{
                      background: active ? NAVY : "#F8FAFC",
                      color: active ? "#fff" : "#334155",
                      border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                    }}
                  >
                    <span className="text-[18px] leading-none">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Conditional: only for students */}
          {role === "student" && (
            <Field label="Are you majoring in accounting?" required>
              <div className="grid grid-cols-3 gap-2">
                {MAJOR_OPTIONS.map((opt) => {
                  const active = majorStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMajorStatus(opt.value)}
                      className="rounded-lg py-2.5 text-[13.5px] font-medium transition-all"
                      style={{
                        background: active ? NAVY : "#F8FAFC",
                        color: active ? "#fff" : "#475569",
                        border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {/* Optional: Greek life */}
          <Field
            label="Are you in a fraternity or sorority?"
            hint="Optional — we do bulk deals with chapters."
          >
            <div className="grid grid-cols-2 gap-2">
              {([
                [true, "Yes"],
                [false, "No"],
              ] as const).map(([val, label]) => {
                const active = inGreek === val;
                return (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => {
                      setInGreek(val);
                      if (!val) setGreekOrgName("");
                    }}
                    className="rounded-lg py-2.5 text-[13.5px] font-medium transition-all"
                    style={{
                      background: active ? NAVY : "#F8FAFC",
                      color: active ? "#fff" : "#475569",
                      border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {inGreek === true && (
              <input
                value={greekOrgName}
                onChange={(e) => setGreekOrgName(e.target.value)}
                placeholder="Which one? e.g. Kappa Alpha"
                className="mt-2 w-full rounded-lg px-3 py-2.5 text-[15px] outline-none focus:ring-2"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  color: NAVY,
                }}
              />
            )}
          </Field>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid #F1F5F9", background: "#FAFBFC" }}
        >
          <div>
            {isStaff && (
              <button
                type="button"
                onClick={handleAdminSkip}
                disabled={submitting}
                className="text-[12px] font-medium underline disabled:opacity-30"
                style={{ color: "#94A3B8" }}
                title="Admin only"
              >
                Admin: skip
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Start studying
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
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

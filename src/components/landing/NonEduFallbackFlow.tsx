import { useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DevShortcut } from "@/components/DevShortcut";

const NAVY = "#14213D";
const RED = "#CE1126";
const SHARE_URL = "surviveaccounting.com";

type Role = "parent" | "student_no_edu" | "independent_learner";

const ROLE_OPTIONS: { value: Role; label: string; intentTag: string }[] = [
  { value: "parent", label: "I'm a parent of an accounting student", intentTag: "role_parent" },
  { value: "student_no_edu", label: "I'm a student without a school email", intentTag: "role_student_no_edu" },
  { value: "independent_learner", label: "I'm studying accounting on my own", intentTag: "role_independent_learner" },
];

const SHARE_COPY: Record<Role, { text: string; label: string }> = {
  parent: {
    text: "Know another parent whose kid is struggling with accounting?",
    label: "Share with other parents →",
  },
  student_no_edu: {
    text: "Know other students who could use this?",
    label: "Share with other students →",
  },
  independent_learner: {
    text: "Know someone else studying accounting?",
    label: "Share with others →",
  },
};

interface NonEduFallbackFlowProps {
  /** Pre-fill the email input with what they typed before. */
  initialEmail?: string;
  /** Course slug context, if any. */
  courseSlug?: string | null;
  /** Where this fallback is invoked from (e.g. "get_started_modal"). */
  sourceContext?: string;
}

export default function NonEduFallbackFlow({
  initialEmail = "",
  courseSlug = null,
  sourceContext,
}: NonEduFallbackFlowProps) {
  const [stage, setStage] = useState<"role" | "email" | "success">("role");
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedRole = role
    ? ROLE_OPTIONS.find((o) => o.value === role)!
    : null;

  const handleRoleContinue = () => {
    if (!role) return;
    setStage("email");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !selectedRole) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("landing_page_leads").insert({
        email: trimmed,
        email_type: "non_edu",
        university_domain: trimmed.split("@")[1] || null,
        course_slug: courseSlug,
        intent_tag: selectedRole.intentTag,
        source: "non_edu_fallback",
      });
      if (error) throw error;
      setStage("success");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${SHARE_URL}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please copy manually.");
    }
  };

  // ---------- ROLE STAGE ----------
  if (stage === "role") {
    return (
      <div className="space-y-4">
        <div>
          <h2
            className="text-[20px] font-semibold"
            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            Tell us a bit about yourself.
          </h2>
          <p
            className="text-[13px] mt-1.5 leading-relaxed"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            So we can personalize your experience.
          </p>
        </div>

        <div className="space-y-2">
          {ROLE_OPTIONS.map((opt) => {
            const isSelected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className="w-full text-left rounded-lg px-4 py-3 text-[14px] font-medium transition-all flex items-center gap-3"
                style={{
                  background: isSelected ? "#FEF2F2" : "white",
                  boxShadow: isSelected
                    ? `0 0 0 2px ${RED}`
                    : "0 0 0 1px #E5E7EB",
                  color: NAVY,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span
                  className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: isSelected ? RED : "#D1D5DB" }}
                >
                  {isSelected && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: RED }}
                    />
                  )}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {role && (
          <button
            type="button"
            onClick={handleRoleContinue}
            className="w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99]"
            style={{
              background: RED,
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 4px 14px rgba(206,17,38,0.3)",
            }}
          >
            Continue →
          </button>
        )}
        <div className="text-center pt-1">
          <DevShortcut label="[DEV] Bypass →" to="/campus/general/intermediate-accounting-2" />
        </div>
      </div>
    );
  }

  // ---------- EMAIL STAGE ----------
  if (stage === "email") {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <h2
            className="text-[20px] font-semibold"
            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            What's your email?
          </h2>
          <p
            className="text-[13px] mt-1.5 leading-relaxed"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            We'll send you a free preview link.
          </p>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={submitting}
          autoFocus
          className="w-full rounded-lg px-4 py-3 text-[14px] outline-none focus:border-[#14213D]"
          style={{
            background: "#F8F9FA",
            border: "1px solid #E5E7EB",
            color: NAVY,
            fontFamily: "Inter, sans-serif",
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-80 disabled:cursor-wait flex items-center justify-center gap-2"
          style={{
            background: RED,
            fontFamily: "Inter, sans-serif",
            boxShadow: "0 4px 14px rgba(206,17,38,0.3)",
          }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Me Access →"}
        </button>
        <div className="text-center pt-1">
          <DevShortcut label="[DEV] Bypass →" to="/campus/general/intermediate-accounting-2" />
        </div>
      </form>
    );
  }

  // ---------- SUCCESS STAGE ----------
  const share = role ? SHARE_COPY[role] : SHARE_COPY.independent_learner;
  return (
    <div className="space-y-5 py-1">
      <div className="text-center space-y-2">
        <div className="text-4xl leading-none" aria-hidden="true">✉️</div>
        <h2
          className="text-[24px] leading-tight"
          style={{
            color: NAVY,
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
          }}
        >
          You're in.
        </h2>
        <p
          className="text-[14px]"
          style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
        >
          Check your email for your free preview link.
        </p>
      </div>

      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}
      >
        <p
          className="text-[13px] leading-relaxed text-center"
          style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
        >
          {share.text}
        </p>
        <p
          className="text-[13px] font-semibold text-center"
          style={{ color: RED, fontFamily: "Inter, sans-serif" }}
        >
          {share.label}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="w-full rounded-lg py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 transition-all hover:bg-white"
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            color: NAVY,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" /> Copied! ✓
            </>
          ) : (
            <>
              <span>{SHARE_URL}</span>
              <Copy className="w-4 h-4" style={{ color: "#6B7280" }} />
            </>
          )}
        </button>
      </div>
      <div className="text-center">
        <DevShortcut label="[DEV] Bypass →" to="/campus/general/intermediate-accounting-2" />
      </div>
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DevShortcut } from "@/components/DevShortcut";
import { sendMagicLink } from "@/lib/sendMagicLink";
import CheckEmailPanel from "@/components/landing/CheckEmailPanel";

const NAVY = "#14213D";
const RED = "#CE1126";

const COURSES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Introductory Accounting 1", slug: "intro-accounting-1", status: "future" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Introductory Accounting 2", slug: "intro-accounting-2", status: "upcoming" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Intermediate Accounting 1", slug: "intermediate-accounting-1", status: "future" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Intermediate Accounting 2", slug: "intermediate-accounting-2", status: "live" },
];

interface SmartEmailModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "email" | "magic-link-sent" | "course-select" | "resolving-campus" | "resolving-coupon" | "pricing";

interface PricingState {
  course: typeof COURSES[0];
  campusSlug: string;
  fullPass: {
    productId: string;
    anchorCents: number;
    finalCents: number;
    savingsCents: number;
    couponCode: string | null;
    couponName: string | null;
    discountPercent: number;
  } | null;
  bundle: {
    productId: string;
    name: string;
    finalCents: number;
    anchorCents: number;
    savingsCents: number;
  } | null;
}

export default function SmartEmailModal({ open, onClose }: SmartEmailModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [pricing, setPricing] = useState<PricingState | null>(null);
  const [launching, setLaunching] = useState<"full" | "bundle" | null>(null);

  const reset = () => {
    setEmail(""); setWarning(""); setStep("email"); setLoading(false);
    setPricing(null); setLaunching(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { data: student } = await (supabase as any)
        .from("students").select("id").eq("email", trimmed).maybeSingle();

      if (student) {
        const res = await sendMagicLink({ email: trimmed });
        if (!res.ok) throw new Error(res.error || "send_failed");
        setStep("magic-link-sent");
      } else {
        setStep("course-select");
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSelect = async (course: typeof COURSES[0]) => {
    const trimmed = email.trim().toLowerCase();
    sessionStorage.setItem("student_email", trimmed);
    setStep("resolving-campus");

    try {
      // Resolve campus
      const { data: campusData, error: cErr } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: course.slug },
      });
      if (cErr) throw cErr;
      const campusSlug = campusData?.campus_slug || "general";
      if (campusData?.is_test_mode) {
        sessionStorage.setItem("sa_test_mode", "true");
        sessionStorage.setItem("sa_email_override", campusData.email_override || "");
      }

      setStep("resolving-coupon");

      // Look up the active full-pass course_product for this course
      const { data: cp } = await (supabase as any)
        .from("course_products")
        .select("id, anchor_price_cents")
        .eq("course_id", course.id)
        .eq("product_type", "semester_pass")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let fullPass: PricingState["fullPass"] = null;
      if (cp?.id) {
        // Resolve campus_id from slug for coupon scoping
        let campusId: string | null = null;
        if (campusSlug && campusSlug !== "general") {
          const { data: campusRow } = await (supabase as any)
            .from("campuses").select("id").eq("slug", campusSlug).maybeSingle();
          campusId = campusRow?.id || null;
        }

        const { data: coupon } = await supabase.functions.invoke("resolve-coupon", {
          body: {
            email: trimmed,
            product_id: cp.id,
            product_type: "semester_pass",
            university_id: campusId,
          },
        });

        fullPass = {
          productId: cp.id,
          anchorCents: coupon?.anchor_price_cents ?? cp.anchor_price_cents ?? 25000,
          finalCents: coupon?.final_price_cents ?? cp.anchor_price_cents ?? 25000,
          savingsCents: coupon?.savings_cents ?? 0,
          couponCode: coupon?.coupon_applied?.code ?? null,
          couponName: coupon?.coupon_applied?.name ?? null,
          discountPercent: coupon?.coupon_applied?.discount_percent ?? 0,
        };
      }

      // Auto-pick best active bundle that includes this course
      const { data: bundles } = await (supabase as any)
        .from("bundle_products")
        .select("id, name, final_price_cents, anchor_price_cents, course_ids")
        .eq("is_active", true);

      let bundle: PricingState["bundle"] = null;
      const match = (bundles || []).find((b: any) => Array.isArray(b.course_ids) && b.course_ids.includes(course.id));
      if (match) {
        bundle = {
          productId: match.id,
          name: match.name,
          finalCents: match.final_price_cents ?? match.anchor_price_cents ?? 0,
          anchorCents: match.anchor_price_cents ?? 0,
          savingsCents: Math.max(0, (match.anchor_price_cents ?? 0) - (match.final_price_cents ?? 0)),
        };
      }

      setPricing({ course, campusSlug, fullPass, bundle });
      setStep("pricing");
    } catch {
      toast.error("Something went wrong. Try again.");
      setStep("course-select");
    }
  };

  const launchCheckout = async (kind: "full" | "bundle") => {
    if (!pricing) return;
    const trimmed = email.trim().toLowerCase();
    setLaunching(kind);
    try {
      // Resolve campus_id from slug for metadata
      let universityId: string | null = null;
      if (pricing.campusSlug && pricing.campusSlug !== "general") {
        const { data: campusRow } = await (supabase as any)
          .from("campuses").select("id").eq("slug", pricing.campusSlug).maybeSingle();
        universityId = campusRow?.id || null;
      }

      const body: any = {
        email: trimmed,
        return_url: window.location.origin,
        is_test_mode: sessionStorage.getItem("sa_test_mode") === "true",
        email_override: sessionStorage.getItem("sa_email_override") || "",
        university_id: universityId,
      };

      if (kind === "full" && pricing.fullPass) {
        body.product_type = "semester_pass";
        body.course_id = pricing.course.id;
      } else if (kind === "bundle" && pricing.bundle) {
        body.product_type = "bundle";
        body.bundle_id = pricing.bundle.productId;
      } else {
        throw new Error("Missing product");
      }

      const { data, error } = await supabase.functions.invoke("create-checkout-session", { body });
      if (error) throw error;
      const checkoutUrl = data?.checkout_url || data?.url;
      if (!checkoutUrl) throw new Error("No checkout URL returned");

      // Stripe hosted checkout — same tab, Stripe handles redirect back
      window.open(checkoutUrl, "_self");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLaunching(null);
    }
  };

  const fmt = (cents: number) => `$${Math.round(cents / 100)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm p-6 [&>button]:hidden" style={{ borderRadius: 16 }}>
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              Enter your school email to see pricing
            </h2>
            <div className="space-y-1.5">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setWarning(""); }}
                placeholder="your@university.edu"
                required
                disabled={loading}
                className="w-full rounded-lg px-4 text-[15px] outline-none transition-all focus:ring-2"
                style={{ minHeight: 48, background: "#F8F9FA", border: "1px solid #E5E7EB", color: NAVY, fontFamily: "Inter, sans-serif" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
            </button>
            <div className="mt-3 text-center">
              <DevShortcut label="[DEV] Skip to preview →" to="/campus/general/intermediate-accounting-2" />
            </div>
          </form>
        )}

        {step === "magic-link-sent" && (
          <CheckEmailPanel
            email={email}
            onChangeEmail={() => { setStep("email"); }}
            onDismiss={handleClose}
            dismissLabel="Done"
          />
        )}

        {step === "course-select" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              What course are you studying?
            </h2>
            <div className="space-y-2">
              {COURSES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCourseSelect(c)}
                  className="w-full text-left rounded-lg px-4 py-3 text-[14px] font-medium transition-colors hover:bg-gray-100"
                  style={{ border: "1px solid #E5E7EB", color: NAVY, fontFamily: "Inter, sans-serif" }}
                >
                  {c.name}
                  {c.status === "live" && (
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#22C55E", color: "white" }}>LIVE</span>
                  )}
                  {c.status === "upcoming" && (
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#F97316", color: "white" }}>COMING SOON</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(step === "resolving-campus" || step === "resolving-coupon") && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} />
            <p className="text-[14px]" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
              {step === "resolving-campus" ? "Finding your school..." : "Finding your best price..."}
            </p>
          </div>
        )}

        {step === "pricing" && pricing && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
                {pricing.course.name}
              </h2>
              {pricing.fullPass && (
                <div className="mt-2">
                  {pricing.fullPass.couponCode && pricing.fullPass.savingsCents > 0 ? (
                    <div className="flex items-center gap-2 text-[13px]" style={{ color: "#16A34A", fontFamily: "Inter, sans-serif" }}>
                      <Sparkles className="h-4 w-4" />
                      <span>
                        Your price: <strong>{fmt(pricing.fullPass.finalCents)}</strong> ({pricing.fullPass.discountPercent}% off
                        {pricing.fullPass.couponName ? ` with ${pricing.fullPass.couponName}` : ""})
                      </span>
                    </div>
                  ) : (
                    <p className="text-[13px]" style={{ color: "#6B7280" }}>
                      Your price: <strong>{fmt(pricing.fullPass.finalCents)}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {pricing.fullPass && (
                <button
                  onClick={() => launchCheckout("full")}
                  disabled={launching !== null}
                  className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ minHeight: 56, background: RED, fontFamily: "Inter, sans-serif" }}
                >
                  {launching === "full" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Setting up your checkout...
                    </span>
                  ) : pricing.fullPass.couponCode && pricing.fullPass.savingsCents > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="line-through opacity-60 text-[13px]">{fmt(pricing.fullPass.anchorCents)}</span>
                      <span>Get Full Access — {fmt(pricing.fullPass.finalCents)} →</span>
                    </span>
                  ) : (
                    `Get Full Access — ${fmt(pricing.fullPass.finalCents)} →`
                  )}
                </button>
              )}

              {pricing.bundle && (
                <button
                  onClick={() => launchCheckout("bundle")}
                  disabled={launching !== null}
                  className="w-full rounded-lg text-white text-[15px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ minHeight: 56, background: NAVY, fontFamily: "Inter, sans-serif" }}
                >
                  {launching === "bundle" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Bundle &amp; Save — {fmt(pricing.bundle.finalCents)} →</span>
                      <span className="text-[11px] font-normal opacity-80">{pricing.bundle.name}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-[11px] text-center" style={{ color: "#9CA3AF" }}>
              Secure checkout powered by Stripe.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

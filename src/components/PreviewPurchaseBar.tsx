import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import EmbeddedCheckoutModal from "@/components/campus/EmbeddedCheckoutModal";

const COURSE_SLUG_MAP: Record<string, string> = {
  "intermediate-accounting-2": "44444444-4444-4444-4444-444444444444",
  "intermediate-accounting-1": "33333333-3333-3333-3333-333333333333",
  "intro-accounting-1": "11111111-1111-1111-1111-111111111111",
  "intro-accounting-2": "22222222-2222-2222-2222-222222222222",
};

interface PreviewPurchaseBarProps {
  priceCents: number;
  campusSlug: string;
  courseSlug: string;
  email?: string;
}

export default function PreviewPurchaseBar({
  priceCents,
  campusSlug,
  courseSlug,
  email,
}: PreviewPurchaseBarProps) {
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleGetAccess = async () => {
    setLoading(true);
    try {
      const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
      const studentEmail = email || sessionStorage.getItem("student_email") || "";

      if (!studentEmail) {
        window.location.href = "/#courses";
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          email: studentEmail,
          campus_slug: campusSlug,
          course_id: courseId,
          course_slug: courseSlug,
          product_type: "semester_pass",
          return_url: window.location.origin,
          ui_mode: "embedded",
          is_test_mode: sessionStorage.getItem("sa_test_mode") === "true",
          email_override: sessionStorage.getItem("sa_email_override") || "",
        },
      });

      if (error) throw error;

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setModalOpen(true);
      } else if (data?.url) {
        // Fallback to redirect if embedded not supported
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Couldn't start checkout. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const priceDisplay = `$${Math.round(priceCents / 100)}`;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-6 flex items-center justify-between"
        style={{
          background: "#14213D",
          height: "76px",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        }}
      >
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-sm text-white/40 line-through">$250</p>
              <p className="text-2xl font-bold text-white">{priceDisplay}</p>
            </div>
            <p className="text-sm text-white/60">Finals special · Access through May 2026</p>
          </div>

          <Button
            onClick={handleGetAccess}
            disabled={loading}
            className="px-6 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "#CE1126", height: "auto" }}
          >
            {loading ? "Loading..." : `Get Full Access – ${priceDisplay}`}
          </Button>
        </div>
      </div>

      <EmbeddedCheckoutModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setClientSecret(null);
        }}
        clientSecret={clientSecret}
      />
    </>
  );
}

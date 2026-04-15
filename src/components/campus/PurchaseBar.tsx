import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmbeddedCheckoutModal from "./EmbeddedCheckoutModal";

const NAVY = "#14213D";
const RED = "#CE1126";

interface PurchaseBarProps {
  priceCents: number;
  originalPriceCents?: number;
  saleLabel?: string;
  campusId: string | null;
  campusSlug?: string;
  courseId: string;
  courseSlug?: string;
  studentEmail?: string;
}

export default function PurchaseBar({ priceCents, originalPriceCents, saleLabel, campusId, campusSlug, courseId, courseSlug, studentEmail }: PurchaseBarProps) {
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const priceDisplay = `$${Math.round(priceCents / 100)}`;
  const originalDisplay = originalPriceCents ? `$${Math.round(originalPriceCents / 100)}` : null;

  const email = studentEmail || sessionStorage.getItem("student_email") || "";

  const handleClick = async () => {
    if (!email) {
      toast.error("No email found. Please go back and enter your email.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          email,
          campus_id: campusId,
          campus_slug: campusSlug || "",
          course_id: courseId,
          course_slug: courseSlug || "",
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
        setShowCheckout(true);
      } else {
        throw new Error("No client secret returned");
      }
    } catch {
      toast.error("Couldn't start checkout. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ background: "#fff", borderColor: "#E5E7EB" }}
      >
        <div className="max-w-[780px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold" style={{ color: NAVY }}>{priceDisplay}</span>
              {originalDisplay && (
                <span className="text-[14px] line-through" style={{ color: "#9CA3AF" }}>{originalDisplay}</span>
              )}
            </div>
            {saleLabel && (
              <p className="text-[11px] font-medium" style={{ color: RED }}>{saleLabel}</p>
            )}
          </div>
          <button
            onClick={handleClick}
            disabled={loading}
            className="rounded-lg px-6 py-2.5 text-[14px] font-semibold text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 shrink-0"
            style={{ background: RED }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Get Full Access – ${priceDisplay}`}
          </button>
        </div>
      </div>

      <EmbeddedCheckoutModal
        open={showCheckout}
        onOpenChange={(open) => {
          setShowCheckout(open);
          if (!open) setClientSecret(null);
        }}
        clientSecret={clientSecret}
      />
    </>
  );
}

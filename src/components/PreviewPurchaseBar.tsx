import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

  const handleGetAccess = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          campusSlug,
          courseSlug,
          productType: "semester_pass",
          email: email || "",
          is_test_mode: sessionStorage.getItem("sa_test_mode") === "true",
          email_override: sessionStorage.getItem("sa_email_override") || "",
        },
      });

      if (error) throw error;

      if (data?.url) {
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
  );
}

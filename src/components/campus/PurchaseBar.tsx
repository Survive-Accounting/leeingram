import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

interface PurchaseBarProps {
  priceCents: number;
  originalPriceCents?: number;
  saleLabel?: string;
  campusId: string | null;
  courseId: string;
}

export default function PurchaseBar({ priceCents, originalPriceCents, saleLabel, campusId, courseId }: PurchaseBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const priceDisplay = `$${Math.round(priceCents / 100)}`;
  const originalDisplay = originalPriceCents ? `$${Math.round(originalPriceCents / 100)}` : null;

  const storedEmail = typeof window !== "undefined" ? sessionStorage.getItem("student_email") : null;

  const handlePurchase = async (purchaseEmail: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          email: purchaseEmail,
          campus_id: campusId,
          course_id: courseId,
          product_type: "semester_pass",
          return_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Couldn't start checkout. Try again.");
      }
    } catch {
      toast.error("Couldn't start checkout. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (storedEmail) {
      handlePurchase(storedEmail);
    } else {
      setShowModal(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    sessionStorage.setItem("student_email", trimmed);
    setShowModal(false);
    handlePurchase(trimmed);
  };

  return (
    <>
      {/* Fixed bottom bar */}
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

      {/* Quick email modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm p-6 [&>button]:hidden" style={{ borderRadius: 16 }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>Enter your email</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@university.edu"
              required
              className="w-full rounded-lg px-4 text-[15px] outline-none transition-all focus:ring-2"
              style={{ minHeight: 48, background: "#F8F9FA", border: "1px solid #E5E7EB", color: NAVY }}
            />
            <button
              type="submit"
              className="w-full rounded-lg text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
              style={{ minHeight: 48, background: RED }}
            >
              Continue to Checkout →
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

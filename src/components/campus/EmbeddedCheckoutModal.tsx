import { useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { Check } from "lucide-react";

const STRIPE_PK = "pk_test_51TM9RCHyiFzd8XWggqI14jVV69b6HvGUcXqXYAGg3wyRP3RxjZeD97lLxQVl9uTCyWG8JirXbdLemCkOloJhgOnu00lyllwa8U";
const stripePromise = loadStripe(STRIPE_PK);

const NAVY = "#14213D";

const INCLUDED = [
  "Chapters 13–22",
  "Step-by-step explanations",
  "Practice problems and previews",
  "Built from real tutoring sessions",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  courseName?: string;
  priceDisplay?: string;
}

export default function EmbeddedCheckoutModal({ open, onOpenChange, clientSecret, courseName, priceDisplay }: Props) {
  const fetchClientSecret = useCallback(() => {
    return Promise.resolve(clientSecret!);
  }, [clientSecret]);

  if (!clientSecret) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden [&>button]:hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
        style={{ borderRadius: 20, maxHeight: "90vh", boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        <div className="flex flex-col sm:flex-row" style={{ maxHeight: "85vh" }}>
          {/* Left — Value summary */}
          <div
            className="sm:w-[280px] shrink-0 p-6 flex flex-col gap-5 overflow-y-auto"
            style={{ background: "#FAFAFA", borderRight: "1px solid #F0F0F0" }}
          >
            {/* Lee avatar + course */}
            <div className="flex items-center gap-3">
              <img
                src="https://i.ibb.co/9HhgJrS/Lee-Ingram-Headshot.jpg"
                alt="Lee Ingram"
                className="w-9 h-9 rounded-full object-cover shrink-0"
                style={{ border: "2px solid #E5E7EB" }}
              />
              <div>
                <h2 className="text-[16px] font-semibold leading-tight" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
                  {courseName || "Intermediate Accounting 2"}
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                  Full access to all chapters and study tools
                </p>
              </div>
            </div>

            {/* Included list */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
                What's included
              </p>
              {INCLUDED.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#22C55E" }} />
                  <span className="text-[13px] leading-snug" style={{ color: NAVY }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Price */}
            <div className="pt-1">
              <p className="text-[24px] font-bold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
                {priceDisplay || "$250"}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                One-time payment. No subscription.
              </p>
            </div>

            {/* Value anchor */}
            <div
              className="rounded-lg px-3 py-2.5"
              style={{ background: "#EFF6FF", border: "1px solid #DBEAFE" }}
            >
              <p className="text-[13px] font-medium leading-snug" style={{ color: "#1E40AF" }}>
                Less than 2 hours of private tutoring — for the full course.
              </p>
            </div>

            {/* Personal line */}
            <p className="text-[12px] italic leading-relaxed" style={{ color: "#9CA3AF" }}>
              "I built this to make real accounting help more accessible than traditional tutoring."
            </p>

            {/* Trust */}
            <p className="text-[11px] flex items-center gap-1.5 mt-auto" style={{ color: "#9CA3AF" }}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Secure checkout powered by Stripe
            </p>
          </div>

          {/* Right — Stripe embed */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 400 }}>
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 text-center" style={{ borderTop: "1px solid #F0F0F0", background: "#FAFAFA" }}>
          <p className="text-[12px]" style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>
            Questions? I'm always happy to help — <a href="mailto:lee@surviveaccounting.com" className="underline hover:no-underline" style={{ color: "#6B7280" }}>reach out anytime</a>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const STRIPE_PK = "pk_test_51TM9RCHyiFzd8XWggqI14jVV69b6HvGUcXqXYAGg3wyRP3RxjZeD97lLxQVl9uTCyWG8JirXbdLemCkOloJhgOnu00lyllwa8U";
const stripePromise = loadStripe(STRIPE_PK);

const NAVY = "#14213D";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  courseName?: string;
}

export default function EmbeddedCheckoutModal({ open, onOpenChange, clientSecret, courseName }: Props) {
  const fetchClientSecret = useCallback(() => {
    return Promise.resolve(clientSecret!);
  }, [clientSecret]);

  if (!clientSecret) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden [&>button]:hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
        style={{ borderRadius: 20, maxHeight: "90vh", boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #F0F0F0" }}>
          <div className="flex items-center gap-3">
            <img
              src="https://i.ibb.co/9HhgJrS/Lee-Ingram-Headshot.jpg"
              alt="Lee Ingram"
              className="w-9 h-9 rounded-full object-cover shrink-0"
              style={{ border: "2px solid #E5E7EB" }}
            />
            <div>
              <h2 className="text-[17px] font-semibold leading-tight" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
                {courseName || "Intermediate Accounting 2"}
              </h2>
              <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                Full access to all chapters and study tools
              </p>
            </div>
          </div>
          <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: "#9CA3AF" }}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secure checkout powered by Stripe
          </p>
        </div>

        {/* Stripe embed */}
        <div className="overflow-y-auto" style={{ maxHeight: "60vh", minHeight: 300 }}>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
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

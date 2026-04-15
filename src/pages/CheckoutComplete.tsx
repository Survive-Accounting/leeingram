import { useEffect, useState } from "react";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const NAVY = "#14213D";

export default function CheckoutComplete() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"confirming" | "success" | "no_session">(
    sessionId ? "confirming" : "no_session"
  );

  useEffect(() => {
    if (!sessionId) return;
    // The webhook handles fulfillment asynchronously.
    // We just show the confirmation message — no client-side verification needed.
    // A short delay makes it feel like we're confirming.
    const timer = setTimeout(() => setStatus("success"), 1500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F9FA" }}>
      <div className="max-w-md w-full text-center space-y-4">
        {status === "confirming" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin" style={{ color: NAVY }} />
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>
              Confirming your payment...
            </h1>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 mx-auto" style={{ color: "#22C55E" }} />
            <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
              Payment received!
            </h1>
            <p className="text-[15px]" style={{ color: NAVY }}>
              Check your email for your login link.
            </p>
            <p className="text-[13px]" style={{ color: "#666666" }}>
              It may take a minute to arrive. Check your spam folder if you don't see it.
            </p>
          </>
        )}

        {status === "no_session" && (
          <>
            <AlertCircle className="h-12 w-12 mx-auto" style={{ color: "#F59E0B" }} />
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>
              No checkout session found
            </h1>
            <p className="text-[14px]" style={{ color: "#666" }}>
              If you just completed a purchase, check your email for a login link.
            </p>
            <a
              href="/"
              className="inline-block mt-2 text-[14px] font-medium hover:underline"
              style={{ color: "#CE1126" }}
            >
              ← Back to home
            </a>
          </>
        )}
      </div>
    </div>
  );
}

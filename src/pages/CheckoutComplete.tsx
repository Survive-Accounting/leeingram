import { useEffect, useState } from "react";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteNavbar from "@/components/landing/SiteNavbar";

const NAVY = "#14213D";

const COURSE_DISPLAY: Record<string, string> = {
  "intermediate-accounting-2": "Intermediate Accounting 2",
  "intermediate-accounting-1": "Intermediate Accounting 1",
  "intro-accounting-1": "Introductory Accounting 1",
  "intro-accounting-2": "Introductory Accounting 2",
};

export default function CheckoutComplete() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const campusSlug = searchParams.get("campus");
  const courseSlug = searchParams.get("course");

  const [status, setStatus] = useState<"confirming" | "success" | "no_session">(
    sessionId ? "confirming" : "no_session"
  );
  const [campusName, setCampusName] = useState<string | null>(null);

  const courseName = courseSlug ? (COURSE_DISPLAY[courseSlug] || courseSlug) : null;

  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => setStatus("success"), 1500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  useEffect(() => {
    if (!campusSlug) return;
    supabase
      .from("campuses")
      .select("name")
      .eq("slug", campusSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setCampusName(data.name);
      });
  }, [campusSlug]);

  const contextLine = [campusName, courseName].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F9FA" }}>
      <SiteNavbar />
      <div className="flex-1 flex items-center justify-center px-4">
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
              {contextLine && (
                <p className="text-[14px] font-medium" style={{ color: "#6B7280" }}>
                  {contextLine}
                </p>
              )}
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
    </div>
  );
}

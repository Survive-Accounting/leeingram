import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          navigate("/login?message=invalid_link", { replace: true });
          return;
        }

        const email = session.user.email;
        if (!email) {
          navigate("/login?message=invalid_link", { replace: true });
          return;
        }

        // Check for an active purchase
        const { data: purchases } = await supabase
          .from("student_purchases")
          .select("id")
          .eq("email", email.toLowerCase())
          .limit(1);

        if (purchases && purchases.length > 0) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/login?message=no_purchase", { replace: true });
        }
      } catch {
        setStatus("error");
      }
    };

    handleCallback();
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F9FA" }}>
        <div className="text-center space-y-3">
          <p className="text-[15px] font-medium" style={{ color: "#14213D" }}>
            Something went wrong verifying your login.
          </p>
          <a
            href="/login"
            className="text-[14px] font-medium hover:underline"
            style={{ color: "#CE1126" }}
          >
            Try again →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FA" }}>
      <div className="flex items-center gap-2" style={{ color: "#666" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-[14px]">Verifying your login...</span>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { getStoredFingerprint, getDeviceName } from "@/hooks/useDeviceFingerprint";

const registerDevice = async (studentId: string, email: string) => {
  try {
    const fingerprint = getStoredFingerprint();
    const deviceName = getDeviceName();

    const { data: existing } = await (supabase as any)
      .from("student_devices")
      .select("id, login_count")
      .eq("student_id", studentId)
      .eq("device_fingerprint", fingerprint)
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from("student_devices")
        .update({
          last_login_at: new Date().toISOString(),
          login_count: (existing.login_count || 1) + 1,
          is_active: true,
        })
        .eq("id", existing.id);
    } else {
      await (supabase as any)
        .from("student_devices")
        .insert({
          student_id: studentId,
          email,
          device_fingerprint: fingerprint,
          device_name: deviceName,
        });

      // Check device count — flag if 5+
      const { count } = await (supabase as any)
        .from("student_devices")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("is_active", true);

      if (count && count >= 5) {
        await (supabase as any)
          .from("student_devices")
          .update({
            is_flagged: true,
            flag_reason: "Device limit reached (5+ devices)",
          })
          .eq("student_id", studentId)
          .eq("device_fingerprint", fingerprint);
      }
    }
  } catch (err) {
    console.error("Device registration error:", err);
  }
};

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

        // Register device in background (non-blocking)
        const { data: student } = await supabase
          .from("students")
          .select("id")
          .eq("email", email.toLowerCase())
          .maybeSingle();

        if (student) {
          registerDevice(student.id, email.toLowerCase());
        }

        if (purchases && purchases.length > 0) {
          navigate("/my-dashboard", { replace: true });
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

import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";

export default function LegacyWelcomeCard({
  userId,
  firstName,
  onDismiss,
}: {
  userId: string;
  firstName: string;
  onDismiss: () => void;
}) {
  const dismiss = async () => {
    onDismiss();
    try {
      await supabase
        .from("student_onboarding")
        .update({ welcomed_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch {
      // ignore
    }
  };

  return (
    <section
      className="relative rounded-2xl p-5 sm:p-6"
      style={{
        background: "#fff",
        border: "1px solid #E0E7F0",
        boxShadow: "0 8px 24px rgba(20,33,61,0.06)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-slate-100 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" style={{ color: "#94A3B8" }} />
      </button>

      <p
        className="text-[10.5px] uppercase tracking-widest font-semibold"
        style={{ color: "#94A3B8" }}
      >
        Welcome back to the new app
      </p>
      <h2
        className="mt-1.5 text-[22px] leading-tight"
        style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
      >
        {firstName ? `Good to see you, ${firstName}.` : "Good to see you."}
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "#64748B" }}>
        Your course access carried over. Everything you bought before still works — and the
        new beta tools below are available to you too.
      </p>
    </section>
  );
}

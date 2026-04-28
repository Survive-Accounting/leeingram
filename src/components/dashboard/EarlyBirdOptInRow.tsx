import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RED = "#CE1126";

interface Props {
  userId: string;
  /** Hide self after success so the row disappears immediately. */
  onOptedIn?: () => void;
}

export default function EarlyBirdOptInRow({ userId, onOptedIn }: Props) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (next: boolean) => {
    if (!next || saving) return;
    setChecked(true);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("student_onboarding")
        .update({ early_bird_opt_in: true })
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("You're on the early-bird list ✓");
      // Brief delay so the user sees the check before it disappears.
      setTimeout(() => onOptedIn?.(), 600);
    } catch (err) {
      console.error("[EarlyBirdOptInRow] update failed", err);
      toast.error("Couldn't save that. Try again?");
      setChecked(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <label
      className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none group"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <span
        className="relative h-4 w-4 rounded border flex items-center justify-center transition-all"
        style={{
          background: checked ? RED : "#fff",
          borderColor: checked ? RED : "#CBD5E1",
        }}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        <input
          type="checkbox"
          className="absolute inset-0 opacity-0 cursor-pointer"
          checked={checked}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={saving}
        />
      </span>
      <span
        className="text-[13px] group-hover:underline"
        style={{ color: "#475569" }}
      >
        Send me early-bird discounts for Summer/Fall &rsquo;26 access
      </span>
    </label>
  );
}

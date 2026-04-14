import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LEE_HEADSHOT_URL = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";

const FALLBACK_BIO = `I loved accounting so much in college that I became a full-time tutor. During the pandemic I went fully virtual and created SurviveAccounting.com — and it's been a blast watching it grow.

Now I travel the world while helping college students actually understand — and even love — accounting. Not just survive it.

I will help you ace exams, but also I hope you discover something I think is more important: thinking like an accountant is an incredibly valuable skill. Both now and for your career. I'm going to help you learn it. Once you think like an accountant, your exam will feel way less brutal.

Best of luck studying!
— Lee

PS: A huge thanks to all the students who've enjoyed and supported my work over the years, so much so that I can work full-time on growing Survive Accounting. As a lifelong teacher, it means a lot.`;

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AboutLeeModal({ open, onOpenChange }: AboutLeeModalProps) {
  const [bio, setBio] = useState(FALLBACK_BIO);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Check admin status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setIsAdmin(true);
    });
  }, []);

  // Fetch bio from site_content
  useEffect(() => {
    if (!open) return;
    (supabase as any)
      .from("site_content")
      .select("value")
      .eq("key", "about_lee_bio")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) setBio(data.value);
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("site_content")
        .update({ value: editValue, updated_at: new Date().toISOString() })
        .eq("key", "about_lee_bio");
      if (error) throw error;
      setBio(editValue);
      setEditing(false);
      toast.success("Bio updated ✓");
    } catch {
      toast.error("Failed to save — try again");
    } finally {
      setSaving(false);
    }
  };

  // Split bio into paragraphs for rendering
  const renderBio = (text: string) => {
    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map((p, i) => {
      // Check if it's the PS line
      const isPS = p.trim().startsWith("PS:");
      // Check if it's the sign-off
      const isSignoff = p.trim() === "— Lee" || p.trim().startsWith("— Lee");
      // Check for "Best of luck" + "— Lee" on separate lines
      const lines = p.split("\n");

      return (
        <p
          key={i}
          className={`text-[13px] leading-[1.7] ${isPS ? "italic" : ""}`}
          style={{
            color: isPS ? "#64748B" : "#1A1A1A",
            fontSize: isPS ? 11 : 13,
            marginBottom: i < paragraphs.length - 1 ? 16 : 0,
          }}
        >
          {lines.map((line, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {line.includes("thinking like an accountant") ? (
                <>
                  {line.split("thinking like an accountant")[0]}
                  <em>thinking like an accountant</em>
                  {line.split("thinking like an accountant")[1]}
                </>
              ) : (
                line
              )}
            </span>
          ))}
        </p>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-6 sm:p-8"
        style={{ borderRadius: 16 }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio and contact info</DialogDescription>
        </DialogHeader>

        {/* TOP: 2-column grid */}
        <div className="grid grid-cols-[1fr_200px] gap-5 sm:gap-6">
          {/* TOP LEFT */}
          <div className="flex flex-col justify-center min-w-0">
            <p className="text-[22px] font-extrabold" style={{ color: "#14213D" }}>
              Lee Ingram
            </p>
            <p className="text-[11px] mt-1.5 leading-[1.5]" style={{ color: "#94A3B8" }}>
              B.A. &amp; M.Acc. in Accounting · University of Mississippi · 3.75 GPA
            </p>
            <p
              className="text-[10px] mt-3 font-semibold uppercase"
              style={{ color: "#CE1126", letterSpacing: "0.1em" }}
            >
              About Me
            </p>
            <div className="mt-2 h-px" style={{ background: "#CE1126", opacity: 0.3 }} />
          </div>

          {/* TOP RIGHT */}
          <img
            src={LEE_HEADSHOT_URL}
            alt="Lee Ingram"
            className="w-[200px] h-[200px] shrink-0 object-cover rounded-lg"
            style={{ objectPosition: "center" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* BOTTOM: full width bio */}
        <div className="mt-4">
          {editing ? (
            <>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={14}
                className="w-full outline-none text-[13px] leading-[1.7] p-3"
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  resize: "vertical",
                  color: "#1A1A1A",
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-[12px] font-semibold px-4 py-2 rounded-md text-white"
                  style={{ background: "#14213D", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-[12px] font-semibold px-4 py-2 rounded-md"
                  style={{ color: "#64748B", border: "1px solid #E2E8F0" }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {renderBio(bio)}

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditValue(bio);
                    setEditing(true);
                  }}
                  className="text-[11px] mt-3 hover:underline"
                  style={{ color: "#3B82F6" }}
                >
                  Edit Bio ✏
                </button>
              )}
            </>
          )}
        </div>

        {/* Links */}
        <div className="mt-3 flex flex-col gap-1.5 text-[12px]">
          <a
            href="mailto:lee@surviveaccounting.com"
            className="flex items-center gap-1.5 hover:underline"
            style={{ color: "#3B82F6" }}
          >
            ✉ lee@surviveaccounting.com
          </a>
          <a
            href="https://app.squareup.com/appointments/book/30fvidwxlwh9vt/LY1BCZ6Q74JRF/start"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:underline font-semibold"
            style={{ color: "#3B82F6" }}
          >
            📅 Book 1-on-1 Tutoring →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

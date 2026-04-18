import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface StagingEmailPromptModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void | Promise<void>;
  courseName?: string;
  loading?: boolean;
}

export default function StagingEmailPromptModal({
  open,
  onClose,
  onSubmit,
  courseName,
  loading = false,
}: StagingEmailPromptModalProps) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open) setEmail("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-sm p-6 [&>button]:hidden"
        style={{ borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition"
        >
          <X className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2
              className="text-[18px] font-semibold"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              Enter your school email
            </h2>
            {courseName && (
              <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
                Takes you straight to {courseName} study tools.
              </p>
            )}
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@university.edu"
            required
            disabled={loading}
            autoFocus
            className="w-full rounded-lg px-4 text-[15px] outline-none focus:ring-2"
            style={{
              minHeight: 48,
              background: "#F8F9FA",
              border: "1px solid #E5E7EB",
              color: NAVY,
              fontFamily: "Inter, sans-serif",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

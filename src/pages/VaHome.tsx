import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, GripVertical } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

const FUNCTIONAL_AREAS = [
  "Project Management & Workflow Ops",
  "No-Code Web Development",
  "UI/UX Design & Strategy",
  "Online Course Design & Pedagogy",
  "Greek Org Outreach & Sales",
  "University Marketing & Partnerships",
  "User Research & Feedback Loop",
  "Video Production Pipeline",
  "Teaching & Curriculum Asset Pipeline",
  "SEO & Content Strategy",
  "Social Media & Brand Voice",
  "Customer Support & Success Systems",
  "Bookkeeping & Financials",
];

const CURRENT_VIDEO_ID = "dQw4w9WgXcQ"; // placeholder — replace with real video ID

const PAST_UPDATES = [
  { title: "Welcome & Vision Overview", videoId: "dQw4w9WgXcQ", date: "April 2026" },
];

export default function VaHome() {
  const { session } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [background, setBackground] = useState("");
  const [outsideInterest, setOutsideInterest] = useState("");
  const [rankings, setRankings] = useState<Record<string, number | null>>(
    Object.fromEntries(FUNCTIONAL_AREAS.map((a) => [a, null]))
  );
  const [focusArea, setFocusArea] = useState("");
  const [unlistedSkills, setUnlistedSkills] = useState("");

  const selectedRanks = Object.values(rankings).filter((v) => v !== null) as number[];

  const handleRankChange = (area: string, rank: number | null) => {
    setRankings((prev) => ({ ...prev, [area]: rank }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      toast.error("You must be logged in.");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    const rankedItems = FUNCTIONAL_AREAS
      .filter((a) => rankings[a] !== null)
      .sort((a, b) => (rankings[a] ?? 99) - (rankings[b] ?? 99))
      .map((a) => ({ area: a, rank: rankings[a] }));

    if (rankedItems.length < 5) {
      toast.error("Please rank at least your Top 5 areas.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("va_survey_responses" as any).insert({
      user_id: session.user.id,
      name: name.trim(),
      location: location.trim() || null,
      background: background.trim() || null,
      outside_interest: outsideInterest.trim() || null,
      ranked_interests: rankedItems,
      focus_area_answer: focusArea.trim() || null,
      unlisted_skills: unlistedSkills.trim() || null,
    } as any);
    setLoading(false);

    if (error) {
      toast.error("Something went wrong — try again.");
      console.error(error);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="w-full py-16 px-6 text-center" style={{ background: NAVY }}>
        <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
          Survive Accounting
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Welcome to the Team Room.
        </h1>
        <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.7)" }}>
          This is our home base. I'm excited to move us toward more engaging, meaningful work together.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        {/* ── Video Section ────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-sm font-medium" style={{ color: NAVY }}>
            📽️ Current Vision & Status Update — watch this first
          </p>
          <div className="aspect-video rounded-xl overflow-hidden shadow-md border" style={{ borderColor: "#E5E2DD" }}>
            <iframe
              src={`https://www.youtube.com/embed/${CURRENT_VIDEO_ID}`}
              title="Status Update"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            I'll keep posting updates here so you always know where we're headed.
          </p>
        </section>

        {/* ── Survey Form ──────────────────────────────────── */}
        <Card className="p-8 md:p-10 border-2 shadow-sm" style={{ borderColor: "#E5E2DD", background: "#FFFFFF" }}>
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: "#22C55E" }} />
              <h2 className="text-xl font-semibold" style={{ color: NAVY }}>
                Got it — appreciate you taking the time.
              </h2>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Looking forward to our first call.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Title */}
              <div className="text-center space-y-2">
                <p className="text-xs tracking-[0.15em] uppercase" style={{ color: RED }}>
                  Survive Accounting
                </p>
                <h2 className="text-xl md:text-2xl font-bold" style={{ color: NAVY }}>
                  Passion & Skills Survey
                </h2>
                <p className="text-sm max-w-md mx-auto" style={{ color: "#6B7280" }}>
                  Before we meet, I want to get to know you a bit.
                  I care more about what you actually enjoy doing than just assigning tasks.
                  Be honest — this helps me align your strengths with where we're going.
                </p>
              </div>

              {/* Section A */}
              <div className="space-y-5">
                <SectionLabel label="A" title="Quick Intro" />

                <Field label="Name" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-[#FAFAF8]" />
                </Field>
                <Field label="Location (City / Country)">
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Manila, Philippines" className="bg-[#FAFAF8]" />
                </Field>
                <Field label="What have you done that you're most proud of?">
                  <Textarea value={background} onChange={(e) => setBackground(e.target.value)} rows={3} placeholder="Doesn't have to be work-related." className="bg-[#FAFAF8]" />
                </Field>
                <Field label="One thing you enjoy outside of work">
                  <Input value={outsideInterest} onChange={(e) => setOutsideInterest(e.target.value)} placeholder="e.g. cooking, hiking, gaming…" className="bg-[#FAFAF8]" />
                </Field>
              </div>

              {/* Section B */}
              <div className="space-y-5">
                <SectionLabel label="B" title="Rank Your Interests" />
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  Rank your <strong>Top 5</strong> areas below (1 = most interested). Leave the rest blank.
                </p>

                <div className="space-y-2">
                  {FUNCTIONAL_AREAS.map((area) => (
                    <div
                      key={area}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors"
                      style={{
                        borderColor: rankings[area] ? NAVY : "#E5E2DD",
                        background: rankings[area] ? "rgba(20,33,61,0.03)" : "#FAFAF8",
                      }}
                    >
                      <GripVertical className="h-4 w-4 shrink-0" style={{ color: "#CBD5E1" }} />
                      <span className="flex-1 text-sm" style={{ color: NAVY }}>
                        {area}
                      </span>
                      <select
                        value={rankings[area] ?? ""}
                        onChange={(e) => handleRankChange(area, e.target.value ? Number(e.target.value) : null)}
                        className="w-16 h-8 rounded-md border text-center text-sm appearance-none cursor-pointer"
                        style={{
                          borderColor: "#D1D5DB",
                          color: rankings[area] ? NAVY : "#9CA3AF",
                          background: "#FFFFFF",
                        }}
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option
                            key={n}
                            value={n}
                            disabled={selectedRanks.includes(n) && rankings[area] !== n}
                          >
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section C */}
              <div className="space-y-5">
                <SectionLabel label="C" title="Quick Thinking" />
                <Field label="If you could only work on ONE area for the next 3 months, what would it be and why?">
                  <Textarea value={focusArea} onChange={(e) => setFocusArea(e.target.value)} rows={3} className="bg-[#FAFAF8]" />
                </Field>
                <Field label="Any skills not listed that you think we should be using?">
                  <Textarea value={unlistedSkills} onChange={(e) => setUnlistedSkills(e.target.value)} rows={2} className="bg-[#FAFAF8]" />
                </Field>
              </div>

              {/* Founder note */}
              <div className="rounded-lg p-5 text-sm leading-relaxed" style={{ background: "#F5F3EF", color: "#4B5563" }}>
                <em>
                  "I'll be ranking these same areas myself after this.
                  Then I'll combine your input with the vision and current priorities — and report back with how we're structuring things."
                </em>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-px hover:shadow-lg"
                style={{ background: NAVY, color: "#FFFFFF" }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                  </span>
                ) : (
                  "Submit Survey"
                )}
              </Button>
            </form>
          )}
        </Card>

        {/* ── Past Updates ─────────────────────────────────── */}
        <section className="space-y-4 pb-16">
          <h3 className="text-lg font-semibold" style={{ color: NAVY }}>
            Past Updates
          </h3>
          <div className="space-y-4">
            {PAST_UPDATES.map((update, i) => (
              <div key={i} className="rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: "#E5E2DD" }}>
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${update.videoId}`}
                    title={update.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#FFFFFF" }}>
                  <span className="text-sm font-medium" style={{ color: NAVY }}>{update.title}</span>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{update.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────── */

function SectionLabel({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
        style={{ background: RED }}
      >
        {label}
      </span>
      <h3 className="text-base font-semibold" style={{ color: NAVY }}>
        {title}
      </h3>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium" style={{ color: NAVY }}>
        {label}
        {required && <span style={{ color: RED }}> *</span>}
      </span>
      {children}
    </label>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ChevronDown, GripVertical, Video, FileText, ClipboardList, StickyNote, HelpCircle, Plus, X, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

const CURRENT_VIDEO_ID = "";

/* ── Sortable Item ─────────────────────────────────── */
function SortableItem({ id, index }: { id: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg px-4 py-3 border bg-white select-none transition-shadow"
      {...attributes}
    >
      <span
        className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold text-white shrink-0"
        style={{ background: index < 5 ? NAVY : "#CBD5E1" }}
      >
        {index + 1}
      </span>
      <button {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical className="h-4 w-4" style={{ color: "#94A3B8" }} />
      </button>
      <span className="flex-1 text-sm" style={{ color: NAVY }}>{id}</span>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export default function VaHome() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      {/* Hero Image */}
      <div className="relative w-full h-48 md:h-64 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80"
          alt="Mountain landscape"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(20,33,61,0.3), rgba(20,33,61,0.7))" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wide" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Meeting Room
          </h1>
        </div>
      </div>

      {/* Callout Box */}
      <div className="max-w-2xl mx-auto -mt-8 relative z-10 px-4">
        <div className="bg-white rounded-xl shadow-md border px-8 py-7 text-center" style={{ borderColor: "#E8E4DF" }}>
          <p className="text-[11px] tracking-[0.18em] uppercase mb-2" style={{ color: RED }}>
            Survive Accounting — Team Hub
          </p>
          <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#4B5563" }}>
            I'm excited to build this together and create something that genuinely helps students succeed in accounting.
          </p>
          <p className="text-sm leading-relaxed max-w-md mx-auto mt-2" style={{ color: "#6B7280" }}>
            This page is our home base — everything you need for each meeting is here.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        {/* Meeting #1 */}
        <MeetingToggle
          number={1}
          title="Welcome & Vision Overview"
          date="April 2026"
          items={[
            { icon: <Video className="w-4 h-4" />, label: "Watch Intro →", content: <VideoEmbed videoId={CURRENT_VIDEO_ID} /> },
            { icon: <FileText className="w-4 h-4" />, label: "Fill Out Form →", content: <SurveyForm session={session} /> },
            {
              icon: <ClipboardList className="w-4 h-4" />,
              label: "Meeting Agenda",
              content: (
                <div className="text-sm space-y-2 py-2" style={{ color: "#4B5563" }}>
                  <p className="font-medium" style={{ color: NAVY }}>Agenda</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Casual update on progress</li>
                    <li>Get to know each other</li>
                    <li>Review survey responses</li>
                    <li>Discuss priorities & next steps</li>
                  </ul>
                </div>
              ),
            },
            { icon: <StickyNote className="w-4 h-4" />, label: "Meeting Minutes", content: <MeetingMinutes meetingNumber={1} /> },
            { icon: <HelpCircle className="w-4 h-4" />, label: "Questions for Lee", content: <QuestionsForLee meetingNumber={1} /> },
            { icon: <Lock className="w-4 h-4" />, label: "Responses 🔒", content: <ResponsesViewer /> },
          ]}
        />
      </div>
    </div>
  );
}

/* ── Meeting Toggle ────────────────────────────────── */
interface MeetingItem {
  icon: React.ReactNode;
  label: string;
  content: React.ReactNode;
}

function MeetingToggle({ number, title, date, items }: { number: number; title: string; date: string; items: MeetingItem[] }) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between rounded-xl px-5 py-4 border transition-colors"
          style={{ background: open ? "#FFFFFF" : "#FAFAF8", borderColor: open ? NAVY : "#E5E2DD" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white" style={{ background: RED }}>
              {number}
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>Meeting #{number}</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{title} — {date}</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "#9CA3AF" }} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-white border border-t-0 rounded-b-xl px-5 pb-5" style={{ borderColor: NAVY }}>
          {/* Tab bar */}
          <div className="flex gap-1 pt-3 pb-4 overflow-x-auto">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  background: activeTab === i ? NAVY : "transparent",
                  color: activeTab === i ? "#FFFFFF" : "#6B7280",
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div>{items[activeTab]?.content}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Video Embed ───────────────────────────────────── */
function VideoEmbed({ videoId }: { videoId: string }) {
  if (!videoId) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden border flex items-center justify-center" style={{ borderColor: "#E5E2DD", background: "#F3F4F6" }}>
        <div className="text-center space-y-2">
          <Video className="h-8 w-8 mx-auto" style={{ color: "#CBD5E1" }} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Video will appear here</p>
        </div>
      </div>
    );
  }
  return (
    <div className="aspect-video rounded-lg overflow-hidden border" style={{ borderColor: "#E5E2DD" }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="Meeting Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}

/* ── Meeting Minutes (bullet points) ───────────────── */
function MeetingMinutes({ meetingNumber }: { meetingNumber: number }) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const addBullet = () => {
    const text = draft.trim();
    if (!text) return;
    setBullets((prev) => [...prev, text]);
    setDraft("");
  };

  const removeBullet = (index: number) => {
    setBullets((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "#9CA3AF" }}>Add concise bullet-point notes during or after the meeting.</p>
      {bullets.length > 0 && (
        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm group" style={{ color: "#4B5563" }}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: NAVY }} />
              <span className="flex-1">{b}</span>
              <button onClick={() => removeBullet(i)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBullet()}
          placeholder="Type a note and press Enter…"
          className="bg-[#FAFAF8] text-sm flex-1"
        />
        <Button type="button" size="sm" variant="outline" onClick={addBullet} disabled={!draft.trim()} className="shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Questions for Lee ─────────────────────────────── */
function QuestionsForLee({ meetingNumber }: { meetingNumber: number }) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [...prev, text]);
    setDraft("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "#9CA3AF" }}>Drop any questions, ideas, or things you want to discuss with Lee.</p>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm group" style={{ color: "#4B5563" }}>
              <span className="mt-0.5 text-xs" style={{ color: RED }}>?</span>
              <span className="flex-1">{item}</span>
              <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Type a question or idea…"
          className="bg-[#FAFAF8] text-sm flex-1"
        />
        <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={!draft.trim()} className="shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Survey Form ───────────────────────────────────── */
function SurveyForm({ session }: { session: any }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [unlistedSkills, setUnlistedSkills] = useState("");
  const [orderedAreas, setOrderedAreas] = useState(FUNCTIONAL_AREAS);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedAreas((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) { toast.error("You must be logged in."); return; }
    if (!name.trim()) { toast.error("Please enter your name."); return; }

    const rankedItems = orderedAreas.map((area, i) => ({ area, rank: i + 1 }));

    setLoading(true);
    const { error } = await supabase.from("va_survey_responses" as any).insert({
      user_id: session.user.id,
      name: name.trim(),
      ranked_interests: rankedItems,
      focus_area_answer: focusArea.trim() || null,
      unlisted_skills: unlistedSkills.trim() || null,
    } as any);
    setLoading(false);

    if (error) { toast.error("Something went wrong — try again."); console.error(error); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-10 space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "#22C55E" }} />
        <p className="text-base font-semibold" style={{ color: NAVY }}>Got it — appreciate you taking the time.</p>
        <p className="text-sm" style={{ color: "#6B7280" }}>Looking forward to our first call.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>
        Before we meet, I want to get to know you a bit. Specifically, I'd love to know what type of work you enjoy most.
      </p>

      {/* Name */}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium" style={{ color: NAVY }}>Name <span style={{ color: RED }}>*</span></span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-[#FAFAF8]" />
      </label>

      {/* Drag & Drop Ranking */}
      <div className="space-y-3">
        <p className="text-sm font-medium" style={{ color: NAVY }}>
          Drag to rank — most interested at top, least at bottom
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedAreas} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {orderedAreas.map((area, index) => (
                <SortableItem key={area} id={area} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Focus Area */}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium" style={{ color: NAVY }}>
          If you could only work on ONE area for the next 3 months, what would it be and why?
        </span>
        <Textarea value={focusArea} onChange={(e) => setFocusArea(e.target.value)} rows={3} className="bg-[#FAFAF8]" />
      </label>

      {/* Unlisted Skills */}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium" style={{ color: NAVY }}>
          Any skills not listed that you think we should be using?
        </span>
        <Textarea value={unlistedSkills} onChange={(e) => setUnlistedSkills(e.target.value)} rows={2} className="bg-[#FAFAF8]" />
      </label>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-px hover:shadow-lg"
        style={{ background: NAVY, color: "#FFFFFF" }}
      >
        {loading ? (
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</span>
        ) : (
          "Submit Survey"
        )}
      </Button>
    </form>
  );
}

/* ── Password-Protected Responses Viewer ──────────── */
const RESPONSES_PW = "SurviveAdmin123!";

function ResponsesViewer() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUnlock = () => {
    if (pw === RESPONSES_PW) {
      setUnlocked(true);
      loadResponses();
    } else {
      toast.error("Incorrect password.");
    }
  };

  const loadResponses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("va_survey_responses" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { console.error(error); return; }
    setResponses(data || []);
  };

  if (!unlocked) {
    return (
      <div className="text-center py-8 space-y-4">
        <Lock className="h-8 w-8 mx-auto" style={{ color: "#CBD5E1" }} />
        <p className="text-sm" style={{ color: "#6B7280" }}>Enter password to view responses</p>
        <div className="flex gap-2 max-w-xs mx-auto">
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="Password"
            className="bg-[#FAFAF8] text-sm"
          />
          <Button size="sm" onClick={handleUnlock} style={{ background: NAVY }}>
            Unlock
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "#9CA3AF" }} />
      </div>
    );
  }

  if (responses.length === 0) {
    return <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>No responses yet.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-xs" style={{ color: "#9CA3AF" }}>{responses.length} response{responses.length !== 1 ? "s" : ""}</p>
      {responses.map((r: any, i: number) => (
        <div key={r.id || i} className="border rounded-lg p-4 space-y-3" style={{ borderColor: "#E5E2DD" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>{r.name}</p>
            <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>

          {r.ranked_interests && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Interest Ranking</p>
              <ol className="text-xs space-y-0.5 pl-4" style={{ color: "#4B5563" }}>
                {(r.ranked_interests as any[]).slice(0, 5).map((item: any, j: number) => (
                  <li key={j} className="list-decimal">{item.area}</li>
                ))}
              </ol>
              {(r.ranked_interests as any[]).length > 5 && (
                <p className="text-[11px] mt-1 pl-4" style={{ color: "#9CA3AF" }}>
                  + {(r.ranked_interests as any[]).length - 5} more
                </p>
              )}
            </div>
          )}

          {r.focus_area_answer && (
            <div>
              <p className="text-xs font-medium" style={{ color: "#6B7280" }}>If only ONE area for 3 months</p>
              <p className="text-sm" style={{ color: "#4B5563" }}>{r.focus_area_answer}</p>
            </div>
          )}

          {r.unlisted_skills && (
            <div>
              <p className="text-xs font-medium" style={{ color: "#6B7280" }}>Unlisted skills</p>
              <p className="text-sm" style={{ color: "#4B5563" }}>{r.unlisted_skills}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

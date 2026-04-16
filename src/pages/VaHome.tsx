import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ChevronDown, GripVertical, Video, FileText, ClipboardList, StickyNote } from "lucide-react";
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
      {/* Header */}
      <header className="w-full py-14 px-6 text-center" style={{ background: NAVY }}>
        <p className="text-[11px] tracking-[0.2em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          Survive Accounting
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Meeting Room
        </h1>
        <p className="text-sm md:text-base max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
          I'm excited to grow Survive Accounting together to help students at universities all over the world.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        {/* Meeting #1 */}
        <MeetingToggle
          number={1}
          title="Welcome & Vision Overview"
          date="April 2026"
          items={[
            { icon: <Video className="w-4 h-4" />, label: "Watch Video Intro", content: <VideoEmbed videoId={CURRENT_VIDEO_ID} /> },
            { icon: <FileText className="w-4 h-4" />, label: "Form to Fill Out", content: <SurveyForm session={session} /> },
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
            { icon: <StickyNote className="w-4 h-4" />, label: "Meeting Notes", content: <MeetingNotes meetingNumber={1} /> },
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

/* ── Meeting Notes ─────────────────────────────────── */
function MeetingNotes({ meetingNumber }: { meetingNumber: number }) {
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: "#9CA3AF" }}>Anyone can add notes here during or after the meeting.</p>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="Type meeting notes here…"
        className="bg-[#FAFAF8] text-sm"
      />
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

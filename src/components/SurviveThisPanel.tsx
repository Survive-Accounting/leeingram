import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { toast } from "sonner";
import { X, ArrowLeft, Mail, Sparkles, Send, Download, ThumbsUp, ThumbsDown, Share2, Loader2, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

const LEE_HEADSHOT_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg";

const NAVY = "#14213D";
const RED = "#CE1126";
const AMBER = "#F59E0B";
const AMBER_BG = "#FFFBEB";
const GREEN = "#16A34A";

type PromptKey = "study_strategy" | "how_to_solve" | "journal_entries" | "formulas" | "exam_traps" | "about_lee" | "request_video";

interface CardDef {
  key: PromptKey;
  emoji: string;
  title: string;
  subtitle: string;
  step: string;
  highlight?: boolean;
}

const CARDS: CardDef[] = [
  { key: "study_strategy", emoji: "📋", title: "Suggested study strategy", subtitle: "Get a PDF study guide for this problem", step: "01" },
  { key: "how_to_solve", emoji: "🔢", title: "How to get the answer?", subtitle: "Step-by-step walkthrough", step: "02" },
  { key: "journal_entries", emoji: "📊", title: "Understand the journal entries?", subtitle: "Why each entry works", step: "03" },
  { key: "formulas", emoji: "🧮", title: "Memorize the formulas?", subtitle: "Formula breakdown + tips", step: "04" },
  { key: "exam_traps", emoji: "⚠️", title: "Why is this tricky?", subtitle: "Exam traps to watch for", step: "05" },
  { key: "about_lee", emoji: "🙋", title: "Learn more about Lee", subtitle: "Who built this and why", step: "06" },
  { key: "request_video", emoji: "📹", title: "Request a video from Lee", subtitle: "Get a personal video answer", step: "07", highlight: true },
];

interface SurviveThisPanelProps {
  assetId?: string;
  assetName?: string;
  problemText?: string;
  instructions?: string;
  chapterName?: string;
  topicName?: string;
  courseName?: string;
  onDownloadPdf?: () => void;
  bottomOffset?: number;
}

export function SurviveThisPanel(props: SurviveThisPanelProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "response" | "about" | "video">("menu");
  const [activePrompt, setActivePrompt] = useState<PromptKey | null>(null);
  const [detached, setDetached] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // Lee online status
  const [leeOnline, setLeeOnline] = useState(false);
  const [priorityCfg, setPriorityCfg] = useState<{ is_active: boolean; price_cents: number; cutoff_time: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("priority_queue_config")
        .select("is_active, price_cents, cutoff_time")
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        setPriorityCfg(data);
        setLeeOnline(!!data.is_active);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Email
  const [email, setEmail] = useState<string>(() => {
    try { return localStorage.getItem("sa_free_user_email") || ""; } catch { return ""; }
  });
  const hasEmail = !!email && isAllowedEmail(email);

  const closePanel = useCallback(() => {
    setOpen(false);
    setTimeout(() => { setView("menu"); setActivePrompt(null); }, 300);
  }, []);

  const goCard = (key: PromptKey) => {
    setActivePrompt(key);
    if (key === "about_lee") {
      setView("about");
      try {
        localStorage.setItem("sa_interested_in_lee", "true");
        if (email) {
          // Best-effort tag — fire & forget
          supabase.from("activity_log").insert({
            entity_id: props.assetId || "unknown",
            entity_type: "teaching_asset" as any,
            event_type: "interested_in_lee",
            message: email,
            payload_json: { email },
          } as any).then(() => {}, () => {});
        }
      } catch { /* ignore */ }
    } else if (key === "request_video") {
      setView("video");
    } else {
      setView("response");
    }
  };

  // Drag handle (detached mode)
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Double-tap reset
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      setPos(null);
      setDetached(false);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    const point = "touches" in e ? e.touches[0] : e;
    const base = pos || { x: window.innerWidth - 444, y: window.innerHeight - Math.min(window.innerHeight * 0.85, window.innerHeight - 24) - 24 };
    dragRef.current = { startX: point.clientX, startY: point.clientY, baseX: base.x, baseY: base.y };
    setDetached(true);

    const move = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const p = "touches" in ev ? ev.touches[0] : ev as MouseEvent;
      const dx = p.clientX - dragRef.current.startX;
      const dy = p.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 100, dragRef.current.baseX + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 100, dragRef.current.baseY + dy)),
      });
    };
    const end = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", end);
  };

  const panelStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      position: "fixed",
      width: "min(420px, calc(100vw - 0px))",
      height: "85vh",
      zIndex: 1001,
      background: "#fff",
      borderRadius: 16,
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transformOrigin: "bottom right",
      transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease",
      transform: open ? "scale(1) translateY(0)" : "scale(0.2) translateY(40%)",
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
    };
    if (pos) {
      return { ...base, left: pos.x, top: pos.y, right: "auto", bottom: "auto" };
    }
    return { ...base, right: 24, bottom: 24 };
  }, [open, pos]);

  return (
    <>
      <FloatingButton
        open={open}
        onOpen={() => setOpen(true)}
        leeOnline={leeOnline}
        bottomOffset={props.bottomOffset ?? 24}
      />

      <div style={panelStyle} role="dialog" aria-label="Survive This — Lee's AI tutor">
        {/* Header */}
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          style={{ background: NAVY, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: detached ? "grabbing" : "grab", userSelect: "none" }}
        >
          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
            <img src={LEE_HEADSHOT_URL} alt="Lee" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid white" }} />
            {leeOnline && (
              <span style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#22C55E", border: "2px solid white", animation: "stp-pulse 2s ease-in-out infinite" }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>Hey, this is Lee.</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter, sans-serif" }}>
              {leeOnline ? "🟢 Lee is online now" : "⚫ Lee is offline"}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setDetached((d) => !d); if (detached) setPos(null); }}
            style={{ background: "transparent", border: 0, color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 4 }}
            title={detached ? "Snap back" : "Detach"}
          >
            {detached ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={closePanel} style={{ background: "transparent", border: 0, color: "#fff", cursor: "pointer", padding: 4 }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Experimental banner */}
        <div style={{ background: AMBER, color: NAVY, fontSize: 11, fontWeight: 600, textAlign: "center", padding: "6px 10px", fontFamily: "Inter, sans-serif" }}>
          🧪 Experimental AI feature — responses curated by Lee &amp; King
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {view === "menu" && (
            <MenuView onPick={goCard} />
          )}
          {view === "response" && activePrompt && (
            <ResponseView
              promptKey={activePrompt}
              card={CARDS.find((c) => c.key === activePrompt)!}
              email={email}
              hasEmail={hasEmail}
              onEmailSaved={(e) => setEmail(e)}
              onBack={() => { setView("menu"); setActivePrompt(null); }}
              onRequestVideo={() => setView("video")}
              onDownloadPdf={props.onDownloadPdf}
              ctx={props}
            />
          )}
          {view === "about" && (
            <AboutLeeView onBack={() => setView("menu")} />
          )}
          {view === "video" && (
            <VideoRequestView
              onBack={() => setView("menu")}
              email={email}
              onEmailSaved={(e) => setEmail(e)}
              priorityCfg={priorityCfg}
              assetId={props.assetId}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes stp-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        @keyframes stp-card-in {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes stp-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(20,33,61,0); }
          50% { box-shadow: 0 0 0 4px rgba(20,33,61,0.12); }
        }
        @keyframes stp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes stp-typewriter {
          from { max-height: 0; }
          to { max-height: 200px; }
        }
        .stp-card { animation: stp-card-in 200ms ease-out forwards; opacity: 0; }
        .stp-card-pulse { animation: stp-card-in 200ms ease-out forwards, stp-glow 1.6s ease-in-out 800ms 1; opacity: 0; }
        .stp-card:hover { transform: translateX(4px); border-color: ${NAVY} !important; background: #F8F9FA !important; }
      `}</style>
    </>
  );
}

// ── Floating Button ────────────────────────────────────────────────────

function FloatingButton({ open, onOpen, leeOnline }: { open: boolean; onOpen: () => void; leeOnline: boolean }) {
  const [hover, setHover] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const size = isMobile ? 56 : 64;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: open ? 0 : 1,
        pointerEvents: open ? "none" : "auto",
        transition: "opacity 200ms ease",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && !isMobile && (
        <div style={{
          background: "#fff", color: NAVY, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif",
          padding: "6px 12px", borderRadius: 999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
          marginBottom: 4,
        }}>
          Survive This Problem ✨
        </div>
      )}
      <button
        onClick={onOpen}
        aria-label="Open Survive This AI tutor"
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: "50%",
          background: NAVY,
          border: "3px solid #fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          padding: 0,
          cursor: "pointer",
          transform: hover ? "scale(1.05)" : "scale(1)",
          transition: "transform 150ms ease",
        }}
      >
        <img
          src={LEE_HEADSHOT_URL}
          alt="Lee"
          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
        />
        {/* AI badge top-left */}
        <span style={{
          position: "absolute", top: -4, left: -4, background: RED, color: "#fff",
          fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
          padding: "2px 5px", borderRadius: 8, lineHeight: 1.2,
          border: "1.5px solid #fff",
        }}>
          ✨ AI
        </span>
        {/* Online indicator top-right */}
        {leeOnline && (
          <span style={{
            position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%",
            background: "#22C55E", border: "2px solid white",
            animation: "stp-pulse 2s ease-in-out infinite",
          }} />
        )}
      </button>
      {/* Beta pill below */}
      <span style={{
        background: AMBER, color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
        padding: "2px 6px", borderRadius: 8, lineHeight: 1.2,
      }}>
        🧪 Beta
      </span>
    </div>
  );
}

// ── Menu View ──────────────────────────────────────────────────────────

function MenuView({ onPick }: { onPick: (key: PromptKey) => void }) {
  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 16, color: NAVY, fontFamily: "Inter, sans-serif", margin: "0 0 14px" }}>
        How can I help you survive this problem?
      </p>
      {CARDS.map((c, i) => (
        <button
          key={c.key}
          onClick={() => onPick(c.key)}
          className={i === 0 ? "stp-card-pulse" : "stp-card"}
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: c.highlight ? "#FFF8F0" : "#fff",
            border: `1px solid ${c.highlight ? AMBER : "#E5E7EB"}`,
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 8,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "Inter, sans-serif",
            transition: "all 150ms ease",
            animationDelay: `${i * 80}ms`,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{c.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{c.subtitle}</div>
          </div>
          <ChevronRight size={16} color="#9CA3AF" />
          <span style={{ position: "absolute", top: 6, right: 10, fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>{c.step}</span>
        </button>
      ))}
    </div>
  );
}

// ── Response View ──────────────────────────────────────────────────────

function ResponseView({
  promptKey, card, email, hasEmail, onEmailSaved, onBack, onRequestVideo, onDownloadPdf, ctx,
}: {
  promptKey: PromptKey;
  card: CardDef;
  email: string;
  hasEmail: boolean;
  onEmailSaved: (e: string) => void;
  onBack: () => void;
  onRequestVideo: () => void;
  onDownloadPdf?: () => void;
  ctx: SurviveThisPanelProps;
}) {
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [revealedAll, setRevealedAll] = useState(hasEmail);
  const [feedback, setFeedback] = useState<"none" | "yes" | "no">("none");
  const [emailInput, setEmailInput] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // Map UI prompt keys to edge function prompt_type
  const promptTypeForFn = useMemo(() => {
    if (promptKey === "journal_entries") return "journal_entry";
    if (promptKey === "how_to_solve" || promptKey === "study_strategy" || promptKey === "exam_traps" || promptKey === "formulas") return "problem";
    return "instructions";
  }, [promptKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = Date.now();
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("survive-this", {
          body: {
            asset_id: ctx.assetId,
            prompt_type: promptTypeForFn,
            context: {
              problem_text: ctx.problemText || "",
              instructions: ctx.instructions || "",
              chapter_name: ctx.chapterName || "",
              topic_name: ctx.topicName || "",
              course_name: ctx.courseName || "",
            },
          },
        });
        const elapsed = Date.now() - start;
        if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));
        if (cancelled) return;
        if (error) throw error;
        setResponseText((data as any)?.response_text || "Lee is preparing this answer. Try again in a moment.");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load response.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [promptKey, promptTypeForFn, ctx.assetId, ctx.problemText, ctx.instructions, ctx.chapterName, ctx.topicName, ctx.courseName]);

  const paragraphs = useMemo(() => responseText.split(/\n\n+/).filter(Boolean), [responseText]);
  const teaser = paragraphs[0] || "";
  const rest = paragraphs.slice(1).join("\n\n");

  const submitEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!isAllowedEmail(e)) {
      setEmailErr("Please use a valid .edu email.");
      return;
    }
    try { localStorage.setItem("sa_free_user_email", e); } catch {}
    onEmailSaved(e);
    setRevealedAll(true);
    setEmailErr(null);
    // Best-effort campus detection
    fetch(`https://hipolabs.com/data/universities/lookup?domain=${e.split("@")[1]}`).catch(() => {});
  };

  const submitFeedback = async (helpful: boolean) => {
    setFeedback(helpful ? "yes" : "no");
    if (!ctx.assetId) return;
    const col = helpful ? "helpful_count" : "not_helpful_count";
    try {
      // Increment via RPC-less approach: fetch then update
      const { data: existing } = await supabase
        .from("survive_ai_responses")
        .select(`id, ${col}`)
        .eq("asset_id", ctx.assetId)
        .eq("prompt_type", promptTypeForFn)
        .maybeSingle();
      if (existing && (existing as any).id) {
        const cur = ((existing as any)[col] as number) || 0;
        await supabase
          .from("survive_ai_responses")
          .update({ [col]: cur + 1 } as any)
          .eq("id", (existing as any).id);
      }
    } catch { /* ignore */ }
  };

  const sharePage = async () => {
    const url = window.location.href;
    const ok = await copyToClipboard(url);
    if (ok) toast.success("Link copied! Paste it in GroupMe, your group chat, anywhere. 🚀");
    else toast.error("Could not copy link");
  };

  return (
    <div style={{ padding: 16, fontFamily: "Inter, sans-serif" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: 0, color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 8, padding: 0 }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: NAVY }}>{card.emoji} {card.title}</h3>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20, justifyContent: "center" }}>
          <img src={LEE_HEADSHOT_URL} alt="" style={{ width: 36, height: 36, borderRadius: "50%", animation: "stp-pulse 1.4s ease-in-out infinite" }} />
          <span style={{ fontSize: 13, color: "#6B7280" }}>Lee is thinking<DotDotDot /></span>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#991B1B" }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ position: "relative", fontSize: 14, lineHeight: 1.7, color: NAVY, whiteSpace: "pre-wrap" }}>
            {teaser}
            {!revealedAll && rest && (
              <div style={{ position: "absolute", inset: 0, top: "60%", background: "linear-gradient(to bottom, rgba(255,255,255,0), #fff 70%)", pointerEvents: "none" }} />
            )}
          </div>

          {!revealedAll && rest && (
            <div style={{ marginTop: 12, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: NAVY }}>📧 Enter your .edu email to read the full explanation</p>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailErr(null); }}
                placeholder="your@university.edu"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, marginBottom: 8, fontFamily: "inherit" }}
              />
              {emailErr && <div style={{ color: RED, fontSize: 12, marginBottom: 6 }}>{emailErr}</div>}
              <button onClick={submitEmail} style={{ width: "100%", background: RED, color: "#fff", border: 0, borderRadius: 6, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Continue Reading →
              </button>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
                Free forever. No spam. We'll notify you when Lee posts related videos.
              </p>
            </div>
          )}

          {revealedAll && rest && (
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: NAVY, whiteSpace: "pre-wrap", animation: "stp-fade-in 400ms ease forwards" }}>
              {rest}
            </div>
          )}

          {revealedAll && promptKey === "study_strategy" && onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", color: NAVY, border: `1.5px solid ${NAVY}`, borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              <Download size={16} /> Download Study Guide PDF
            </button>
          )}

          {revealedAll && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
              {feedback === "none" && (
                <>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: NAVY }}>Did this help?</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => submitFeedback(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff", border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 6, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <ThumbsUp size={14} /> Yes!
                    </button>
                    <button onClick={() => submitFeedback(false)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff", border: "1px solid #D1D5DB", color: "#6B7280", borderRadius: 6, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <ThumbsDown size={14} /> Not really
                    </button>
                  </div>
                </>
              )}

              {feedback === "yes" && (
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: GREEN, fontWeight: 600 }}>Glad it helped! ✓</p>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: NAVY }}>Share this problem with your study group →</p>
                  <button onClick={sharePage} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: NAVY, color: "#fff", border: 0, borderRadius: 6, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <Share2 size={14} /> Share this page
                  </button>
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6B7280", textAlign: "center" }}>
                    Friends who open this link can use all AI tools too.
                  </p>
                </div>
              )}

              {feedback === "no" && (
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: NAVY }}>Sorry it missed the mark.<br />Want a video answer instead?</p>
                  <button onClick={onRequestVideo} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: RED, color: "#fff", border: 0, borderRadius: 6, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    📹 Request a video →
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DotDotDot() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x % 3) + 1), 400);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(n)}</span>;
}

// ── About Lee View ─────────────────────────────────────────────────────

function AboutLeeView({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: 20, fontFamily: "Inter, sans-serif" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: 0, color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>
        <ArrowLeft size={14} /> Back
      </button>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <img src={LEE_HEADSHOT_URL} alt="Lee Ingram" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
        <h3 style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 600, color: NAVY }}>Lee Ingram</h3>
      </div>
      <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 12px" }}>
        I'm an Ole Miss accounting alum who became a full-time tutor in 2015. I built Survive Accounting because I wanted every student to have access to the kind of help I wish I'd had.
      </p>
      <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 12px" }}>
        I use AI responsibly — every response you see here is curated by me and my team. Nothing goes out unless we believe it actually helps you.
      </p>
      <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>
        I'm a real person. If something's wrong, tell me.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <a href="mailto:lee@surviveaccounting.com" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: NAVY, color: "#fff", padding: "10px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          📧 Email Lee →
        </a>
        <a href="/survive-ai" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: NAVY, padding: "10px", borderRadius: 8, border: `1.5px solid ${NAVY}`, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ✨ Survive AI Newsletter →
        </a>
        <a href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: NAVY, padding: "10px", borderRadius: 8, border: `1.5px solid ${NAVY}`, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          🎓 About Survive Accounting →
        </a>
      </div>
    </div>
  );
}

// ── Video Request View ────────────────────────────────────────────────

type Tier = "same_day" | "two_days" | "no_rush";

function VideoRequestView({
  onBack, email, onEmailSaved, priorityCfg, assetId,
}: {
  onBack: () => void;
  email: string;
  onEmailSaved: (e: string) => void;
  priorityCfg: { is_active: boolean; price_cents: number; cutoff_time: string | null } | null;
  assetId?: string;
}) {
  const leeOnline = !!priorityCfg?.is_active;
  const [tier, setTier] = useState<Tier>(leeOnline ? "same_day" : "two_days");
  const [question, setQuestion] = useState("");
  const [isMajor, setIsMajor] = useState(false);
  const [emailInput, setEmailInput] = useState(email);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chipIn, setChipIn] = useState<number | null>(null);
  const [existing, setExisting] = useState<{ id: string; is_priority: boolean | null; upvote_count: number | null } | null>(null);
  const [otherCount, setOtherCount] = useState<number>(0);

  useEffect(() => {
    if (!assetId) return;
    (async () => {
      const { data } = await supabase
        .from("video_requests")
        .select("id, is_priority, upvote_count")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (data && data.length) {
        setExisting(data[0] as any);
        setOtherCount(data.length);
      }
    })();
  }, [assetId]);

  const twoDaysFrom = useMemo(() => {
    const d = new Date();
    let added = 0;
    while (added < 2) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added += 1;
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, []);

  const submit = async () => {
    if (!question.trim()) return;
    const e = (emailInput || email).trim().toLowerCase();
    if (!isAllowedEmail(e)) { setEmailErr("Please use a valid .edu email."); return; }
    try { localStorage.setItem("sa_free_user_email", e); } catch {}
    onEmailSaved(e);
    setSubmitting(true);
    try {
      // Beta: skip Stripe, insert directly
      // TODO: activate Stripe when beta period ends
      await supabase.from("video_requests").insert({
        asset_id: assetId,
        student_email: e,
        question: question.trim(),
        is_accounting_major: isMajor,
        is_priority: tier === "same_day",
        priority_paid_at: tier === "same_day" ? new Date().toISOString() : null,
        status: "pending",
      } as any);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const upvoteExisting = async () => {
    if (!existing) return;
    const e = (emailInput || email).trim().toLowerCase() || null;
    try {
      await supabase.from("video_request_upvotes").insert({
        video_request_id: existing.id,
        student_email: e,
      } as any);
      toast.success("Upvoted! Lee will email you when it's answered.");
    } catch (err: any) {
      toast.error("Could not upvote.");
    }
  };

  if (submitted) {
    const tierMsg = tier === "same_day" ? "Lee will answer today. We'll email you when it's ready." :
      tier === "two_days" ? `Est. ready by ${twoDaysFrom}. We'll email you.` :
      "Est. ready within 10 days. We'll email you when posted.";
    return (
      <div style={{ padding: 20, fontFamily: "Inter, sans-serif", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600, color: NAVY }}>Request submitted! 🎉</h3>
        <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, margin: "0 0 12px" }}>{tierMsg}</p>
        {isMajor && (
          <p style={{ fontSize: 13, color: AMBER, fontWeight: 600, margin: "0 0 16px" }}>⭐ Accounting major flagged — you're in the priority queue.</p>
        )}
        {existing && otherCount > 1 && (
          <div style={{ marginTop: 16, padding: 12, background: "#F8F9FA", borderRadius: 8, textAlign: "left" }}>
            <p style={{ fontSize: 13, color: NAVY, margin: "0 0 8px" }}>{otherCount - 1} other student{otherCount - 1 === 1 ? "" : "s"} asked about this problem.</p>
            <button onClick={upvoteExisting} style={{ width: "100%", background: NAVY, color: "#fff", border: 0, borderRadius: 6, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              👆 Upvote existing request
            </button>
          </div>
        )}
        <button onClick={onBack} style={{ marginTop: 20, background: "transparent", border: 0, color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Back to menu</button>
      </div>
    );
  }

  const tierCard = (key: Tier, opts: { emoji: string; title: string; sub: string; price: string; etaTitle: string; eta: string; tone?: "green" | "muted" }) => {
    const selected = tier === key;
    const greenHi = opts.tone === "green";
    const muted = opts.tone === "muted";
    return (
      <button
        onClick={() => setTier(key)}
        style={{
          width: "100%", textAlign: "left", padding: 12, borderRadius: 8, marginBottom: 8, cursor: "pointer",
          background: selected ? NAVY : (greenHi ? "#F0FDF4" : "#fff"),
          color: selected ? "#fff" : NAVY,
          border: selected ? `2px solid ${NAVY}` : `${greenHi ? "2px" : "1px"} solid ${greenHi ? GREEN : "#D1D5DB"}`,
          opacity: muted ? 0.85 : 1,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{opts.emoji} {opts.title}</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {opts.price === "Free" ? <span>Free</span> : (
              <span><s style={{ opacity: 0.6 }}>{opts.price}</s> <span style={{ color: selected ? "#86EFAC" : GREEN }}>Free 🎉</span></span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>{opts.sub}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{opts.etaTitle}: {opts.eta}</div>
        {greenHi && !selected && (
          <div style={{ marginTop: 6, display: "inline-block", fontSize: 10, fontWeight: 700, background: GREEN, color: "#fff", padding: "2px 6px", borderRadius: 6 }}>🟢 Lee is live</div>
        )}
      </button>
    );
  };

  return (
    <div style={{ padding: 16, fontFamily: "Inter, sans-serif" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: 0, color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 10, padding: 0 }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: NAVY }}>Request a video from Lee</h3>

      {leeOnline && tierCard("same_day", { emoji: "⚡", title: "Same day", sub: "Lee is online now", price: "$50", etaTitle: "Est. wait", eta: "Today", tone: "green" })}
      {tierCard("two_days", { emoji: "📅", title: "1–2 business days", sub: "Standard turnaround", price: "$30", etaTitle: "Est. wait", eta: twoDaysFrom })}
      {tierCard("no_rush", { emoji: "🕐", title: "No rush", sub: "Free option", price: "Free", etaTitle: "Est. wait", eta: "Up to 10 days", tone: "muted" })}

      {existing && existing.is_priority && (
        <div style={{ margin: "12px 0", paddingTop: 12, borderTop: "1px solid #E5E7EB" }}>
          <p style={{ fontSize: 12, color: NAVY, margin: "0 0 6px" }}>
            {(existing.upvote_count || 0) + 1} students chipped in to prioritize this question
          </p>
          <div style={{ height: 6, background: "#FEF3C7", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ width: `${Math.min(100, ((existing.upvote_count || 0) + 1) * 10)}%`, height: "100%", background: AMBER }} />
          </div>
          <p style={{ fontSize: 12, color: NAVY, margin: "0 0 6px", fontWeight: 600 }}>Add to the priority:</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {[5, 10, 20].map((amt) => (
              <button key={amt} onClick={() => setChipIn(amt)} style={{
                flex: 1, padding: "6px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: chipIn === amt ? NAVY : "#fff", color: chipIn === amt ? "#fff" : NAVY,
                border: `1px solid ${NAVY}`,
              }}>
                ${amt}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#6B7280", margin: 0 }}>Every chip-in moves this up the queue.</p>
        </div>
      )}

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginTop: 12, marginBottom: 6 }}>
        What are you confused about?
      </label>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
        rows={4}
        placeholder="Describe what's not clicking for you..."
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
      />
      <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right", marginTop: 2 }}>{question.length}/500</div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: NAVY, cursor: "pointer" }}>
        <input type="checkbox" checked={isMajor} onChange={(e) => setIsMajor(e.target.checked)} />
        Are you an accounting major?
      </label>

      {!email && (
        <>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginTop: 12, marginBottom: 6 }}>Your email:</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setEmailErr(null); }}
            placeholder="your@university.edu"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }}
          />
          {emailErr && <div style={{ color: RED, fontSize: 12, marginTop: 4 }}>{emailErr}</div>}
        </>
      )}

      <button
        onClick={submit}
        disabled={!question.trim() || submitting}
        style={{
          marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: RED, color: "#fff", border: 0, borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600,
          cursor: question.trim() && !submitting ? "pointer" : "not-allowed",
          opacity: question.trim() && !submitting ? 1 : 0.5,
        }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {submitting ? "Submitting..." : "Submit Request →"}
      </button>
      <p style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 8 }}>
        🎉 Free during beta — no payment required
      </p>
    </div>
  );
}

export default SurviveThisPanel;

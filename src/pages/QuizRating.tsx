import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function useSendHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const send = useCallback(() => {
    const h = ref.current?.scrollHeight ?? document.documentElement.scrollHeight;
    window.parent.postMessage({ type: "resize", height: h }, "*");
    window.parent.postMessage({ type: "sa-height", height: h }, "*");
  }, []);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    send();
  }, [send]);

  useEffect(() => {
    send();
    const t = setTimeout(send, 200);
    document.fonts.ready.then(send);
    const observer = new ResizeObserver(send);
    if (ref.current) observer.observe(ref.current);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [send]);

  return { ref, send };
}

function Star({ filled, hovered, onClick, onMouseEnter, onMouseLeave }: {
  filled: boolean; hovered: boolean; onClick: () => void;
  onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const color = filled || hovered ? "#FBBF24" : "rgba(255,255,255,0.3)";
  return (
    <svg
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      width="28" height="28" viewBox="0 0 24 24"
      fill={color} stroke={color} strokeWidth="1"
      style={{ cursor: "pointer", transition: "fill 0.15s" }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function QuizRating() {
  const { topicId } = useParams<{ topicId: string }>();
  const { ref, send } = useSendHeight();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: topic } = useQuery({
    queryKey: ["quiz-rating-topic", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_topics")
        .select("id, topic_name, chapter_id")
        .eq("id", topicId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!topicId,
  });

  useEffect(() => { send(); }, [submitted, send]);

  const handleSubmit = async () => {
    if (!rating || !topic) return;
    setSubmitting(true);
    try {
      await supabase.from("chapter_questions").insert({
        chapter_id: topic.chapter_id,
        issue_type: "quiz_rating",
        question: message || null,
        student_email: email || "anonymous",
        student_name: name || null,
        source_ref: JSON.stringify({ star_rating: rating, topic_id: topicId, topic_name: topic.topic_name }),
        status: "new",
      } as any);

      // Send email notification
      try {
        await supabase.functions.invoke("send-chapter-question", {
          body: {
            student_email: email || "anonymous",
            question: `Quiz Rating: ${rating}★\nTopic: ${topic.topic_name}\n\n${message || "(no message)"}${name ? `\n\nName: ${name}` : ""}`,
            course_name: "",
            chapter_number: "",
            chapter_name: `Quiz Rating [${rating}★] — ${topic.topic_name}`,
          },
        });
      } catch {
        // Email is best-effort
      }

      setSubmitted(true);
      setTimeout(send, 100);
      setTimeout(send, 1000);
    } catch (e) {
      console.error("Submit error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div ref={ref} style={{ fontFamily: "Inter, sans-serif", padding: "24px 8px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)" }}>
          Got it — thanks. — Lee
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    color: "#f0f0f0",
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  };

  return (
    <div ref={ref} style={{ fontFamily: "Inter, sans-serif", padding: "8px 4px", color: "#f0f0f0" }}>
      <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, margin: "0 0 16px" }}>
        You've completed this quiz!
      </p>

      {/* Stars */}
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            filled={n <= rating}
            hovered={n <= hoverRating}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
          />
        ))}
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "0 0 12px" }}>
        How helpful was this quiz?
      </p>

      {/* Message */}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Question, feedback, or anything on your mind... I read every message."
        style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginTop: 0 }}
      />

      {/* Name + Email */}
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" as const }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          style={{ ...inputStyle, flex: "1 1 140px" }}
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email for reply (optional)"
          type="email"
          style={{ ...inputStyle, flex: "1 1 180px" }}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        style={{
          marginTop: 14,
          background: !rating ? "rgba(206,17,38,0.4)" : "#CE1126",
          color: "white",
          border: "none",
          borderRadius: 6,
          padding: "10px 20px",
          fontWeight: 500,
          fontSize: 14,
          fontFamily: "Inter, sans-serif",
          cursor: !rating ? "not-allowed" : "pointer",
          opacity: !rating ? 0.6 : 1,
          width: "100%",
          maxWidth: 320,
        }}
      >
        {submitting ? "Sending…" : "Send to Lee →"}
      </button>
    </div>
  );
}

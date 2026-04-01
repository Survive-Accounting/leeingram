import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function useEmbedSetup() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);
  useEffect(() => {
    const send = () => {
      if (ref.current) {
        window.parent.postMessage({ type: "resize", height: ref.current.scrollHeight }, "*");
      }
    };
    send();
    const t = setTimeout(send, 300);
    document.fonts.ready.then(send);
    const observer = new ResizeObserver(send);
    if (ref.current) observer.observe(ref.current);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, []);
  return ref;
}

export default function QuizQuestion() {
  const { questionId } = useParams<{ questionId: string }>();
  const ref = useEmbedSetup();

  const { data: q, isLoading } = useQuery({
    queryKey: ["quiz-question-embed", questionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topic_quiz_questions")
        .select("id, question_type, question_text, je_description")
        .eq("id", questionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!questionId,
  });

  if (isLoading) return <div style={{ padding: 12 }}><Loader2 className="h-4 w-4 animate-spin" style={{ color: "#e8e8e8" }} /></div>;
  if (!q) return <div style={{ padding: "12px 4px", fontFamily: "Inter, sans-serif", fontSize: 15, color: "#e8e8e8" }}>Question not found.</div>;

  const text = q.question_type === "je_recall" && q.je_description ? q.je_description : q.question_text;
  const label = q.question_type === "je_recall" ? "JOURNAL ENTRY QUESTION" : "QUESTION";

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "Inter, sans-serif",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderLeft: "4px solid #CE1126",
        borderRadius: 8,
        padding: "16px 18px",
        margin: 0,
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "#CE1126",
        textTransform: "uppercase" as const,
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 15,
        lineHeight: 1.7,
        color: "#f0f0f0",
        fontWeight: 400,
      }}>
        {text}
      </div>
      <hr style={{
        border: "none",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        margin: "12px 0 8px",
      }} />
      <div style={{
        fontSize: 11,
        color: "rgba(255,255,255,0.35)",
        textAlign: "left",
      }}>
        Survive Accounting · surviveaccounting.com
      </div>
    </div>
  );
}

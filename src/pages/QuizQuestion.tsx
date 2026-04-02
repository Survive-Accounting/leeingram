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
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // Fire resize immediately on mount using documentElement height
    const h0 = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: "resize", height: h0 }, "*");
    window.parent.postMessage({ type: "sa-height", height: h0 }, "*");
  }, []);
  useEffect(() => {
    const send = () => {
      const h = ref.current
        ? ref.current.scrollHeight
        : document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "resize", height: h }, "*");
      window.parent.postMessage({ type: "sa-height", height: h }, "*");
    };
    send();
    const t = setTimeout(send, 100);
    document.fonts.ready.then(send);
    const observer = new ResizeObserver(send);
    if (ref.current) observer.observe(ref.current);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, []);
  return ref;
}

const LABEL_CONFIG: Record<string, { text: string; color: string }> = {
  je_recall: { text: "JOURNAL ENTRY QUESTION", color: "#FBBF24" },
  calc_mc: { text: "CALCULATION QUESTION", color: "#60A5FA" },
  conceptual_mc: { text: "CONCEPTUAL QUESTION", color: "#34D399" },
  mc: { text: "QUESTION", color: "#60A5FA" },
};

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
  const labelCfg = LABEL_CONFIG[q.question_type] || LABEL_CONFIG.mc;

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "Inter, sans-serif",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderLeft: `4px solid ${labelCfg.color}`,
        borderRadius: 8,
        padding: "16px 18px",
        margin: 0,
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: labelCfg.color,
        textTransform: "uppercase" as const,
        marginBottom: 8,
      }}>
        {labelCfg.text}
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
        surviveaccounting.com · Created by Lee Ingram
      </div>
    </div>
  );
}

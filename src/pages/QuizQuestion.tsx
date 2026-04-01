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

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 15,
        lineHeight: 1.6,
        padding: "12px 4px",
        background: "transparent",
        color: "#e8e8e8",
      }}
    >
      {text}
    </div>
  );
}

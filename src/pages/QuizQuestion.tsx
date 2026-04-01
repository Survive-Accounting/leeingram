import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function useResizeMessage() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const send = () => {
      if (ref.current) {
        window.parent.postMessage({ type: "resize", height: ref.current.scrollHeight }, "*");
      }
    };
    send();
    const observer = new ResizeObserver(send);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function QuizQuestion() {
  const { questionId } = useParams<{ questionId: string }>();
  const ref = useResizeMessage();

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

  if (isLoading) return <div style={{ padding: 16 }}><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!q) return <div style={{ padding: 16, fontFamily: "Inter, sans-serif", fontSize: 15 }}>Question not found.</div>;

  const text = q.question_type === "je_recall" && q.je_description ? q.je_description : q.question_text;

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 15,
        lineHeight: 1.6,
        padding: 16,
        background: "transparent",
        color: "#1a1a1a",
      }}
    >
      {text}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { parseJEOption } from "@/lib/questionHtmlRenderer";

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

const CHOICE_MAP: Record<string, string> = { "1": "option_a", "2": "option_b", "3": "option_c", "4": "option_d" };

export default function QuizChoice() {
  const { questionId, choiceNumber } = useParams<{ questionId: string; choiceNumber: string }>();
  const ref = useResizeMessage();

  const { data: q, isLoading } = useQuery({
    queryKey: ["quiz-choice-embed", questionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topic_quiz_questions")
        .select("id, question_type, option_a, option_b, option_c, option_d")
        .eq("id", questionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!questionId,
  });

  if (isLoading) return <div style={{ padding: 16 }}><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!q || !choiceNumber) return <div style={{ padding: 16, fontFamily: "Inter, sans-serif", fontSize: 15 }}>Not found.</div>;

  const field = CHOICE_MAP[choiceNumber];
  const raw = field ? (q as any)[field] : null;
  if (!raw) return <div style={{ padding: 16, fontFamily: "Inter, sans-serif", fontSize: 15 }}>—</div>;

  const isJE = q.question_type === "je_recall";
  const jeParsed = isJE ? parseJEOption(raw) : null;

  if (jeParsed && jeParsed.length > 0) {
    const debits = jeParsed.filter(r => r.side === "debit");
    const credits = jeParsed.filter(r => r.side === "credit");
    const ordered = [...debits, ...credits];

    return (
      <div ref={ref} style={{ padding: 8, background: "transparent" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "left", background: "#14213D", color: "white" }}>Account</th>
              <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "center", background: "#14213D", color: "white", width: 80 }}>Debit</th>
              <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "center", background: "#14213D", color: "white", width: 80 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r, i) => {
              const isCredit = r.side === "credit";
              return (
                <tr key={i}>
                  <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "left", paddingLeft: isCredit ? 20 : 8 }}>{r.account_name}</td>
                  <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "center", width: 80 }}>{isCredit ? "" : "✓"}</td>
                  <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "center", width: 80 }}>{isCredit ? "✓" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // MC plain text
  return (
    <div
      ref={ref}
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 15,
        lineHeight: 1.6,
        padding: 16,
        textAlign: "center",
        background: "transparent",
        color: "#1a1a1a",
      }}
    >
      {raw}
    </div>
  );
}

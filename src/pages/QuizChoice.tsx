import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { parseJEOption } from "@/lib/questionHtmlRenderer";

function useEmbedSetup() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
  }, []);
  useEffect(() => {
    const send = () => {
      if (ref.current) {
        const h = ref.current.scrollHeight;
        window.parent.postMessage({ type: "resize", height: h }, "*");
        window.parent.postMessage({ type: "sa-height", height: h }, "*");
      }
    };
    send();
    const t = setTimeout(send, 200);
    document.fonts.ready.then(send);
    const observer = new ResizeObserver(send);
    if (ref.current) observer.observe(ref.current);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, []);
  return ref;
}

const CHOICE_MAP: Record<string, string> = { "1": "option_a", "2": "option_b", "3": "option_c", "4": "option_d" };

export default function QuizChoice() {
  const { questionId, choiceNumber } = useParams<{ questionId: string; choiceNumber: string }>();
  const ref = useEmbedSetup();

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

  if (isLoading) return <div style={{ padding: 8 }}><Loader2 className="h-4 w-4 animate-spin" style={{ color: "#e8e8e8" }} /></div>;
  if (!q || !choiceNumber) return <div style={{ padding: 8, fontFamily: "Inter, sans-serif", fontSize: 15, color: "#e8e8e8" }}>Not found.</div>;

  const field = CHOICE_MAP[choiceNumber];
  const raw = field ? (q as any)[field] : null;
  if (!raw) return <div style={{ padding: 8, fontFamily: "Inter, sans-serif", fontSize: 15, color: "#e8e8e8" }}>—</div>;

  const isJE = q.question_type === "je_recall";
  const jeParsed = isJE ? parseJEOption(raw) : null;

  if (jeParsed && jeParsed.length > 0) {
    const debits = jeParsed.filter(r => r.side === "debit");
    const credits = jeParsed.filter(r => r.side === "credit");
    const ordered = [...debits, ...credits];

    return (
      <div ref={ref} style={{ padding: 4, background: "transparent" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "6px 8px", textAlign: "left", background: "#14213D", color: "white" }}>Account</th>
              <th style={{ padding: "6px 8px", textAlign: "center", background: "#14213D", color: "white", width: 70 }}>Debit</th>
              <th style={{ padding: "6px 8px", textAlign: "center", background: "#14213D", color: "white", width: 70 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r, i) => {
              const isCredit = r.side === "credit";
              return (
                <tr key={i}>
                  <td style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", padding: "6px 8px", textAlign: "left", paddingLeft: isCredit ? 24 : 8, color: "#e8e8e8" }}>{r.account_name}</td>
                  <td style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", padding: "6px 8px", textAlign: "center", width: 70, color: "#e8e8e8" }}>{isCredit ? "" : "✓"}</td>
                  <td style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", padding: "6px 8px", textAlign: "center", width: 70, color: "#e8e8e8" }}>{isCredit ? "✓" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // MC plain text — left aligned
  return (
    <div
      ref={ref}
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 15,
        fontWeight: 500,
        lineHeight: 1.6,
        padding: "8px 4px",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        minHeight: 44,
        background: "transparent",
        color: "#f0f0f0",
      }}
    >
      {raw}
    </div>
  );
}

import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TopicData {
  topic_name: string;
  chapter_name: string;
  chapter_number: number;
  course_name: string;
}

export default function QuizEnd() {
  const { topicId } = useParams<{ topicId: string }>();
  const [data, setData] = useState<TopicData | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      const { data: topic } = await supabase
        .from("chapter_topics")
        .select("topic_name, chapter_id, course_id")
        .eq("id", topicId)
        .single();
      if (!topic) return;

      const [{ data: ch }, { data: co }] = await Promise.all([
        supabase.from("chapters").select("chapter_name, chapter_number").eq("id", topic.chapter_id).single(),
        topic.course_id
          ? supabase.from("courses").select("course_name").eq("id", topic.course_id).single()
          : Promise.resolve({ data: null }),
      ]);

      setData({
        topic_name: topic.topic_name,
        chapter_name: ch?.chapter_name ?? "",
        chapter_number: ch?.chapter_number ?? 0,
        course_name: co?.course_name ?? "",
      });
    })();
  }, [topicId]);

  useEffect(() => {
    const sendHeight = () => {
      if (!ref.current) return;
      const h = ref.current.scrollHeight;
      window.parent.postMessage({ type: "sa-height", height: h }, "*");
      window.parent.postMessage({ type: "resize", height: h }, "*");
    };
    sendHeight();
    document.fonts?.ready?.then(sendHeight);
    window.addEventListener("resize", sendHeight);
    return () => window.removeEventListener("resize", sendHeight);
  }, [data]);

  if (!data) return null;

  const hubUrl = "https://learn.surviveaccounting.com";

  return (
    <div ref={ref} style={{ margin: 0, padding: 0, background: "#14213D", fontFamily: "Inter, sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap"
        rel="stylesheet"
      />
      {/* Hero image */}
      <img
        src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png"
        alt="Mountain landscape"
        style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
      />

      {/* Content */}
      <div style={{ padding: "32px 24px", textAlign: "center" }}>
        {/* Logo */}
        <img
          src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
          alt="Survive Accounting"
          style={{ width: 160, margin: "0 auto", display: "block" }}
        />

        {/* Quiz Complete label */}
        <p style={{
          fontSize: 13,
          color: "#CE1126",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginTop: 24,
          marginBottom: 0,
          fontWeight: 600,
        }}>
          Quiz Complete
        </p>

        {/* Topic name */}
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 26,
          color: "#ffffff",
          marginTop: 8,
          marginBottom: 0,
          fontWeight: 400,
        }}>
          {data.topic_name}
        </h1>

        {/* Red divider */}
        <div style={{
          width: 40,
          height: 2,
          background: "#CE1126",
          margin: "20px auto",
        }} />

        {/* Message */}
        <p style={{
          fontSize: 15,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.8,
          maxWidth: 440,
          margin: "0 auto",
        }}>
          Review your results below. If you missed something,
          check the Deep Explanation for each question —
          it walks you through exactly why the correct answer is right.
        </p>

        {/* CTA button */}
        <a
          href={hubUrl}
          target="_parent"
          style={{
            display: "block",
            width: "fit-content",
            margin: "24px auto 0",
            background: "#CE1126",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 500,
            padding: "12px 24px",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Back to Chapter Hub →
        </a>

        {/* Footer */}
        <p style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
          marginTop: 20,
        }}>
          by Lee Ingram · surviveaccounting.com
        </p>
      </div>
    </div>
  );
}

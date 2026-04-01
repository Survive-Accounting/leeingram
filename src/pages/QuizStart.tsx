import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TopicData {
  topic_name: string;
  chapter_name: string;
  chapter_number: number;
  course_name: string;
}

export default function QuizStart() {
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

        {/* Topic name */}
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 28,
          color: "#ffffff",
          marginTop: 20,
          marginBottom: 0,
          fontWeight: 400,
        }}>
          {data.topic_name}
        </h1>

        {/* Chapter + course */}
        <p style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.6)",
          marginTop: 8,
          marginBottom: 0,
        }}>
          Chapter {data.chapter_number} · {data.course_name}
        </p>

        {/* Red divider */}
        <div style={{
          width: 40,
          height: 2,
          background: "#CE1126",
          margin: "20px auto",
        }} />

        {/* Instruction text */}
        <p style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.8)",
          lineHeight: 1.7,
          maxWidth: 400,
          margin: "0 auto",
        }}>
          This quick quiz tests your understanding of {data.topic_name}.
          <br />
          5 questions · Multiple choice · Journal entry recall
        </p>

        {/* Footer */}
        <p style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
          marginTop: 24,
        }}>
          by Lee Ingram
        </p>
      </div>
    </div>
  );
}

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
    const t = setTimeout(sendHeight, 150);
    document.fonts?.ready?.then(sendHeight);
    window.addEventListener("resize", sendHeight);
    return () => { clearTimeout(t); window.removeEventListener("resize", sendHeight); };
  }, [data]);

  if (!data) return null;

  return (
    <div
      ref={ref}
      style={{
        margin: 0,
        padding: 0,
        background: "#14213D",
        fontFamily: "Inter, sans-serif",
        minHeight: 340,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap"
        rel="stylesheet"
      />

      {/* Top content */}
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <p style={{
          fontSize: 11,
          color: "#CE1126",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
          margin: 0,
        }}>
          Refresher Quiz
        </p>

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

        <p style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.55)",
          marginTop: 6,
          marginBottom: 0,
        }}>
          Ch. {data.chapter_number} · {data.course_name}
        </p>

        <div style={{
          width: 40,
          height: 2,
          background: "#CE1126",
          margin: "16px auto",
        }} />

        <p style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.5)",
          margin: 0,
        }}>
          5 questions
        </p>
      </div>

      {/* Bottom logo */}
      <div style={{ marginTop: "auto", paddingBottom: 40, textAlign: "center" }}>
        <img
          src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
          alt="Survive Accounting"
          style={{ width: 120, margin: "0 auto", display: "block" }}
        />
        <p style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          marginTop: 6,
          marginBottom: 0,
        }}>
          Created by Lee Ingram
        </p>
      </div>
    </div>
  );
}

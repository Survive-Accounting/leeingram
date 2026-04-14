import { useState } from "react";
import { ChevronDown } from "lucide-react";
import TopicList from "./TopicList";

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface Topic {
  id: string;
  topic_name: string;
  display_order: number;
  chapter_id: string;
}

interface ChapterAccordionProps {
  chapters: Chapter[];
  topicsByChapter: Record<string, Topic[]>;
}

export default function ChapterAccordion({ chapters, topicsByChapter }: ChapterAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {chapters.map((ch) => {
        const isOpen = openId === ch.id;
        const topics = topicsByChapter[ch.id] || [];

        return (
          <div
            key={ch.id}
            className="rounded-xl overflow-hidden transition-all"
            style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              boxShadow: isOpen ? "0 2px 8px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <button
              onClick={() => setOpenId(isOpen ? null : ch.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-[14px] font-medium" style={{ color: "#14213D" }}>
                Chapter {ch.chapter_number}: {ch.chapter_name}
              </span>
              <ChevronDown
                className="w-4 h-4 shrink-0 transition-transform"
                style={{
                  color: "#9CA3AF",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-3 border-t" style={{ borderColor: "#F3F4F6" }}>
                <TopicList topics={topics} chapterId={ch.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

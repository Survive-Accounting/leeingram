interface TopicListProps {
  topics: { id: string; topic_name: string; display_order: number }[];
  chapterId: string;
}

export default function TopicList({ topics, chapterId }: TopicListProps) {
  if (!topics.length) {
    return <p className="text-[13px] py-2" style={{ color: "#9CA3AF" }}>Topics coming soon</p>;
  }

  return (
    <ul className="space-y-1 py-2">
      {topics.map((t) => (
        <li key={t.id}>
          <a
            href={`/cram/${chapterId}?topic=${t.id}&preview=true`}
            className="text-[13px] hover:underline block py-0.5 transition-colors"
            style={{ color: "#4B5563" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#14213D")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#4B5563")}
          >
            {t.topic_name}
          </a>
        </li>
      ))}
    </ul>
  );
}

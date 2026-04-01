import { useParams } from "react-router-dom";

const LegacyNotion = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const fnUrl = `https://hdylxvyvateaephkbccy.supabase.co/functions/v1/notion-proxy?pageId=${pageId}`;

  return (
    <iframe
      src={fnUrl}
      title="Legacy Content"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
    />
  );
};

export default LegacyNotion;

import { useParams, useSearchParams } from "react-router-dom";

const LegacyNotion = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get("chapterId");

  const notionSrc = `https://${pageId}.notion.site`;
  const linkHref = chapterId
    ? `https://learn.surviveaccounting.com/cram/${chapterId}`
    : "https://learn.surviveaccounting.com";

  return (
    <div style={{ margin: 0, padding: 0, height: "100vh", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{
        background: "#14213D",
        width: "100%",
        height: 40,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "2px solid #CE1126",
        boxSizing: "border-box",
      }}>
        <img
          src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
          alt="Survive"
          style={{ height: 22, width: "auto" }}
        />
        <span style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
        }}>
          {"LEGACY CONTENT \u00B7 2020\u20132025"}
        </span>
        <a
          href={linkHref}
          target="_parent"
          style={{
            marginLeft: "auto",
            color: "#CE1126",
            fontSize: 12,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          {"View new version \u2192"}
        </a>
      </div>
      <iframe
        src={notionSrc}
        title="Legacy Content"
        style={{ width: "100%", height: "calc(100vh - 40px)", border: "none", display: "block" }}
      />
    </div>
  );
};

export default LegacyNotion;

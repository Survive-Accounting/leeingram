import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function LegacyNotionPage() {
  const { pageId } = useParams<{ pageId: string }>();

  useEffect(() => {
    document.title = "Legacy Content — Survive Accounting";
  }, []);

  return (
    <div style={{ margin: 0, padding: 0, overflow: "hidden", height: "100vh" }}>
      <div
        style={{
          background: "#14213D",
          width: "100%",
          height: 40,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          borderBottom: "2px solid #CE1126",
          boxSizing: "border-box",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 50,
        }}
      >
        <img
          src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
          alt="Survive"
          style={{ height: 22, width: "auto" }}
        />
        <span
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 500,
          }}
        >
          LEGACY CONTENT · 2020–2025
        </span>
        <a
          href="https://learn.surviveaccounting.com"
          style={{
            marginLeft: "auto",
            color: "#CE1126",
            fontSize: 12,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          View new version →
        </a>
      </div>
      <iframe
        src={`https://prairie-walkover-fc0.notion.site/${pageId}`}
        title="Legacy Content"
        style={{
          width: "100%",
          height: "calc(100vh - 40px)",
          border: "none",
          display: "block",
          marginTop: 40,
        }}
      />
    </div>
  );
}

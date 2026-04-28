import { useEffect, useState } from "react";

const NAVY = "#14213D";
const BETA_END = new Date("2026-05-15T23:59:59Z").getTime();

export default function BetaCountdownStrip() {
  const [daysLeft, setDaysLeft] = useState<number>(() =>
    Math.max(0, Math.ceil((BETA_END - Date.now()) / (1000 * 60 * 60 * 24))),
  );

  useEffect(() => {
    const t = setInterval(() => {
      setDaysLeft(Math.max(0, Math.ceil((BETA_END - Date.now()) / (1000 * 60 * 60 * 24))));
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="w-full text-center text-[12px] tracking-wide py-2"
      style={{
        background: NAVY,
        color: "rgba(255,255,255,0.92)",
        fontFamily: "Inter, sans-serif",
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ fontWeight: 600 }}>BETA</span>
      <span style={{ opacity: 0.55, margin: "0 8px" }}>·</span>
      Expires May 15, 2026
      <span style={{ opacity: 0.55, margin: "0 8px" }}>·</span>
      <span style={{ color: "#FCA5A5", fontWeight: 600 }}>
        {daysLeft} {daysLeft === 1 ? "day" : "days"} left
      </span>
    </div>
  );
}

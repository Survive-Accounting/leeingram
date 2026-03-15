import { useState, useEffect } from "react";

export function DualClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (tz: string) =>
    now.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground leading-none">
      <span className="opacity-70">CST</span>
      <span className="text-foreground/80">{fmt("America/Chicago")}</span>
      <span className="opacity-30">|</span>
      <span className="opacity-70">PHT</span>
      <span className="text-foreground/80">{fmt("Asia/Manila")}</span>
    </div>
  );
}

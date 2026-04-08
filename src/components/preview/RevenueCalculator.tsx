import { useState } from "react";
import { ChevronRight } from "lucide-react";

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "16px 20px",
};
const muted: React.CSSProperties = { color: "rgba(255,255,255,0.4)", fontSize: 12 };
const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
};

function SubToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={card}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.4)" }}
        />
        <span className="text-[13px] font-semibold text-white">{title}</span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtDollar(n: number): string {
  return "$" + fmt(Math.round(n));
}

export default function RevenueCalculator() {
  const [campuses, setCampuses] = useState(400);
  const [studentsPerCampus, setStudentsPerCampus] = useState(150);
  const [conversion, setConversion] = useState(3);
  const [avgRevenue, setAvgRevenue] = useState(200);
  const [greekPct, setGreekPct] = useState(40);
  const [showMix, setShowMix] = useState(false);

  const tam = campuses * studentsPerCampus;
  const converted = Math.round(tam * (conversion / 100));
  const totalRevenue = converted * avgRevenue;
  const greekRev = Math.round(totalRevenue * (greekPct / 100));
  const singleRev = totalRevenue - greekRev;

  return (
    <div className="space-y-3">
      {/* Sub 1: Campuses */}
      <SubToggle title="Estimated Campuses We Can Target">
        <p className="text-white font-[800] text-[48px] leading-none">400+</p>
        <p className="text-[13px] text-white mt-2" style={{ opacity: 0.75 }}>
          Universities with rigorous accounting programs across the US
        </p>
        <p className="mt-2" style={muted}>Campus database will be built with VA support</p>
      </SubToggle>

      {/* Sub 2: Students */}
      <SubToggle title="Estimated Students We Can Target">
        <p className="text-[13px] mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          400 campuses × 150 avg students per campus
        </p>
        <p className="text-white font-[800] text-[36px] leading-none">60,000+</p>
        <p className="text-[13px] text-white mt-1" style={{ opacity: 0.75 }}>potential students</p>
        <p className="mt-3" style={muted}>Assumption: ~150 accounting students per campus (conservative)</p>
      </SubToggle>

      {/* Sub 3: Calculator */}
      <SubToggle title="Revenue Calculator">
        <div className="space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Campuses</label>
              <select value={campuses} onChange={e => setCampuses(Number(e.target.value))} style={selectStyle}>
                {[1, 5, 10, 25, 50, 100, 200, 400].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Students / Campus</label>
              <select value={studentsPerCampus} onChange={e => setStudentsPerCampus(Number(e.target.value))} style={selectStyle}>
                {[50, 100, 150, 200, 300].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Conversion %</label>
              <select value={conversion} onChange={e => setConversion(Number(e.target.value))} style={selectStyle}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Avg Revenue / Student</label>
              <select value={avgRevenue} onChange={e => setAvgRevenue(Number(e.target.value))} style={selectStyle}>
                {[50, 100, 200, 300, 400, 500].map(n => <option key={n} value={n}>${n}</option>)}
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex justify-between text-[12px] mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              <span>Total Addressable Students</span>
              <span>{fmt(tam)}</span>
            </div>
            <div className="flex justify-between text-[12px] mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
              <span>Converted Students</span>
              <span>{fmt(converted)}</span>
            </div>

            <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Total Potential Revenue</p>
            <p className="font-[800] text-[40px] leading-none text-white">
              <span style={{ color: "#CE1126" }}>$</span>{fmt(totalRevenue)}
            </p>
          </div>

          {/* Sales Mix Toggle */}
          <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              onClick={() => setShowMix(!showMix)}
              className="flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#3B82F6" }}
            >
              <ChevronRight
                className="h-3 w-3 transition-transform duration-200"
                style={{ transform: showMix ? "rotate(90deg)" : "rotate(0deg)" }}
              />
              See Sales Mix →
            </button>

            {showMix && (
              <div className="mt-4 space-y-4">
                {/* Greek slider */}
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>Greek Org Bulk Study Passes</span>
                    <span className="font-semibold text-white">{greekPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={greekPct}
                    onChange={e => setGreekPct(Number(e.target.value))}
                    className="w-full accent-[#CE1126]"
                    style={{ height: 4 }}
                  />
                </div>

                {/* Single slider */}
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>Single Student Study Passes</span>
                    <span className="font-semibold text-white">{100 - greekPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={100 - greekPct}
                    onChange={e => setGreekPct(100 - Number(e.target.value))}
                    className="w-full accent-[#CE1126]"
                    style={{ height: 4 }}
                  />
                </div>

                {/* Split display */}
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ ...card, padding: "12px 14px" }}>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Greek Org Revenue</p>
                    <p className="text-white font-bold text-[18px]">{fmtDollar(greekRev)}</p>
                  </div>
                  <div style={{ ...card, padding: "12px 14px" }}>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Single Student Revenue</p>
                    <p className="text-white font-bold text-[18px]">{fmtDollar(singleRev)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coming Soon items */}
          <div className="pt-3 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {["Actual Revenue", "Expense Estimator", "Actual Expenses", "Profit Estimator"].map(label => (
              <p key={label} className="text-[12px] italic" style={{ color: "rgba(255,255,255,0.3)" }}>
                {label} — <span style={{ color: "#F59E0B", fontStyle: "normal", fontSize: 10, fontWeight: 700 }}>Coming Soon</span>
              </p>
            ))}
          </div>
        </div>
      </SubToggle>
    </div>
  );
}

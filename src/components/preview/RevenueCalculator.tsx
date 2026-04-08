import { useState } from "react";
import { ChevronRight } from "lucide-react";

function SubToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-3 px-1"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span>
      </button>
      <div className="overflow-hidden transition-all duration-200" style={{ maxHeight: open ? 5000 : 0, opacity: open ? 1 : 0 }}>
        <div className="pl-6 pb-4">{children}</div>
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: { v: number; l: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded px-3 py-2 text-[12px] outline-none"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF" }}
    >
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

export default function RevenueCalculator() {
  const [campuses, setCampuses] = useState(10);
  const [spc, setSpc] = useState(150);
  const [conv, setConv] = useState(2);
  const [rev, setRev] = useState(200);
  const [greekPct, setGreekPct] = useState(60);
  const [showMix, setShowMix] = useState(false);

  const tam = campuses * spc;
  const converted = Math.round(tam * (conv / 100));
  const totalRev = converted * rev;
  const greekRev = Math.round(totalRev * (greekPct / 100));
  const singleRev = totalRev - greekRev;
  const fmt = (n: number) => "$" + n.toLocaleString();

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Campuses */}
      <SubToggle label="Estimated Campuses We Can Target">
        <p className="text-[48px] font-extrabold text-white leading-none mb-1" style={{ fontFamily: "Inter" }}>400+</p>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>Universities with rigorous accounting programs across the US</p>
        <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>Campus database will be built with VA support</p>
      </SubToggle>

      {/* Students */}
      <SubToggle label="Estimated Students We Can Target">
        <p className="text-[13px] mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>400 campuses × ~150 accounting students each</p>
        <p className="text-[36px] font-extrabold text-white leading-none" style={{ fontFamily: "Inter" }}>60,000+</p>
        <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>potential students</p>
        <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>Assumption: ~150 avg accounting students per campus</p>
      </SubToggle>

      {/* Calculator */}
      <SubToggle label="Revenue Calculator">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Campuses</label>
            <Select value={campuses} onChange={setCampuses} options={[1,5,10,25,50,100,200,400].map(v => ({ v, l: String(v) }))} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Students / Campus</label>
            <Select value={spc} onChange={setSpc} options={[50,100,150,200,300].map(v => ({ v, l: String(v) }))} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Conversion %</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={conv}
                onChange={e => {
                  let v = parseFloat(e.target.value);
                  if (isNaN(v)) v = 0.1;
                  if (v > 100) v = 100;
                  setConv(v);
                }}
                className="rounded px-3 py-2 text-[12px] outline-none w-[70px]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF" }}
              />
              <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>%</span>
            </div>
            {conv >= 100 && <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Max 100%</p>}
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Avg Annual Revenue / Student</label>
            <Select value={rev} onChange={setRev} options={[50,100,200,300,400,500].map(v => ({ v, l: `$${v}` }))} />
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>Total Addressable Students: <span className="text-white font-semibold">{tam.toLocaleString()}</span></p>
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>Converted Students: <span className="text-white font-semibold">{converted.toLocaleString()}</span></p>
        </div>

        <p className="text-[11px] uppercase font-bold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Total Annual Revenue Potential</p>
        <p className="text-[40px] font-extrabold leading-none" style={{ fontFamily: "Inter" }}>
          <span style={{ color: "#CE1126" }}>$</span>
          <span className="text-white">{totalRev.toLocaleString()}</span>
        </p>

        {/* Sales Mix */}
        <button
          onClick={() => setShowMix(!showMix)}
          className="flex items-center gap-1 mt-4 text-[12px] font-semibold"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#3B82F6" }}
        >
          <ChevronRight className="h-3 w-3 transition-transform duration-200" style={{ transform: showMix ? "rotate(90deg)" : "rotate(0deg)" }} />
          See Sales Mix →
        </button>
        <div className="overflow-hidden transition-all duration-200" style={{ maxHeight: showMix ? 500 : 0, opacity: showMix ? 1 : 0 }}>
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Greek Org Bulk Study Passes</span>
                <span className="font-bold text-white">{greekPct}%</span>
              </div>
              <input type="range" min={0} max={100} value={greekPct} onChange={e => setGreekPct(Number(e.target.value))} className="w-full accent-red-600" />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Single Student Study Passes</span>
                <span className="font-bold text-white">{100 - greekPct}%</span>
              </div>
              <input type="range" min={0} max={100} value={100 - greekPct} onChange={e => setGreekPct(100 - Number(e.target.value))} className="w-full accent-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] uppercase font-bold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Greek Org Revenue</p>
                <p className="text-[18px] font-bold text-white">{fmt(greekRev)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] uppercase font-bold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Single Student Revenue</p>
                <p className="text-[18px] font-bold text-white">{fmt(singleRev)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming soon placeholders */}
        <div className="mt-4 space-y-1.5">
          {["Actual Revenue", "Expense Estimator", "Actual Expenses", "Profit Estimator"].map((item) => (
            <p key={item} className="text-[11px] italic" style={{ color: "rgba(255,255,255,0.25)" }}>{item} — Coming Soon</p>
          ))}
        </div>
      </SubToggle>
    </div>
  );
}

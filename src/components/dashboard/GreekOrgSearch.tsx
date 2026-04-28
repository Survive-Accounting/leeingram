import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus } from "lucide-react";

interface GreekOrg {
  id: string;
  org_name: string;
  org_type: string | null;
  council: string | null;
}

interface Props {
  campusId: string | null;
  selectedOrgId: string | null;
  otherText: string;
  onSelect: (orgId: string | null) => void;
  onOtherChange: (text: string) => void;
}

export default function GreekOrgSearch({
  campusId,
  selectedOrgId,
  otherText,
  onSelect,
  onOtherChange,
}: Props) {
  const [orgs, setOrgs] = useState<GreekOrg[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOther, setShowOther] = useState(!!otherText);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("greek_orgs")
        .select("id, org_name, org_type, council")
        .order("org_name", { ascending: true })
        .limit(200);
      if (campusId) query = query.eq("campus_id", campusId);
      const { data } = await query;
      if (!cancelled) {
        setOrgs((data || []) as GreekOrg[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orgs;
    return orgs.filter((o) => o.org_name.toLowerCase().includes(s));
  }, [q, orgs]);

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
      >
        <Search className="h-4 w-4" style={{ color: "#94A3B8" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search fraternities & sororities…"
          className="flex-1 bg-transparent text-[14px] outline-none"
          style={{ color: "#14213D" }}
        />
      </div>

      <div
        className="max-h-44 overflow-y-auto rounded-lg"
        style={{ border: "1px solid #E5E7EB", background: "#fff" }}
      >
        {loading ? (
          <p className="text-[13px] text-center py-6" style={{ color: "#94A3B8" }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-center py-6" style={{ color: "#94A3B8" }}>
            No matches. Use “Add other” below.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "#F1F5F9" }}>
            {filtered.map((o) => {
              const active = o.id === selectedOrgId;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(o.id);
                      setShowOther(false);
                      onOtherChange("");
                    }}
                    className="w-full text-left px-3 py-2 text-[13.5px] transition-colors"
                    style={{
                      background: active ? "#EFF6FF" : "transparent",
                      color: "#14213D",
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {o.org_name}
                    {o.council && (
                      <span className="ml-2 text-[11px]" style={{ color: "#94A3B8" }}>
                        {o.council}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!showOther ? (
        <button
          type="button"
          onClick={() => {
            setShowOther(true);
            onSelect(null);
          }}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:underline"
          style={{ color: "#CE1126" }}
        >
          <Plus className="h-3.5 w-3.5" /> Add other
        </button>
      ) : (
        <input
          autoFocus
          value={otherText}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Enter organization name"
          className="w-full rounded-lg px-3 py-2 text-[14px] outline-none"
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            color: "#14213D",
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
  name: string | null;
  campusName?: string;
}

interface Purchase {
  course_slug: string | null;
  price_paid_cents: number | null;
  created_at: string;
  expires_at: string | null;
}

interface EventRow {
  created_at: string;
  event_type: string;
  event_data: any;
  course_slug: string | null;
  session_id: string | null;
  device_type: string | null;
  utm_source: string | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtTime = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDollars = (c: number) => `$${(c / 100).toFixed(2)}`;

const relativeTime = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const formatEvent = (ev: EventRow): string => {
  const d = ev.event_data || {};
  switch (ev.event_type) {
    case "page_view": return `Viewed ${d.page_name || "page"}`;
    case "chapter_preview": return `Previewed Chapter${d.chapter_name ? `: ${d.chapter_name}` : ""}`;
    case "asset_preview": return `Viewed problem ${d.asset_name || ""}`;
    case "paywall_hit": return `Hit paywall${ev.course_slug ? ` (${ev.course_slug})` : ""}`;
    case "email_captured": return "Email captured";
    case "purchase_completed": return "Purchased access";
    case "purchase_started": return "Started checkout";
    case "login": return "Logged in";
    case "magic_link_sent": return "Magic link sent";
    case "course_selected": return `Selected ${d.course_name || "course"}`;
    case "practice_browse": return "Browsed practice problems";
    case "cram_tool_view": return `Opened ${d.tool_type || "cram tool"}`;
    default: return ev.event_type.replace(/_/g, " ");
  }
};

export default function StudentDetailModal({ open, onClose, email, name, campusName }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState({ visits: 0, paywallHits: 0, chaptersViewed: 0, lastSeen: "" });
  const [meta, setMeta] = useState({ firstSeen: "", device: "—", referral: "Direct", sessions: 0 });

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const load = async () => {
      const [evRes, purchRes] = await Promise.all([
        (supabase as any).from("student_events").select("created_at, event_type, event_data, course_slug, session_id, device_type, utm_source").eq("email", email).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("student_purchases").select("course_slug, price_paid_cents, created_at, expires_at").eq("email", email).order("created_at", { ascending: false }),
      ]);

      const allEvents: EventRow[] = evRes.data ?? [];
      setEvents(allEvents.slice(0, 20));
      setPurchases(purchRes.data ?? []);

      // Stats
      const sessionIds = new Set(allEvents.map(e => e.session_id).filter(Boolean));
      const paywallHits = allEvents.filter(e => e.event_type === "paywall_hit").length;
      const chapterIds = new Set(allEvents.filter(e => e.event_type === "chapter_preview").map(e => e.event_data?.chapter_id).filter(Boolean));
      const lastSeen = allEvents[0]?.created_at || "";

      setStats({ visits: sessionIds.size, paywallHits, chaptersViewed: chapterIds.size, lastSeen });

      // Meta
      const firstSeen = allEvents.length > 0 ? allEvents[allEvents.length - 1].created_at : "";
      const deviceCounts: Record<string, number> = {};
      allEvents.forEach(e => { if (e.device_type) deviceCounts[e.device_type] = (deviceCounts[e.device_type] || 0) + 1; });
      const topDevice = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      const firstUtm = allEvents.find(e => e.utm_source)?.utm_source || "Direct";

      setMeta({ firstSeen, device: topDevice, referral: firstUtm, sessions: sessionIds.size });
      setLoading(false);
    };

    load();
  }, [open, email]);

  const activePurchase = purchases.find(p => p.expires_at && new Date(p.expires_at) > new Date());
  const status = activePurchase ? "Active" : purchases.length > 0 ? "Expired" : "Lead";
  const statusColor = status === "Active" ? "bg-green-600" : status === "Expired" ? "" : "bg-yellow-500";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 [&>button]:hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b">
          <div>
            <h2 className="text-base font-semibold">{email}</h2>
            {name && <p className="text-sm text-muted-foreground">{name}</p>}
          </div>
          <div className="flex items-center gap-2">
            {campusName && <Badge variant="outline" className="text-xs">{campusName}</Badge>}
            <Badge variant={status === "Expired" ? "secondary" : "default"} className={statusColor}>{status}</Badge>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : (
          <div className="p-5 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Visits", value: stats.visits },
                { label: "Last Seen", value: stats.lastSeen ? relativeTime(stats.lastSeen) : "—" },
                { label: "Paywall Hits", value: stats.paywallHits },
                { label: "Ch. Previewed", value: stats.chaptersViewed },
              ].map(s => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Purchase Info */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Purchase Info</h3>
              {purchases.length === 0 ? (
                <p className="text-xs text-muted-foreground">No purchase yet</p>
              ) : (
                <div className="space-y-2">
                  {purchases.map((p, i) => {
                    const isActive = p.expires_at && new Date(p.expires_at) > new Date();
                    return (
                      <div key={i} className="rounded-lg border p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{p.course_slug || "—"}</span>
                          <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-600 text-[10px]" : "text-[10px]"}>
                            {isActive ? "Active" : "Expired"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {p.price_paid_cents != null ? fmtDollars(p.price_paid_cents) : "—"} · Purchased {fmtDate(p.created_at)}
                          {p.expires_at && ` · Expires ${fmtDate(p.expires_at)}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            {events.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Recent Activity</h3>
                <div className="space-y-2">
                  {events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground">{formatEvent(ev)}</p>
                        <p className="text-muted-foreground">{fmtTime(ev.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs text-muted-foreground">First seen: {meta.firstSeen ? fmtDate(meta.firstSeen) : "—"}</p>
              <p className="text-xs text-muted-foreground">Device: {meta.device}</p>
              <p className="text-xs text-muted-foreground">Referral: {meta.referral}</p>
              <p className="text-xs text-muted-foreground">Sessions: {meta.sessions}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

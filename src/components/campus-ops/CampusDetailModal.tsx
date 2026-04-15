import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface CampusDetailModalProps {
  open: boolean;
  onClose: () => void;
  campusId: string;
  campusName: string;
  campusSlug: string;
  domains: string[];
  isActive: boolean;
  createdAt: string;
}

interface CourseCode {
  course_name: string;
  local_course_code: string | null;
}

interface RecentEvent {
  created_at: string;
  event_type: string;
  email: string | null;
}

export default function CampusDetailModal({
  open, onClose, campusId, campusName, campusSlug, domains, isActive, createdAt,
}: CampusDetailModalProps) {
  const [studentCount, setStudentCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [revenueCents, setRevenueCents] = useState(0);
  const [leadCount, setLeadCount] = useState(0);
  const [courseCodes, setCourseCodes] = useState<CourseCode[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const load = async () => {
      // All queries in parallel
      const [studentsRes, purchasesRes, eventsRes, codesRes, recentRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("campus_id", campusId),
        (supabase as any).from("student_purchases").select("id, price_paid_cents").eq("campus_id", campusId),
        (supabase as any).from("student_events").select("email", { count: "exact", head: true }).eq("campus_id", campusId).eq("event_type", "email_captured"),
        (supabase as any).from("campus_courses").select("local_course_code, courses(name)").eq("campus_id", campusId).order("display_order"),
        (supabase as any).from("student_events").select("created_at, event_type, email").eq("campus_id", campusId).order("created_at", { ascending: false }).limit(5),
      ]);

      setStudentCount(studentsRes.count ?? 0);

      const purchases = purchasesRes.data ?? [];
      setPurchaseCount(purchases.length);
      setRevenueCents(purchases.reduce((sum: number, p: any) => sum + (p.price_paid_cents ?? 0), 0));

      setLeadCount(eventsRes.count ?? 0);

      setCourseCodes(
        (codesRes.data ?? []).map((r: any) => ({
          course_name: r.courses?.name ?? "Unknown",
          local_course_code: r.local_course_code,
        }))
      );

      setRecentEvents(recentRes.data ?? []);
      setLoading(false);
    };

    load();
  }, [open, campusId]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtDollars = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 [&>button]:hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b">
          <div>
            <h2 className="text-lg font-semibold">{campusName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{campusSlug}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-600" : ""}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : (
          <div className="p-5 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Students", value: studentCount },
                { label: "Leads", value: leadCount },
                { label: "Purchases", value: purchaseCount },
                { label: "Revenue", value: fmtDollars(revenueCents) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Course Codes */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Course Codes at This Campus</h3>
              {courseCodes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No course codes configured</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium text-xs">Our Course</th>
                        <th className="px-3 py-2 font-medium text-xs">Their Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseCodes.map((cc, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-xs">{cc.course_name}</td>
                          <td className="px-3 py-2 text-xs font-mono">{cc.local_course_code || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Domains */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Email Domains</h3>
              {!domains || domains.length === 0 ? (
                <p className="text-xs text-muted-foreground">No domains configured</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {domains.map((d) => (
                    <span key={d} className="inline-block rounded-full px-3 py-1 text-xs font-mono bg-muted border">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold mb-2">Details</h3>
              <p className="text-xs text-muted-foreground">Created: {fmtDate(createdAt)}</p>
              <p className="text-xs text-muted-foreground">Slug: <span className="font-mono">{campusSlug}</span></p>
            </div>

            {/* Recent Activity */}
            {recentEvents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Recent Activity</h3>
                <div className="space-y-1.5">
                  {recentEvents.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{ev.event_type}</span>
                      <span className="truncate max-w-[140px] mx-2">{ev.email || "—"}</span>
                      <span className="whitespace-nowrap">{fmtDate(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

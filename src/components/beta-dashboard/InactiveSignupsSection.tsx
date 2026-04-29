import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, MailOpen } from "lucide-react";
import { toast } from "sonner";
import type { SignupRow } from "./SignupsTable";

const NAVY = "#14213D";
const RED = "#CE1126";
const REVIEWED_KEY = "beta_inactive_reviewed_v1";

type Stage =
  | "never_logged_in"
  | "no_dashboard"
  | "no_chapter"
  | "no_helper"
  | "no_action"
  | "engaged";

const STAGE_META: Record<Exclude<Stage, "engaged">, { label: string; followUp: string; tone: string }> = {
  never_logged_in: {
    label: "Signed up, never logged in",
    followUp: "Needs welcome/reminder email",
    tone: "#DC2626",
  },
  no_dashboard: {
    label: "Logged in, never viewed dashboard",
    followUp: "Possibly access/login issue",
    tone: "#EA580C",
  },
  no_chapter: {
    label: "Viewed dashboard, no chapter",
    followUp: "May not know which chapter to choose",
    tone: "#D97706",
  },
  no_helper: {
    label: "Selected chapter, no helper opened",
    followUp: "May be confused by dashboard",
    tone: "#0891B2",
  },
  no_action: {
    label: "Opened helper, no guided action",
    followUp: "May be confused by helper UI",
    tone: "#7C3AED",
  },
};

function getStage(s: SignupRow): Stage {
  const r = s as any;
  if (!r.lastLoginAt && !r.logins) return "never_logged_in";
  if (!r.viewedDashboard) return "no_dashboard";
  if (!r.selectedChapter) return "no_chapter";
  if (!r.openedHelper) return "no_helper";
  if (!r.clickedHelperAction) return "no_action";
  return "engaged";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function loadReviewed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function saveReviewed(set: Set<string>) {
  localStorage.setItem(REVIEWED_KEY, JSON.stringify(Array.from(set)));
}

export function InactiveSignupsSection({ signups }: { signups: SignupRow[] }) {
  const [reviewed, setReviewed] = useState<Set<string>>(() => loadReviewed());
  const [stageFilter, setStageFilter] = useState<string>("all_inactive");
  const [search, setSearch] = useState("");
  const [showReviewed, setShowReviewed] = useState(false);

  useEffect(() => { saveReviewed(reviewed); }, [reviewed]);

  const rows = useMemo(() => {
    return signups
      .map(s => ({ ...s, _stage: getStage(s) as Stage }))
      .filter(s => s._stage !== "engaged");
  }, [signups]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      never_logged_in: 0, no_dashboard: 0, no_chapter: 0, no_helper: 0, no_action: 0,
    };
    rows.forEach(r => { c[r._stage] = (c[r._stage] ?? 0) + 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const key = (r as any).userId || (r.email ?? "");
      const isReviewed = reviewed.has(key);
      if (!showReviewed && isReviewed) return false;
      if (stageFilter !== "all_inactive" && r._stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(r.email ?? "").toLowerCase().includes(q) &&
            !((r as any).displayName ?? "").toLowerCase().includes(q) &&
            !((r as any).campusName ?? "").toLowerCase().includes(q) &&
            !((r as any).courseName ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, stageFilter, search, reviewed, showReviewed]);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error("Copy failed"); }
  };

  const toggleReviewed = (key: string) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <MailOpen className="h-5 w-5" /> Inactive Signups
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Beta users who signed up but stalled before reaching meaningful engagement.
              Reporting only — no emails sent from this page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search email, name, campus, course…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-[260px] h-9"
            />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_inactive">All inactive ({rows.length})</SelectItem>
                {(Object.keys(STAGE_META) as Array<keyof typeof STAGE_META>).map(k => (
                  <SelectItem key={k} value={k}>{STAGE_META[k].label} ({counts[k] ?? 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={showReviewed ? "default" : "outline"}
              onClick={() => setShowReviewed(v => !v)}
            >
              {showReviewed ? "Hide reviewed" : "Show reviewed"}
            </Button>
          </div>
        </div>

        {/* Stage summary chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(STAGE_META) as Array<keyof typeof STAGE_META>).map(k => (
            <button
              key={k}
              onClick={() => setStageFilter(k)}
              className="rounded-md border px-2.5 py-1 text-[11px] hover:bg-muted/50 transition"
              style={{
                borderColor: stageFilter === k ? STAGE_META[k].tone : undefined,
                color: STAGE_META[k].tone,
              }}
            >
              <span className="font-semibold">{counts[k] ?? 0}</span>
              <span className="ml-1 text-foreground/70">{STAGE_META[k].label}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No inactive signups match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2">Email / Name</th>
                  <th className="py-2 pr-2">Signed up</th>
                  <th className="py-2 pr-2">Last login</th>
                  <th className="py-2 pr-2">Last activity</th>
                  <th className="py-2 pr-2">Course</th>
                  <th className="py-2 pr-2">Campus</th>
                  <th className="py-2 pr-2">Funnel stage</th>
                  <th className="py-2 pr-2">Suggested follow-up</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const meta = STAGE_META[r._stage as keyof typeof STAGE_META];
                  const key = (r as any).userId || (r.email ?? "");
                  const isReviewed = reviewed.has(key);
                  const note = `${meta.followUp} — ${r.email ?? "(no email)"} · signed up ${fmtDate((r as any).createdAt)} · stage: ${meta.label}`;
                  return (
                    <tr
                      key={key}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                      style={isReviewed ? { opacity: 0.45 } : undefined}
                    >
                      <td className="py-2 pr-2">
                        <div className="font-medium" style={{ color: NAVY }}>
                          {r.email ?? <span className="italic text-muted-foreground">no email</span>}
                        </div>
                        {(r as any).displayName && (
                          <div className="text-[11px] text-muted-foreground">{(r as any).displayName}</div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs">{fmtDate((r as any).createdAt)}</td>
                      <td className="py-2 pr-2 text-xs">{fmtDate((r as any).lastLoginAt)}</td>
                      <td className="py-2 pr-2 text-xs">{fmtDate((r as any).lastEventAt)}</td>
                      <td className="py-2 pr-2 text-xs">
                        {(r as any).courseCode ?? (r as any).courseName ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-xs">{(r as any).campusName ?? "—"}</td>
                      <td className="py-2 pr-2">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: meta.tone, color: meta.tone }}
                        >
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2 text-xs">{meta.followUp}</td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={!r.email}
                          onClick={() => copy(r.email ?? "", "Email")}
                          title="Copy email"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => copy(note, "Follow-up note")}
                          title="Copy follow-up note"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          <span className="text-[10px]">Note</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={isReviewed ? "default" : "outline"}
                          className="h-7 px-2 ml-1"
                          onClick={() => toggleReviewed(key)}
                          style={isReviewed ? { background: NAVY, color: "white" } : undefined}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          <span className="text-[10px]">{isReviewed ? "Reviewed" : "Mark"}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          Reviewed status is stored locally in your browser. {reviewed.size} marked reviewed.
        </p>
      </CardContent>
    </Card>
  );
}

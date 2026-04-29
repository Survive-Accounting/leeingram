import { Fragment, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Download, ChevronDown, ChevronRight } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

export interface SignupRow {
  userId: string | null;
  email: string;
  displayName: string | null;
  campusId: string | null;
  campusName: string | null;
  campusSlug: string | null;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
  courseSlug: string | null;
  betaNumber: number | null;
  campusBetaNumber: number | null;
  confidence: number | null;
  greek: string | null;
  hasSyllabus: boolean;
  welcomedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastEventAt: string | null;
  logins: number;
  toolOpens: number;
  helperClicks: number;
  totalEvents: number;
  paid: boolean;
  purchaseType: string | null;
  pricePaidCents: number | null;
  purchasedAt: string | null;
}

type SortKey = "created" | "logins" | "events" | "tools" | "lastLogin";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtRel(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function toCSV(rows: SignupRow[]): string {
  const headers = [
    "beta_number", "email", "name", "campus", "course", "course_code",
    "signed_up", "last_login", "logins", "tool_opens", "helper_clicks",
    "total_events", "paid", "purchase_type", "price_cents", "confidence",
    "greek", "syllabus", "welcomed_at",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.betaNumber ?? "",
      r.email,
      r.displayName ?? "",
      r.campusName ?? "",
      r.courseName ?? "",
      r.courseCode ?? "",
      r.createdAt,
      r.lastLoginAt ?? "",
      r.logins,
      r.toolOpens,
      r.helperClicks,
      r.totalEvents,
      r.paid ? "yes" : "no",
      r.purchaseType ?? "",
      r.pricePaidCents ?? "",
      r.confidence ?? "",
      r.greek ?? "",
      r.hasSyllabus ? "yes" : "no",
      r.welcomedAt ?? "",
    ];
    lines.push(cells.map(c => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
  return lines.join("\n");
}

export function SignupsTable({ signups, loading }: { signups: SignupRow[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 50;

  const campuses = useMemo(() => {
    const set = new Map<string, string>();
    signups.forEach(s => { if (s.campusName) set.set(s.campusName, s.campusName); });
    return Array.from(set.values()).sort();
  }, [signups]);

  const filtered = useMemo(() => {
    let rows = signups.filter(s => {
      if (campusFilter !== "all" && s.campusName !== campusFilter) return false;
      if (paidFilter === "paid" && !s.paid) return false;
      if (paidFilter === "unpaid" && s.paid) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.email} ${s.displayName ?? ""} ${s.campusName ?? ""} ${s.courseName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "logins": return b.logins - a.logins;
        case "events": return b.totalEvents - a.totalEvents;
        case "tools": return b.toolOpens - a.toolOpens;
        case "lastLogin": {
          const at = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
          const bt = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
          return bt - at;
        }
        case "created":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return rows;
  }, [signups, search, campusFilter, paidFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const paidCount = filtered.filter(s => s.paid).length;
  const activeCount = filtered.filter(s => s.totalEvents > 0).length;

  const downloadCSV = () => {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beta-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (email: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Student Signups</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {signups.length} signups · {paidCount} paid · {activeCount} active
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search email, name, campus…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-[240px] h-9"
            />
            <Select value={campusFilter} onValueChange={(v) => { setCampusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Campus" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campuses</SelectItem>
                {campuses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paidFilter} onValueChange={(v) => { setPaidFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid only</SelectItem>
                <SelectItem value="unpaid">Unpaid only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Sort: Newest</SelectItem>
                <SelectItem value="lastLogin">Sort: Last login</SelectItem>
                <SelectItem value="logins">Sort: Logins</SelectItem>
                <SelectItem value="events">Sort: Total events</SelectItem>
                <SelectItem value="tools">Sort: Tool opens</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={downloadCSV} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 w-6"></th>
                <th className="py-2 pr-2 w-10">#</th>
                <th className="py-2 pr-2">Student</th>
                <th className="py-2 pr-2">Campus</th>
                <th className="py-2 pr-2">Course</th>
                <th className="py-2 pr-2">Signed up</th>
                <th className="py-2 pr-2">Last login</th>
                <th className="py-2 pr-2 text-right">Logins</th>
                <th className="py-2 pr-2 text-right">Tools</th>
                <th className="py-2 pr-2 text-right">Helper</th>
                <th className="py-2 pr-2 text-center">Paid</th>
                <th className="py-2 pr-2 text-center">Conf</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={12} className="py-6 text-center text-muted-foreground italic">No signups match your filters.</td></tr>
              ) : pageRows.map(s => {
                const isOpen = expanded.has(s.email);
                const isGhost = s.totalEvents === 0;
                return (
                  <Fragment key={s.email}>
                    <tr
                      className={`border-b hover:bg-muted/40 cursor-pointer ${isGhost ? "opacity-70" : ""}`}
                      onClick={() => toggle(s.email)}
                    >
                      <td className="py-2 pr-2">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{s.betaNumber ?? "—"}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium" style={{ color: NAVY }}>{s.displayName ?? s.email.split("@")[0]}</div>
                        <div className="text-[11px] text-muted-foreground">{s.email}</div>
                      </td>
                      <td className="py-2 pr-2 text-xs">{s.campusName ?? "—"}</td>
                      <td className="py-2 pr-2 text-xs">
                        {s.courseCode || s.courseName ? (
                          <Badge variant="outline" className="text-[10px]">
                            {s.courseCode ?? s.courseName}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-xs" title={s.createdAt}>{fmtDate(s.createdAt)}</td>
                      <td className="py-2 pr-2 text-xs" title={s.lastLoginAt ?? ""}>{fmtRel(s.lastLoginAt)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{s.logins}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{s.toolOpens}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{s.helperClicks}</td>
                      <td className="py-2 pr-2 text-center">
                        {s.paid ? (
                          <span title={`${s.purchaseType ?? ""} · $${((s.pricePaidCents ?? 0) / 100).toFixed(0)}`}>
                            <Check className="h-4 w-4 inline" style={{ color: "#16A34A" }} />
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {s.confidence != null ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: NAVY, color: "white" }}>
                            {s.confidence}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${s.email}-detail`} className="border-b bg-muted/20">
                        <td colSpan={12} className="py-3 px-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <Detail label="Beta #" value={`Global ${s.betaNumber ?? "—"} · Campus ${s.campusBetaNumber ?? "—"}`} />
                            <Detail label="Greek life" value={s.greek ?? "no"} />
                            <Detail label="Syllabus on file" value={s.hasSyllabus ? "yes" : "no"} />
                            <Detail label="Onboarding completed" value={s.completedAt ? fmtDate(s.completedAt) : "no"} />
                            <Detail label="Welcomed at" value={s.welcomedAt ? fmtDate(s.welcomedAt) : "—"} />
                            <Detail label="Last activity" value={fmtRel(s.lastEventAt)} />
                            <Detail label="Total events" value={String(s.totalEvents)} />
                            <Detail
                              label="Purchase"
                              value={
                                s.paid
                                  ? `${s.purchaseType ?? "paid"} · $${((s.pricePaidCents ?? 0) / 100).toFixed(0)} · ${fmtDate(s.purchasedAt)}`
                                  : "—"
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                style={{ background: page < totalPages - 1 ? RED : undefined, color: page < totalPages - 1 ? "white" : undefined, borderColor: "transparent" }}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}

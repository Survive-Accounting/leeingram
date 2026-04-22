import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { AccessRestrictedGuard } from "@/components/AccessRestrictedGuard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Sparkles, Video, Share2, DollarSign, Clock, Flame, Star, Crown,
  TrendingUp, Eye, ThumbsUp, ThumbsDown, ExternalLink, Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Mock data badge ──────────────────────────────────────────────
const MockBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide",
      "bg-amber-100 text-amber-800 border border-amber-200",
      className,
    )}
  >
    Mock Data
  </span>
);

// ─── KPI Card ─────────────────────────────────────────────────────
function KpiCard({
  label, value, hint, icon: Icon,
}: { label: string; value: string; hint?: string; icon?: any }) {
  return (
    <Card className="p-4 relative">
      <MockBadge className="absolute top-2 right-2" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

// ─── Section header ───────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between mb-3 mt-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <MockBadge />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 1 — SURVIVE THIS
// ════════════════════════════════════════════════════════════════
function SurviveThisTab() {
  const topResponses = [
    { problem: "E13.1", type: "Survive This Problem", uses: 47, helpful: 94, chapter: "Ch 13" },
    { problem: "BE14.3", type: "Survive These Instructions", uses: 38, helpful: 87, chapter: "Ch 14" },
    { problem: "P15.2", type: "Survive This JE", uses: 31, helpful: 91, chapter: "Ch 15" },
    { problem: "E16.7", type: "Survive This Problem", uses: 28, helpful: 78, chapter: "Ch 16" },
    { problem: "BE13.5", type: "Survive These Instructions", uses: 24, helpful: 95, chapter: "Ch 13" },
  ];

  const notHelpful = [
    { problem: "E17.3", type: "Survive This Problem", date: "Apr 20", videoRequested: true },
    { problem: "BE18.1", type: "Survive This JE", date: "Apr 19", videoRequested: false },
    { problem: "P16.4", type: "Survive These Instructions", date: "Apr 18", videoRequested: true },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Total AI responses generated" value="847" icon={Sparkles} />
        <KpiCard label="Cached responses (reused)" value="1,203" icon={TrendingUp} />
        <KpiCard label="Helpful ratings" value="89%" icon={ThumbsUp} />
        <KpiCard label="Not helpful ratings" value="11%" icon={ThumbsDown} />
      </div>

      <SectionHeader title="Most used AI responses" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Problem</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Uses</th>
              <th className="px-3 py-2">Helpful %</th>
              <th className="px-3 py-2">Chapter</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {topResponses.map((r) => (
              <tr key={r.problem} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 font-mono text-foreground">{r.problem}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
                <td className="px-3 py-2 font-semibold text-foreground">{r.uses}</td>
                <td className="px-3 py-2">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium",
                    r.helpful >= 90 ? "bg-emerald-100 text-emerald-800" :
                    r.helpful >= 80 ? "bg-amber-100 text-amber-800" :
                    "bg-rose-100 text-rose-800",
                  )}>
                    {r.helpful}%
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.chapter}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionHeader title="Recent not-helpful ratings" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Problem</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Auto-linked to video request?</th>
            </tr>
          </thead>
          <tbody>
            {notHelpful.map((r) => (
              <tr key={r.problem} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 font-mono text-foreground">{r.problem}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                <td className="px-3 py-2">
                  {r.videoRequested ? (
                    <span className="text-emerald-700 text-xs font-medium">
                      Yes → video requested
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionHeader title="Token usage this month" />
      <Card className="p-4 bg-muted/30 relative">
        <MockBadge className="absolute top-2 right-2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Input tokens</div>
            <div className="font-semibold text-foreground">2,847,392</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Output tokens</div>
            <div className="font-semibold text-foreground">1,203,847</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Estimated cost</div>
            <div className="font-semibold text-foreground">$4.23</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Model</div>
            <div className="font-semibold text-foreground">o3</div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          * Mock data — will populate when live
        </p>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 2 — VIDEO QUEUE
// ════════════════════════════════════════════════════════════════
type VideoRow = {
  id: string;
  problem: string;
  question: string;
  upvotes: number;
  major: boolean;
  priority: boolean;
  status: "Pending" | "In Progress" | "Slayer 🔥";
  date: string;
  passesSent?: number;
};

function VideoQueueTab() {
  const [rows, setRows] = useState<VideoRow[]>([
    { id: "1", problem: "E13.9", question: "I don't understand why we use the effective interest method instead of straight-line here", upvotes: 23, major: true, priority: true, status: "Pending", date: "Apr 19" },
    { id: "2", problem: "P15.3", question: "How do I know which EPS calculation to use?", upvotes: 18, major: true, priority: false, status: "In Progress", date: "Apr 20" },
    { id: "3", problem: "BE14.1", question: "The treasury stock method makes no sense to me", upvotes: 12, major: false, priority: false, status: "Pending", date: "Apr 18" },
    { id: "4", problem: "E16.4", question: "When do we use the equity method vs fair value?", upvotes: 7, major: true, priority: false, status: "Pending", date: "Apr 20" },
    { id: "5", problem: "BE13.2", question: "What's the difference between stated and effective rate?", upvotes: 3, major: false, priority: false, status: "Pending", date: "Apr 17" },
  ]);

  const [slayerTarget, setSlayerTarget] = useState<VideoRow | null>(null);

  const sorted = [...rows].sort((a, b) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    if (a.major !== b.major) return a.major ? -1 : 1;
    return 0;
  });

  const confirmSlayer = () => {
    if (!slayerTarget) return;
    const upvotes = slayerTarget.upvotes;
    setRows((prev) =>
      prev.map((r) =>
        r.id === slayerTarget.id ? { ...r, status: "Slayer 🔥", passesSent: upvotes } : r,
      ),
    );
    toast.success(`Slayer marked — ${upvotes} passes sent 🔥`);
    setSlayerTarget(null);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Total requests" value="47" icon={Video} />
        <KpiCard label="Accounting majors" value="31" icon={Star} />
        <KpiCard label="Upvotes total" value="203" icon={ThumbsUp} />
        <KpiCard label="Videos recorded" value="8" icon={Crown} />
      </div>

      <SectionHeader title="Video request queue" subtitle="Sorted by upvotes (DESC), then accounting major flag." />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Problem</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Upvotes</th>
              <th className="px-3 py-2">Major?</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0 align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {r.upvotes > 10 && <span title="Hot" className="text-orange-500">🔥</span>}
                    {r.major && <span title="Accounting major" className="text-amber-500">⭐</span>}
                    {r.priority && <span title="Priority $15" className="text-emerald-500">💰</span>}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-foreground">{r.problem}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[280px]">
                  <span className="line-clamp-2">"{r.question}"</span>
                </td>
                <td className="px-3 py-2 font-semibold text-foreground">{r.upvotes}</td>
                <td className="px-3 py-2">
                  {r.major ? (
                    <span className="text-emerald-700 text-xs">✓ Major</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">✗</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={r.status === "Slayer 🔥" ? "default" : "outline"} className="text-[10px]">
                    {r.status}
                    {r.passesSent != null && ` (${r.passesSent} sent)`}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{r.date}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {r.status !== "In Progress" && r.status !== "Slayer 🔥" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Record Answer
                      </Button>
                    )}
                    {r.status !== "Slayer 🔥" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => setSlayerTarget(r)}
                      >
                        <Flame className="h-3 w-3 mr-1" /> Mark Slayer
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs">Skip</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!slayerTarget} onOpenChange={(v) => !v && setSlayerTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" /> Mark this answer as a Slayer? 🔥
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will notify all <strong>{slayerTarget?.upvotes ?? 0}</strong> students who upvoted
            and send them a shareable 2-hour pass.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlayerTarget(null)}>Cancel</Button>
            <Button
              onClick={confirmSlayer}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Confirm — Send Passes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 3 — VIRAL PASSES
// ════════════════════════════════════════════════════════════════
function ViralPassesTab() {
  const funnel = [
    { label: "Passes sent", value: 156, pct: 100 },
    { label: "Opened", value: 89, pct: 57 },
    { label: "Started trial", value: 51, pct: 33 },
    { label: "Converted within 2hrs", value: 12, pct: 8 },
    { label: "Converted within 48hrs", value: 31, pct: 20 },
    { label: "Converted later", value: 8, pct: 5 },
    { label: "Did not convert", value: 100, pct: 64 },
  ];

  const slayerVideos = [
    { title: "Bond Discount Amortization", problem: "E13.9", passes: 47, openRate: 72, convRate: 28, date: "Apr 15" },
    { title: "Treasury Stock Explained", problem: "P14.2", passes: 61, openRate: 81, convRate: 34, date: "Apr 10" },
    { title: "EPS Diluted Walkthrough", problem: "E15.3", passes: 48, openRate: 61, convRate: 22, date: "Apr 8" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Passes sent" value="156" icon={Share2} />
        <KpiCard label="Passes opened" value="89" icon={Eye} />
        <KpiCard label="Converted within 2hrs" value="12" />
        <KpiCard label="Converted within 48hrs" value="31" />
        <KpiCard label="Converted after 48hrs" value="8" />
      </div>

      <SectionHeader title="Conversion funnel" />
      <Card className="p-4 relative">
        <MockBadge className="absolute top-2 right-2" />
        <div className="space-y-2 mt-2">
          {funnel.map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-semibold text-foreground">
                  {f.value.toLocaleString()} <span className="text-muted-foreground font-normal">({f.pct}%)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    f.label === "Did not convert" ? "bg-muted-foreground/40" : "bg-primary",
                  )}
                  style={{ width: `${Math.max(2, f.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SectionHeader title="Videos that triggered passes" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Video</th>
              <th className="px-3 py-2">Problem</th>
              <th className="px-3 py-2">Passes Sent</th>
              <th className="px-3 py-2">Open Rate</th>
              <th className="px-3 py-2">Conversion Rate</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {slayerVideos.map((v) => (
              <tr key={v.title} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 text-foreground font-medium">{v.title}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{v.problem}</td>
                <td className="px-3 py-2 font-semibold text-foreground">{v.passes}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.openRate}%</td>
                <td className="px-3 py-2 text-emerald-700 font-medium">{v.convRate}%</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{v.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 4 — AFFILIATE
// ════════════════════════════════════════════════════════════════
function AffiliateTab() {
  const referrers = [
    { email: "sarah.j@olemiss.edu", referrals: 4, revenue: 500, balance: 250, status: "Not yet notified", joined: "Feb 2026" },
    { email: "mike.t@olemiss.edu", referrals: 3, revenue: 375, balance: 187, status: "Not yet notified", joined: "Mar 2026" },
    { email: "ashley.r@olemiss.edu", referrals: 2, revenue: 250, balance: 125, status: "Not yet notified", joined: "Mar 2026" },
    { email: "jake.m@olemiss.edu", referrals: 1, revenue: 125, balance: 62, status: "Not yet notified", joined: "Apr 2026" },
  ];

  return (
    <div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-900">
        🚧 <strong>Affiliate payouts not yet active.</strong> Tracking referrals silently. Balances accumulating.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Students tracked as referrers" value="23" icon={Users} />
        <KpiCard label="Total revenue attributed" value="$1,840" icon={DollarSign} />
        <KpiCard label="Balances accumulated" value="$920" hint="50% of attributed revenue" icon={DollarSign} />
      </div>

      <SectionHeader title="Referrer leaderboard" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Referrals</th>
              <th className="px-3 py-2">Revenue Generated</th>
              <th className="px-3 py-2">Balance</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {referrers.map((r) => (
              <tr key={r.email} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 text-foreground">{r.email}</td>
                <td className="px-3 py-2 font-semibold text-foreground">{r.referrals}</td>
                <td className="px-3 py-2 text-muted-foreground">${r.revenue}</td>
                <td className="px-3 py-2 text-emerald-700 font-medium">${r.balance}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{r.status}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{r.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex items-center gap-3">
        <Button disabled className="opacity-60 cursor-not-allowed">
          Notify All When Ready
        </Button>
        <span className="text-xs text-muted-foreground">
          Activate when affiliate program launches
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 5 — PRIORITY QUEUE
// ════════════════════════════════════════════════════════════════
function PriorityQueueTab() {
  const [clockedIn, setClockedIn] = useState(false);
  const [cutoff, setCutoff] = useState("14:00");
  const [price, setPrice] = useState(15);
  const [editingPrice, setEditingPrice] = useState(false);
  const [tmpPrice, setTmpPrice] = useState("15");
  const [clockInTime, setClockInTime] = useState<string | null>(null);

  const handleToggle = (next: boolean) => {
    setClockedIn(next);
    if (next) {
      const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setClockInTime(t);
      toast.success("Clocked in — priority queue is live 🟢");
    } else {
      setClockInTime(null);
      toast.info("Clocked out — priority queue hidden");
    }
  };

  const submissions = [
    { email: "student1@olemiss.edu", problem: "E13.9", question: "Why effective interest?", paidAt: "2:34 PM", status: "Answered ✓" },
    { email: "student2@olemiss.edu", problem: "P15.2", question: "EPS diluted shares help", paidAt: "1:47 PM", status: "In Progress" },
  ];

  return (
    <div>
      {/* Clock In/Out toggle — large, centered */}
      <Card className={cn(
        "p-6 flex flex-col items-center text-center transition-colors",
        clockedIn ? "border-emerald-300 bg-emerald-50/40" : "border-border bg-muted/20",
      )}>
        <div className="flex items-center gap-3 mb-3">
          <Switch checked={clockedIn} onCheckedChange={handleToggle} />
          <span className={cn(
            "text-sm font-semibold",
            clockedIn ? "text-emerald-700" : "text-muted-foreground",
          )}>
            {clockedIn ? "🟢 You are live" : "You are clocked out"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {clockedIn
            ? "Students can see priority queue"
            : "Priority queue hidden from students"}
        </p>
        {!clockedIn && (
          <Button
            onClick={() => handleToggle(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Clock In →
          </Button>
        )}

        {clockedIn && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">Submit by:</span>
            <Input
              type="time"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="h-8 w-28 text-sm"
            />
            <span className="text-[11px] text-muted-foreground">
              Today's cutoff: {new Date(`2025-01-01T${cutoff}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        )}
      </Card>

      {clockedIn && (
        <>
          <SectionHeader title="Today's session stats" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Clocked in at" value={clockInTime ?? "—"} icon={Clock} />
            <KpiCard label="Priority submissions today" value="3" icon={DollarSign} />
            <KpiCard label="Revenue today" value="$45" icon={DollarSign} />
            <KpiCard label="Avg response time" value="47 min" icon={Clock} />
          </div>

          <SectionHeader title="Priority submissions" subtitle={`Today's $${price} submissions`} />
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Problem</th>
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2">Paid At</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.email} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-foreground">{s.email}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{s.problem}</td>
                    <td className="px-3 py-2 text-muted-foreground">"{s.question}"</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.paidAt}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" /> View Question
                      </Button>
                      {s.status === "In Progress" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs ml-1">
                          Mark Done
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Pricing control */}
      <SectionHeader title="Pricing control" />
      <Card className="p-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Priority submission price:</span>
        {editingPrice ? (
          <>
            <span className="text-foreground">$</span>
            <Input
              type="number"
              min={1}
              value={tmpPrice}
              onChange={(e) => setTmpPrice(e.target.value)}
              className="h-8 w-24"
            />
            <Button
              size="sm"
              onClick={() => {
                const n = Math.max(1, Number(tmpPrice) || price);
                setPrice(n);
                setEditingPrice(false);
                toast.success(`Price updated to $${n}`);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditingPrice(false); setTmpPrice(String(price)); }}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className="text-base font-bold text-foreground">${price}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingPrice(true)}>
              <Edit3 className="h-3 w-3 mr-1" /> Edit price
            </Button>
          </>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground mt-4 italic">
        Priority queue only appears to students when you are clocked in.
        Clock out when done for the day.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════
export default function AIFeatures() {
  const [tab, setTab] = useState("survive");

  return (
    <AccessRestrictedGuard>
      <SurviveSidebarLayout>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-amber-500" />
                AI Features
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Survive AI platform controls and analytics.
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="survive">Survive This</TabsTrigger>
              <TabsTrigger value="video">Video Queue</TabsTrigger>
              <TabsTrigger value="viral">Viral Passes</TabsTrigger>
              <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
              <TabsTrigger value="priority">Priority Queue</TabsTrigger>
            </TabsList>

            <TabsContent value="survive"><SurviveThisTab /></TabsContent>
            <TabsContent value="video"><VideoQueueTab /></TabsContent>
            <TabsContent value="viral"><ViralPassesTab /></TabsContent>
            <TabsContent value="affiliate"><AffiliateTab /></TabsContent>
            <TabsContent value="priority"><PriorityQueueTab /></TabsContent>
          </Tabs>
        </div>
      </SurviveSidebarLayout>
    </AccessRestrictedGuard>
  );
}

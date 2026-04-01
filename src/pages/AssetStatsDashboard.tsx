import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Eye, Users, Clock, Share2, ShoppingCart, ExternalLink, ChevronDown, ChevronRight, BarChart3, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* Emails to exclude from stats (VAs + admin test) */
const EXCLUDED_EMAILS = new Set([
  "theacarmellesumagaysay@gmail.com",
  "valinonorlynmae@gmail.com",
  "jking.cim@gmail.com",
  "lee@survivestudios.com",
]);

type AssetEvent = {
  id: string;
  asset_name: string;
  teaching_asset_id: string | null;
  chapter_id: string | null;
  course_id: string | null;
  event_type: string;
  section_name: string | null;
  seconds_spent: number | null;
  lw_user_id: string | null;
  lw_email: string | null;
  lw_name: string | null;
  lw_course_id: string | null;
  lw_unit_id: string | null;
  is_lw_embed: boolean;
  is_preview_mode: boolean;
  referrer: string | null;
  created_at: string;
};

type DateFilter = "7d" | "30d" | "semester" | "all";
type ModeFilter = "all" | "lw" | "preview" | "paid";

function formatStudyTime(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return hrs > 0 ? `${hrs} hrs ${mins} mins` : `${mins} mins`;
}

function rankStyle(rank: number) {
  if (rank === 1) return "text-amber-400 font-bold";
  if (rank === 2) return "text-gray-300 font-bold";
  if (rank === 3) return "text-orange-400 font-bold";
  return "text-muted-foreground";
}

export default function AssetStatsDashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [activeCourseTab, setActiveCourseTab] = useState("all-students");
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const qc = useQueryClient();

  // Share buttons toggle
  const { data: shareButtonsVisible = false } = useQuery({
    queryKey: ["app-setting-share-buttons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "share_buttons_visible")
        .maybeSingle();
      return data?.value === "true";
    },
  });

  const toggleShareButtons = async () => {
    const newValue = !shareButtonsVisible;
    await supabase
      .from("app_settings")
      .upsert({ key: "share_buttons_visible", value: String(newValue), updated_at: new Date().toISOString() } as any);
    qc.invalidateQueries({ queryKey: ["app-setting-share-buttons"] });
    toast.success(newValue ? "Share buttons enabled on Solutions pages" : "Share buttons hidden on Solutions pages");
  };

  // Fetch all events (paginated)
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["asset-stats-events"],
    queryFn: async () => {
      const all: AssetEvent[] = [];
      let from = 0;
      const BATCH = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("asset_events" as any)
          .select("id, asset_name, teaching_asset_id, chapter_id, course_id, event_type, section_name, seconds_spent, lw_user_id, lw_email, lw_name, lw_course_id, lw_unit_id, is_lw_embed, is_preview_mode, referrer, created_at")
          .order("created_at", { ascending: false })
          .range(from, from + BATCH - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any as AssetEvent[]));
        if (data.length < BATCH) break;
        from += BATCH;
      }
      return all;
    },
    staleTime: 30 * 1000,
  });

  // Fetch courses
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name, code").order("created_at");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch chapters
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch teaching assets for name lookup
  const { data: teachingAssets = [] } = useQuery({
    queryKey: ["teaching-assets-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("teaching_assets").select("id, asset_name, source_ref, problem_title, chapter_id, course_id").not("asset_approved_at", "is", null);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Filter events — exclude VA/admin emails and anonymous share/buy clicks (admin testing)
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(e => {
      if (e.lw_email && EXCLUDED_EMAILS.has(e.lw_email)) return false;
      // Exclude anonymous share/buy clicks (all from admin testing)
      if (!e.lw_email && (e.event_type === "share_click" || e.event_type === "buy_click")) return false;
      return true;
    });

    // Date filter
    if (dateFilter !== "all") {
      const now = Date.now();
      const cutoff = dateFilter === "7d" ? now - 7 * 86400000
        : dateFilter === "30d" ? now - 30 * 86400000
        : now - 120 * 86400000; // semester ≈ 4 months
      filtered = filtered.filter(e => new Date(e.created_at).getTime() > cutoff);
    }

    // Mode filter
    if (modeFilter === "lw") filtered = filtered.filter(e => e.is_lw_embed);
    else if (modeFilter === "preview") filtered = filtered.filter(e => e.is_preview_mode);
    else if (modeFilter === "paid") filtered = filtered.filter(e => e.is_lw_embed && !e.is_preview_mode);

    return filtered;
  }, [events, dateFilter, modeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const lwLoads = filteredEvents.filter(e => e.event_type === "lw_embed_load").length;
    const uniqueStudents = new Set(filteredEvents.filter(e => e.lw_email).map(e => e.lw_email)).size;
    const totalSeconds = filteredEvents
      .filter(e => e.event_type === "time_on_page" || e.event_type === "heartbeat")
      .reduce((sum, e) => sum + (e.seconds_spent || 0), 0);
    const shareClicks = filteredEvents.filter(e => e.event_type === "share_click").length;
    const buyClicks = filteredEvents.filter(e => e.event_type === "buy_click").length;
    const pageVisits = filteredEvents.filter(e => e.event_type === "page_visit" || e.event_type === "lw_embed_load").length;
    const conversionRate = pageVisits > 0 ? ((buyClicks / pageVisits) * 100).toFixed(1) : "0.0";
    return { lwLoads, uniqueStudents, totalSeconds, shareClicks, buyClicks, conversionRate };
  }, [filteredEvents]);

  // Chapter stats grouped by course
  const chapterStats = useMemo(() => {
    const map = new Map<string, {
      chapterId: string; chapterName: string; chapterNumber: number; courseId: string;
      assetCount: number; lwLoads: number; uniqueStudents: Set<string>; totalSeconds: number;
      reveals: number; shareClicks: number; buyClicks: number;
    }>();

    for (const ch of chapters) {
      map.set(ch.id, {
        chapterId: ch.id, chapterName: ch.chapter_name, chapterNumber: ch.chapter_number,
        courseId: ch.course_id, assetCount: 0, lwLoads: 0, uniqueStudents: new Set(),
        totalSeconds: 0, reveals: 0, shareClicks: 0, buyClicks: 0,
      });
    }

    // Count assets per chapter
    for (const ta of teachingAssets) {
      if (ta.chapter_id && map.has(ta.chapter_id)) {
        map.get(ta.chapter_id)!.assetCount++;
      }
    }

    for (const e of filteredEvents) {
      if (!e.chapter_id || !map.has(e.chapter_id)) continue;
      const ch = map.get(e.chapter_id)!;
      if (e.event_type === "lw_embed_load") ch.lwLoads++;
      if (e.lw_email) ch.uniqueStudents.add(e.lw_email);
      if (e.event_type === "time_on_page" || e.event_type === "heartbeat") ch.totalSeconds += e.seconds_spent || 0;
      if (e.event_type === "reveal_toggle") ch.reveals++;
      if (e.event_type === "share_click") ch.shareClicks++;
      if (e.event_type === "buy_click") ch.buyClicks++;
    }

    return [...map.values()];
  }, [filteredEvents, chapters, teachingAssets]);

  // Asset stats for expanded chapter
  const assetStats = useMemo(() => {
    if (!expandedChapter) return [];
    const chapterEvents = filteredEvents.filter(e => e.chapter_id === expandedChapter);
    const assetMap = new Map<string, {
      assetName: string; problemTitle: string; lwLoads: number; previewVisits: number;
      totalSeconds: number; reveals: number; mostOpenedSection: string;
      shareClicks: number; buyClicks: number; sectionCounts: Map<string, number>;
    }>();

    const chapterAssets = teachingAssets.filter(ta => ta.chapter_id === expandedChapter);
    for (const ta of chapterAssets) {
      assetMap.set(ta.asset_name, {
        assetName: ta.asset_name, problemTitle: ta.problem_title || ta.source_ref || "",
        lwLoads: 0, previewVisits: 0, totalSeconds: 0, reveals: 0,
        mostOpenedSection: "—", shareClicks: 0, buyClicks: 0, sectionCounts: new Map(),
      });
    }

    for (const e of chapterEvents) {
      if (!assetMap.has(e.asset_name)) {
        assetMap.set(e.asset_name, {
          assetName: e.asset_name, problemTitle: "", lwLoads: 0, previewVisits: 0,
          totalSeconds: 0, reveals: 0, mostOpenedSection: "—", shareClicks: 0, buyClicks: 0, sectionCounts: new Map(),
        });
      }
      const a = assetMap.get(e.asset_name)!;
      if (e.event_type === "lw_embed_load") a.lwLoads++;
      if (e.event_type === "page_visit" && e.is_preview_mode) a.previewVisits++;
      if (e.event_type === "time_on_page" || e.event_type === "heartbeat") a.totalSeconds += e.seconds_spent || 0;
      if (e.event_type === "reveal_toggle") {
        a.reveals++;
        if (e.section_name) {
          a.sectionCounts.set(e.section_name, (a.sectionCounts.get(e.section_name) || 0) + 1);
        }
      }
      if (e.event_type === "share_click") a.shareClicks++;
      if (e.event_type === "buy_click") a.buyClicks++;
    }

    // Calculate most opened section
    for (const a of assetMap.values()) {
      let maxCount = 0;
      for (const [section, count] of a.sectionCounts) {
        if (count > maxCount) { maxCount = count; a.mostOpenedSection = section; }
      }
    }

    return [...assetMap.values()].sort((a, b) => b.lwLoads - a.lwLoads);
  }, [expandedChapter, filteredEvents, teachingAssets]);

  // Detail modal data
  const detailData = useMemo(() => {
    if (!detailAsset) return null;
    const assetEvents = filteredEvents.filter(e => e.asset_name === detailAsset);

    // Section breakdown
    const sectionCounts = new Map<string, number>();
    for (const e of assetEvents) {
      if (e.event_type === "reveal_toggle" && e.section_name) {
        sectionCounts.set(e.section_name, (sectionCounts.get(e.section_name) || 0) + 1);
      }
    }
    const sectionChart = [...sectionCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Students
    const studentMap = new Map<string, { email: string; name: string; lastVisited: string; totalTime: number; sectionsOpened: Set<string> }>();
    for (const e of assetEvents) {
      if (!e.lw_email) continue;
      if (!studentMap.has(e.lw_email)) {
        studentMap.set(e.lw_email, { email: e.lw_email, name: e.lw_name || "", lastVisited: e.created_at, totalTime: 0, sectionsOpened: new Set() });
      }
      const s = studentMap.get(e.lw_email)!;
      if (new Date(e.created_at) > new Date(s.lastVisited)) s.lastVisited = e.created_at;
      if (e.event_type === "time_on_page" || e.event_type === "heartbeat") s.totalTime += e.seconds_spent || 0;
      if (e.event_type === "reveal_toggle" && e.section_name) s.sectionsOpened.add(e.section_name);
    }
    const students = [...studentMap.values()].sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());

    // Daily timeline (last 30 days)
    const dayMap = new Map<string, number>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const e of assetEvents) {
      if (e.event_type === "lw_embed_load" || e.event_type === "page_visit") {
        const day = e.created_at.slice(0, 10);
        if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
    }
    const timeline = [...dayMap.entries()].map(([date, count]) => ({ date: date.slice(5), count }));

    const lwLoads = assetEvents.filter(e => e.event_type === "lw_embed_load").length;
    const totalTime = assetEvents.filter(e => e.event_type === "time_on_page" || e.event_type === "heartbeat").reduce((s, e) => s + (e.seconds_spent || 0), 0);
    const reveals = assetEvents.filter(e => e.event_type === "reveal_toggle").length;

    return { assetName: detailAsset, lwLoads, totalTime, reveals, sectionChart, students, timeline };
  }, [detailAsset, filteredEvents]);

  // Students tab data
  const studentsData = useMemo(() => {
    const map = new Map<string, {
      email: string; name: string; lastActive: string; totalTime: number;
      assetsViewed: Set<string>; chapterCounts: Map<string, number>;
      lwCourse: string; assetDetails: Map<string, number>;
    }>();

    for (const e of filteredEvents) {
      if (!e.lw_email) continue;
      if (!map.has(e.lw_email)) {
        map.set(e.lw_email, {
          email: e.lw_email, name: e.lw_name || "", lastActive: e.created_at,
          totalTime: 0, assetsViewed: new Set(), chapterCounts: new Map(),
          lwCourse: e.lw_course_id || "", assetDetails: new Map(),
        });
      }
      const s = map.get(e.lw_email)!;
      if (new Date(e.created_at) > new Date(s.lastActive)) s.lastActive = e.created_at;
      if (e.event_type === "time_on_page" || e.event_type === "heartbeat") s.totalTime += e.seconds_spent || 0;
      if (e.event_type === "lw_embed_load" || e.event_type === "page_visit") {
        s.assetsViewed.add(e.asset_name);
        if (e.chapter_id) s.chapterCounts.set(e.chapter_id, (s.chapterCounts.get(e.chapter_id) || 0) + 1);
        s.assetDetails.set(e.asset_name, (s.assetDetails.get(e.asset_name) || 0) + (e.seconds_spent || 0));
      }
      if (e.lw_course_id) s.lwCourse = e.lw_course_id;
    }

    return [...map.values()]
      .filter(s => {
        if (!studentSearch) return true;
        const q = studentSearch.toLowerCase();
        return s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  }, [filteredEvents, studentSearch]);

  const hasStudentData = filteredEvents.some(e => e.lw_email);

  // Get most active chapter name for a student
  const getMostActiveChapter = (chapterCounts: Map<string, number>) => {
    let maxId = "";
    let maxCount = 0;
    for (const [id, count] of chapterCounts) {
      if (count > maxCount) { maxCount = count; maxId = id; }
    }
    const ch = chapters.find(c => c.id === maxId);
    return ch ? `Ch ${ch.chapter_number}` : "—";
  };

  const courseTabIds = courses.filter(c => {
    return chapterStats.some(ch => ch.courseId === c.id && (ch.lwLoads > 0 || ch.assetCount > 0));
  });

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Teaching Asset Stats</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Share buttons on Solutions pages</span>
            <Switch checked={shareButtonsVisible} onCheckedChange={toggleShareButtons} />
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading events…</p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Eye className="h-5 w-5 text-blue-400 shrink-0" />
                <div><p className="text-2xl font-bold text-foreground">{stats.lwLoads.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">LW Embed Loads</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-400 shrink-0" />
                <div><p className="text-2xl font-bold text-foreground">{stats.uniqueStudents.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Unique Students</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Clock className="h-5 w-5 text-cyan-400 shrink-0" />
                <div><p className="text-lg font-bold text-foreground">{formatStudyTime(stats.totalSeconds)}</p><p className="text-[10px] text-muted-foreground">Total Study Time</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Share2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div><p className="text-2xl font-bold text-foreground">{stats.shareClicks.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Share Clicks</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-amber-400 shrink-0" />
                <div><p className="text-2xl font-bold text-foreground">{stats.buyClicks} <span className="text-xs text-muted-foreground">({stats.conversionRate}%)</span></p><p className="text-[10px] text-muted-foreground">Buy Clicks</p></div>
              </CardContent></Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="semester">This semester</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={(v) => setModeFilter(v as ModeFilter)}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="lw">LW Only</SelectItem>
                  <SelectItem value="preview">Preview Only</SelectItem>
                  <SelectItem value="paid">Paid Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Main Tabs: Courses + Students */}
            <Tabs value={activeCourseTab} onValueChange={setActiveCourseTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {courseTabIds.map(c => (
                  <TabsTrigger key={c.id} value={c.id} className="text-xs">{c.code || c.course_name}</TabsTrigger>
                ))}
                {hasStudentData && <TabsTrigger value="all-students" className="text-xs">Students</TabsTrigger>}
              </TabsList>

              {/* Course tabs */}
              {courseTabIds.map(course => {
                const courseChapters = chapterStats
                  .filter(ch => ch.courseId === course.id)
                  .sort((a, b) => b.lwLoads - a.lwLoads);

                return (
                  <TabsContent key={course.id} value={course.id}>
                    <Card>
                      <CardContent className="pt-4 pb-2">
                        <h2 className="text-sm font-bold text-foreground mb-3">Chapter Leaderboard — {course.code || course.course_name}</h2>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 text-xs">#</TableHead>
                              <TableHead className="text-xs">Chapter</TableHead>
                              <TableHead className="text-xs text-right">Assets</TableHead>
                              <TableHead className="text-xs text-right">LW Loads</TableHead>
                              <TableHead className="text-xs text-right">Students</TableHead>
                              <TableHead className="text-xs text-right">Avg Time</TableHead>
                              <TableHead className="text-xs text-right">Reveals</TableHead>
                              <TableHead className="text-xs text-right">Shares</TableHead>
                              <TableHead className="text-xs text-right">Buys</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {courseChapters.map((ch, i) => {
                              const isExpanded = expandedChapter === ch.chapterId;
                              const avgTime = ch.lwLoads > 0 ? Math.round(ch.totalSeconds / ch.lwLoads / 60) : 0;
                              return (
                                <>
                                  <TableRow
                                    key={ch.chapterId}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setExpandedChapter(isExpanded ? null : ch.chapterId)}
                                  >
                                    <TableCell className={rankStyle(i + 1)}>{i + 1}</TableCell>
                                    <TableCell className="text-xs font-medium flex items-center gap-1">
                                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      Ch {ch.chapterNumber} — {ch.chapterName}
                                    </TableCell>
                                    <TableCell className="text-right text-xs font-mono">{ch.assetCount}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{ch.lwLoads}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{ch.uniqueStudents.size}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{avgTime}m</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{ch.reveals}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{ch.shareClicks}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{ch.buyClicks}</TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow key={`${ch.chapterId}-detail`}>
                                      <TableCell colSpan={9} className="p-0">
                                        <div className="bg-muted/30 p-3">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="text-[10px]">Asset Code</TableHead>
                                                <TableHead className="text-[10px]">Title</TableHead>
                                                <TableHead className="text-[10px] text-right">LW Loads</TableHead>
                                                <TableHead className="text-[10px] text-right">Preview</TableHead>
                                                <TableHead className="text-[10px] text-right">Avg Time</TableHead>
                                                <TableHead className="text-[10px] text-right">Reveals</TableHead>
                                                <TableHead className="text-[10px]">Top Section</TableHead>
                                                <TableHead className="text-[10px] text-right">Shares</TableHead>
                                                <TableHead className="text-[10px] text-right">Buys</TableHead>
                                                <TableHead className="text-[10px] w-16">Actions</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {assetStats.map(a => {
                                                const avgMins = a.lwLoads > 0 ? (a.totalSeconds / a.lwLoads / 60).toFixed(1) : "0";
                                                return (
                                                  <TableRow key={a.assetName}>
                                                    <TableCell className="text-[10px] font-mono">{a.assetName}</TableCell>
                                                    <TableCell className="text-[10px] max-w-32 truncate">{a.problemTitle}</TableCell>
                                                    <TableCell className="text-right text-[10px] font-mono">{a.lwLoads}</TableCell>
                                                    <TableCell className="text-right text-[10px] font-mono">{a.previewVisits}</TableCell>
                                                    <TableCell className="text-right text-[10px] font-mono">{avgMins}m</TableCell>
                                                    <TableCell className="text-right text-[10px] font-mono">{a.reveals}</TableCell>
                                                    <TableCell className="text-[10px]">{a.mostOpenedSection}</TableCell>
                                                    <TableCell className="text-right text-[10px] font-mono">{a.shareClicks}</TableCell>
                                                    <TableCell className="text-right text-[10px] font-mono">{a.buyClicks}</TableCell>
                                                    <TableCell>
                                                      <div className="flex gap-1">
                                                        <a href={`/solutions/${a.assetName}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                                          <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                        <button onClick={(e) => { e.stopPropagation(); setDetailAsset(a.assetName); }} className="text-muted-foreground hover:text-foreground">
                                                          <BarChart3 className="h-3 w-3" />
                                                        </button>
                                                      </div>
                                                    </TableCell>
                                                  </TableRow>
                                                );
                                              })}
                                              {assetStats.length === 0 && (
                                                <TableRow><TableCell colSpan={10} className="text-center text-[10px] text-muted-foreground py-4">No asset data</TableCell></TableRow>
                                              )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })}
                            {courseChapters.length === 0 && (
                              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-6">No data</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}

              {/* Students tab */}
              {hasStudentData && (
                <TabsContent value="all-students">
                  <Card>
                    <CardContent className="pt-4 pb-2">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-foreground">Student Activity</h2>
                        <div className="relative w-56">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            placeholder="Search email or name…"
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            className="h-8 text-xs pl-7"
                          />
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs text-right">Last Active</TableHead>
                            <TableHead className="text-xs text-right">Study Time</TableHead>
                            <TableHead className="text-xs text-right">Assets</TableHead>
                            <TableHead className="text-xs">Top Chapter</TableHead>
                            <TableHead className="text-xs">LW Course</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentsData.slice(0, 100).map(s => (
                            <>
                              <TableRow
                                key={s.email}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setExpandedStudent(expandedStudent === s.email ? null : s.email)}
                              >
                                <TableCell className="text-xs font-mono">{s.email}</TableCell>
                                <TableCell className="text-xs">{s.name || "—"}</TableCell>
                                <TableCell className="text-right text-xs">{new Date(s.lastActive).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatStudyTime(s.totalTime)}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{s.assetsViewed.size}</TableCell>
                                <TableCell className="text-xs">{getMostActiveChapter(s.chapterCounts)}</TableCell>
                                <TableCell className="text-xs font-mono">{s.lwCourse || "—"}</TableCell>
                              </TableRow>
                              {expandedStudent === s.email && (
                                <TableRow key={`${s.email}-detail`}>
                                  <TableCell colSpan={7} className="p-0">
                                    <div className="bg-muted/30 p-3">
                                      <p className="text-[10px] font-bold text-muted-foreground mb-2">Assets Viewed</p>
                                      {(() => {
                                        // Build asset lookup and group by chapter
                                        const assetLookup = new Map(teachingAssets.map(ta => [ta.asset_name, ta]));
                                        const byChapter = new Map<string, { chapterLabel: string; items: { assetName: string; sourceRef: string }[] }>();

                                        for (const name of s.assetsViewed) {
                                          const ta = assetLookup.get(name);
                                          if (!ta?.source_ref || !ta?.chapter_id) continue; // skip assets without source_ref
                                          const ch = chapters.find(c => c.id === ta.chapter_id);
                                          const key = ta.chapter_id;
                                          if (!byChapter.has(key)) {
                                            byChapter.set(key, {
                                              chapterLabel: ch ? `Ch ${ch.chapter_number}: ${ch.chapter_name}` : "Unknown",
                                              items: [],
                                            });
                                          }
                                          byChapter.get(key)!.items.push({ assetName: name, sourceRef: ta.source_ref });
                                        }

                                        const sortedChapters = [...byChapter.entries()].sort((a, b) => {
                                          const chA = chapters.find(c => c.id === a[0]);
                                          const chB = chapters.find(c => c.id === b[0]);
                                          return (chA?.chapter_number ?? 99) - (chB?.chapter_number ?? 99);
                                        });

                                        return (
                                          <div className="space-y-2">
                                            {sortedChapters.map(([chId, group]) => (
                                              <div key={chId}>
                                                <p className="text-[9px] font-semibold text-primary/80 mb-1">{group.chapterLabel}</p>
                                                <div className="flex flex-wrap gap-1">
                                                  {group.items.sort((a, b) => a.sourceRef.localeCompare(b.sourceRef, undefined, { numeric: true })).map(item => (
                                                    <Badge key={item.assetName} variant="outline" className="text-[9px] font-mono">{item.sourceRef}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            ))}
                                            {ungrouped.length > 0 && (
                                              <div>
                                                <p className="text-[9px] font-semibold text-muted-foreground mb-1">Other</p>
                                                <div className="flex flex-wrap gap-1">
                                                  {ungrouped.map(item => (
                                                    <Badge key={item.assetName} variant="outline" className="text-[9px] font-mono">{item.sourceRef}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                          {studentsData.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-6">No student data</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {studentsData.length > 100 && (
                        <p className="text-[10px] text-muted-foreground mt-2">Showing first 100 of {studentsData.length} students</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>

      {/* Asset Detail Modal */}
      <Dialog open={!!detailAsset} onOpenChange={(v) => !v && setDetailAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{detailData?.assetName}</DialogTitle>
            <DialogDescription>Asset engagement detail</DialogDescription>
          </DialogHeader>
          {detailData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{detailData.lwLoads}</p>
                  <p className="text-[10px] text-muted-foreground">LW Loads</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatStudyTime(detailData.totalTime)}</p>
                  <p className="text-[10px] text-muted-foreground">Total Time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{detailData.reveals}</p>
                  <p className="text-[10px] text-muted-foreground">Reveals</p>
                </div>
              </div>

              {/* Section breakdown chart */}
              {detailData.sectionChart.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Reveal Breakdown</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={detailData.sectionChart}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily timeline */}
              {detailData.timeline.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Daily Loads (Last 30 Days)</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={detailData.timeline}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Student list */}
              {detailData.students.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Students ({detailData.students.length})</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Email</TableHead>
                        <TableHead className="text-[10px]">Name</TableHead>
                        <TableHead className="text-[10px] text-right">Last Visit</TableHead>
                        <TableHead className="text-[10px] text-right">Time</TableHead>
                        <TableHead className="text-[10px] text-right">Sections</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.students.slice(0, 50).map(s => (
                        <TableRow key={s.email}>
                          <TableCell className="text-[10px] font-mono">{s.email}</TableCell>
                          <TableCell className="text-[10px]">{s.name || "—"}</TableCell>
                          <TableCell className="text-right text-[10px]">{new Date(s.lastVisited).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right text-[10px] font-mono">{formatStudyTime(s.totalTime)}</TableCell>
                          <TableCell className="text-right text-[10px] font-mono">{s.sectionsOpened.size}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}

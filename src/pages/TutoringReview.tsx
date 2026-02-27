import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Search, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type SortOption = "newest" | "most_used" | "least_used" | "recently_tutored";
type ProblemSource = "source" | "generated";

export default function TutoringReview() {
  const [problemSource, setProblemSource] = useState<ProblemSource>("source");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name, code").order("code");
      return data || [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters", courseFilter],
    queryFn: async () => {
      let q = supabase.from("chapters").select("id, chapter_name, chapter_number, course_id").order("chapter_number");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data } = await q;
      return data || [];
    },
  });

  // Source problems query (chapter_problems)
  const { data: sourceProblems, refetch: refetchSource } = useQuery({
    queryKey: ["tutoring-source-problems", courseFilter, chapterFilter, searchText, sortBy],
    queryFn: async () => {
      let q = supabase
        .from("chapter_problems")
        .select("id, title, source_label, problem_text, solution_text, problem_type, status, chapter_id, course_id, created_at, journal_entry_text, difficulty_internal")
        .limit(200);

      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      if (searchText.trim()) q = q.or(`problem_text.ilike.%${searchText}%,title.ilike.%${searchText}%,source_label.ilike.%${searchText}%`);

      switch (sortBy) {
        case "newest": q = q.order("created_at", { ascending: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data } = await q;
      return data || [];
    },
    enabled: problemSource === "source",
  });

  // Generated problems query (teaching_assets)
  const { data: assets, refetch: refetchAssets } = useQuery({
    queryKey: ["tutoring-assets", courseFilter, chapterFilter, difficultyFilter, searchText, sortBy],
    queryFn: async () => {
      let q = supabase
        .from("teaching_assets")
        .select("id, asset_name, survive_problem_text, survive_solution_text, difficulty, source_ref, course_id, chapter_id, tags, times_used, last_tutored_at, journal_entry_completed_json, journal_entry_template_json, journal_entry_block")
        .limit(200);

      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      if (difficultyFilter !== "all") q = q.eq("difficulty", difficultyFilter as any);
      if (searchText.trim()) q = q.or(`survive_problem_text.ilike.%${searchText}%,asset_name.ilike.%${searchText}%,source_ref.ilike.%${searchText}%`);

      switch (sortBy) {
        case "most_used": q = q.order("times_used", { ascending: false }); break;
        case "least_used": q = q.order("times_used", { ascending: true }); break;
        case "recently_tutored": q = q.order("last_tutored_at", { ascending: false, nullsFirst: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data } = await q;
      return data || [];
    },
    enabled: problemSource === "generated",
  });

  const handleMarkUsedAsset = async (id: string, currentCount: number) => {
    const { error } = await supabase
      .from("teaching_assets")
      .update({ last_tutored_at: new Date().toISOString(), times_used: currentCount + 1 })
      .eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Marked as used");
    refetchAssets();
  };

  const courseName = (cid: string) => courses?.find(c => c.id === cid)?.code || "";
  const chapterName = (chid: string) => chapters?.find(c => c.id === chid)?.chapter_name || "";

  return (
    <SurviveSidebarLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          Pre-Session Review
        </h1>
        <p className="text-sm text-foreground/80 mt-1">Browse and prep problems before tutoring sessions</p>
      </div>

      {/* Source toggle */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-background/80 border border-border w-fit">
        <button
          onClick={() => setProblemSource("source")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            problemSource === "source"
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70 hover:text-foreground hover:bg-muted"
          }`}
        >
          Source Problems
        </button>
        <button
          onClick={() => setProblemSource("generated")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            problemSource === "generated"
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70 hover:text-foreground hover:bg-muted"
          }`}
        >
          Generated Problems
        </button>
      </div>

      {/* Filters */}
      <div className={`grid grid-cols-2 gap-3 mb-5 ${problemSource === "generated" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <Select value={courseFilter} onValueChange={v => { setCourseFilter(v); setChapterFilter("all"); }}>
          <SelectTrigger className="bg-background/95 border-border text-foreground text-sm h-9">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.code || c.course_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={chapterFilter} onValueChange={setChapterFilter}>
          <SelectTrigger className="bg-background/95 border-border text-foreground text-sm h-9">
            <SelectValue placeholder="Chapter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chapters</SelectItem>
            {chapters?.map(c => <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number}: {c.chapter_name}</SelectItem>)}
          </SelectContent>
        </Select>

        {problemSource === "generated" && (
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="bg-background/95 border-border text-foreground text-sm h-9">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="harder">Harder</SelectItem>
              <SelectItem value="tricky">Tricky</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/60" />
          <Input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search problems..."
            className="pl-8 bg-background/95 border-border text-foreground text-sm h-9"
          />
        </div>

        <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
          <SelectTrigger className="bg-background/95 border-border text-foreground text-sm h-9">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            {problemSource === "generated" && (
              <>
                <SelectItem value="most_used">Most Used</SelectItem>
                <SelectItem value="least_used">Least Used</SelectItem>
                <SelectItem value="recently_tutored">Recently Tutored</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <div className="space-y-2">
        {problemSource === "source" && (
          <>
            {!sourceProblems?.length && (
              <p className="text-center text-foreground/70 py-12 text-sm">No source problems found. Adjust your filters.</p>
            )}
            {sourceProblems?.map(p => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-background/95 p-4 flex items-start gap-4 hover:bg-background transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {p.source_label && (
                      <span className="text-xs font-mono text-primary">{p.source_label}</span>
                    )}
                    {p.title && (
                      <span className="text-xs font-medium text-foreground">{p.title}</span>
                    )}
                    <span className="text-[10px] text-foreground/70 uppercase">{courseName(p.course_id)} • {chapterName(p.chapter_id)}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/80">
                      {p.problem_type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/60">
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-2">
                    {p.problem_text?.substring(0, 200) || "No problem text"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" asChild className="h-7 text-xs">
                    <Link to={`/tutoring/review/source/${p.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> Open Review
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}

        {problemSource === "generated" && (
          <>
            {!assets?.length && (
              <p className="text-center text-foreground/70 py-12 text-sm">No generated problems found. Adjust your filters.</p>
            )}
            {assets?.map(a => (
              <div
                key={a.id}
                className="rounded-lg border border-border bg-background/95 p-4 flex items-start gap-4 hover:bg-background transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.source_ref && (
                      <span className="text-xs font-mono text-primary">{a.source_ref}</span>
                    )}
                    <span className="text-[10px] text-foreground/70 uppercase">{courseName(a.course_id)} • {chapterName(a.chapter_id)}</span>
                    {a.difficulty && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/80">
                        {a.difficulty}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-2">
                    {a.survive_problem_text?.substring(0, 200) || a.asset_name}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-foreground/70">
                    <span>Used {a.times_used ?? 0}×</span>
                    {a.last_tutored_at && (
                      <span>Last: {new Date(a.last_tutored_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkUsedAsset(a.id, a.times_used ?? 0)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Used
                  </Button>
                  <Button size="sm" asChild className="h-7 text-xs">
                    <Link to={`/tutoring/review/${a.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> Open Review
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

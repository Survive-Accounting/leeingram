import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Lock } from "lucide-react";

const NAVY = "#14213D";
const GREEN = "#16A34A";

const MockBadge = () => (
  <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
    Mock Data
  </span>
);

// ─── Mock Data ─────────────────────────────────────────────────────────────
const STUDENTS_BY_ENROLLMENT = [
  { rank: 1, member: "#1", name: "King J.", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 2, member: "#2", name: "Rona V.", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 3, member: "#3", name: "Noella M.", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 4, member: "#4", name: "Cromwell L.", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 5, member: "#5", name: "Mae", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 6, member: "#6", name: "—", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 7, member: "#7", name: "—", campus: "Ole Miss", joined: "Apr 2026", badge: "🏅 Founding Student" },
  { rank: 8, member: "#8", name: 'Lee "Struggler Student" Ingram', campus: "Ole Miss", joined: "2020", badge: "😅 OG Member (Last Place)" },
];

const STUDENTS_BY_COURSE = [
  { rank: 1, name: "King J.", course: "IA2", solved: 142, accuracy: "94%" },
  { rank: 2, name: "Rona V.", course: "IA2", solved: 128, accuracy: "91%" },
  { rank: 3, name: "Noella M.", course: "IA1", solved: 119, accuracy: "89%" },
  { rank: 4, name: "Cromwell L.", course: "Intro 2", solved: 98, accuracy: "87%" },
  { rank: 5, name: "Mae", course: "IA2", solved: 84, accuracy: "92%" },
];

const GREEK_BY_MEMBERS = [
  { rank: 1, name: "DKE", type: "Fraternity", members: 12, founding: "🏅 Founding Frat", joined: "Apr 2026" },
  { rank: 2, name: "Kappa Delta", type: "Sorority", members: 10, founding: "🏅 Founding Sorority", joined: "Apr 2026" },
  { rank: 3, name: "Pike", type: "Fraternity", members: 8, founding: null, joined: "Apr 2026" },
  { rank: 4, name: "Chi Omega", type: "Sorority", members: 6, founding: null, joined: "Apr 2026" },
  { rank: 5, name: "Sigma Nu", type: "Fraternity", members: 4, founding: null, joined: "Apr 2026" },
];

const PUBLIC_LAUNCH_TARGET = 50;
const CURRENT_TOTAL = 8;

// ─── Reusable Components ───────────────────────────────────────────────────
function ComingSoonOverlay({ title }: { title: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
        <Lock className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">Coming soon</p>
      </div>
      <div className="opacity-30 pointer-events-none p-6 min-h-[180px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>—</TableHead>
              <TableHead>—</TableHead>
              <TableHead>—</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map(i => (
              <TableRow key={i}>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-t-lg px-6 py-4 text-white" style={{ background: NAVY }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5" /> {title}
          </h2>
          {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
        </div>
        <MockBadge />
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const filteredByCourse =
    courseFilter === "all"
      ? STUDENTS_BY_COURSE
      : STUDENTS_BY_COURSE.filter(s => s.course.toLowerCase().replace(/\s/g, "") === courseFilter);

  const progressPct = Math.min(100, (CURRENT_TOTAL / PUBLIC_LAUNCH_TARGET) * 100);
  const remaining = Math.max(0, PUBLIC_LAUNCH_TARGET - CURRENT_TOTAL);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="rounded-lg px-6 py-5 text-white relative" style={{ background: NAVY }}>
        <div className="absolute top-3 right-3"><MockBadge /></div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Trophy className="h-6 w-6" /> Community Leaderboard
        </h1>
        <p className="text-sm text-white/70 mt-1">
          Activates publicly at 50 students. Mock data shown below.
        </p>
      </div>

      {/* SECTION 1 — Student Leaderboard */}
      <Card className="overflow-hidden">
        <SectionHeader title="Top Students — Ole Miss" />
        <CardContent className="p-6">
          <Tabs defaultValue="enrollment">
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="enrollment">By Enrollment</TabsTrigger>
              <TabsTrigger value="course">By Course</TabsTrigger>
              <TabsTrigger value="study-time">By Study Time</TabsTrigger>
              <TabsTrigger value="quizzes">By Quizzes Taken</TabsTrigger>
              <TabsTrigger value="certifications">Certifications</TabsTrigger>
            </TabsList>

            <TabsContent value="enrollment">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Member #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Badge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {STUDENTS_BY_ENROLLMENT.map(s => (
                      <TableRow key={s.rank}>
                        <TableCell className="font-bold">#{s.rank}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.member}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.campus}</TableCell>
                        <TableCell className="text-sm">{s.joined}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{s.badge}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="course">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    <SelectItem value="ia2">IA2</SelectItem>
                    <SelectItem value="ia1">IA1</SelectItem>
                    <SelectItem value="intro2">Intro 2</SelectItem>
                    <SelectItem value="intro1">Intro 1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-center">Problems Solved</TableHead>
                      <TableHead className="text-center">Accuracy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredByCourse.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No students in this course yet.</TableCell></TableRow>
                    ) : filteredByCourse.map(s => (
                      <TableRow key={s.rank}>
                        <TableCell className="font-bold">#{s.rank}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell><Badge variant="outline">{s.course}</Badge></TableCell>
                        <TableCell className="text-center">{s.solved}</TableCell>
                        <TableCell className="text-center font-medium" style={{ color: GREEN }}>{s.accuracy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="study-time">
              <ComingSoonOverlay title="Study Time Leaderboard" />
            </TabsContent>

            <TabsContent value="quizzes">
              <ComingSoonOverlay title="Quizzes Leaderboard" />
            </TabsContent>

            <TabsContent value="certifications">
              <div className="relative">
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
                  <Lock className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-sm font-semibold">Chapter Certifications</p>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
                <div className="opacity-30 pointer-events-none grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 p-6 min-h-[180px]">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="rounded-md border p-3 text-center text-xs">
                      Ch {i + 13} ✓
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* SECTION 2 — Greek Org Leaderboard */}
      <Card className="overflow-hidden">
        <SectionHeader title="Greek Org Rankings — Ole Miss" />
        <CardContent className="p-6">
          <Tabs defaultValue="members">
            <TabsList className="mb-4">
              <TabsTrigger value="members">By Members</TabsTrigger>
              <TabsTrigger value="study-time">By Study Time</TabsTrigger>
              <TabsTrigger value="performance">By Course Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="members">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Org Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Members</TableHead>
                      <TableHead>Founding?</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {GREEK_BY_MEMBERS.map(o => (
                      <TableRow key={o.rank}>
                        <TableCell className="font-bold">#{o.rank}</TableCell>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.type}</TableCell>
                        <TableCell className="text-center">{o.members}</TableCell>
                        <TableCell>
                          {o.founding ? <Badge variant="secondary" className="text-xs">{o.founding}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">{o.joined}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="study-time">
              <ComingSoonOverlay title="Greek Study Time" />
            </TabsContent>

            <TabsContent value="performance">
              <ComingSoonOverlay title="Greek Course Performance" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* SECTION 3 — Progress to Public Launch */}
      <div className="rounded-lg p-6 text-white relative" style={{ background: NAVY }}>
        <div className="absolute top-3 right-3"><MockBadge /></div>
        <h3 className="text-lg font-semibold">Leaderboard goes public at 50 students</h3>
        <div className="mt-4">
          <div className="h-3 w-full rounded-full overflow-hidden bg-white/15">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: GREEN }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/80">{CURRENT_TOTAL}/{PUBLIC_LAUNCH_TARGET} students</span>
            <span className="text-white/60 text-xs">
              {remaining} more student{remaining === 1 ? "" : "s"} until the leaderboard is visible to everyone
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

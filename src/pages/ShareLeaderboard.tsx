import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Share2, ExternalLink, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShareEvent = {
  asset_name: string;
  event_type: string;
};

type SortKey = "asset" | "visits" | "shares" | "rate";

export default function ShareLeaderboard() {
  const [sortKey, setSortKey] = useState<SortKey>("visits");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const { data: events, isLoading } = useQuery({
    queryKey: ["share-leaderboard-events"],
    queryFn: async () => {
      const all: ShareEvent[] = [];
      let from = 0;
      const BATCH = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("asset_share_events")
          .select("asset_name, event_type")
          .range(from, from + BATCH - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as ShareEvent[]));
        if (data.length < BATCH) break;
        from += BATCH;
      }
      return all;
    },
  });

  const { visitMap, shareMap, totalVisits, totalShares, allAssets } = useMemo(() => {
    const vMap = new Map<string, number>();
    const sMap = new Map<string, number>();
    let tv = 0, ts = 0;
    for (const e of events ?? []) {
      if (e.event_type === "page_visit") {
        vMap.set(e.asset_name, (vMap.get(e.asset_name) || 0) + 1);
        tv++;
      } else if (e.event_type === "share_click") {
        sMap.set(e.asset_name, (sMap.get(e.asset_name) || 0) + 1);
        ts++;
      }
    }
    const assetSet = new Set([...vMap.keys(), ...sMap.keys()]);
    return { visitMap: vMap, shareMap: sMap, totalVisits: tv, totalShares: ts, allAssets: [...assetSet] };
  }, [events]);

  const topVisited = useMemo(() =>
    [...visitMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    [visitMap]
  );

  const topShared = useMemo(() =>
    [...shareMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    [shareMap]
  );

  // Combined table data
  const combinedRows = useMemo(() => {
    return allAssets.map(name => ({
      asset: name,
      visits: visitMap.get(name) || 0,
      shares: shareMap.get(name) || 0,
      rate: (visitMap.get(name) || 0) > 0
        ? ((shareMap.get(name) || 0) / (visitMap.get(name) || 1)) * 100
        : 0,
    }));
  }, [allAssets, visitMap, shareMap]);

  const sortedCombined = useMemo(() => {
    const sorted = [...combinedRows].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === "asset") return mul * a.asset.localeCompare(b.asset);
      return mul * (a[sortKey] - b[sortKey]);
    });
    return sorted;
  }, [combinedRows, sortKey, sortAsc]);

  const pagedRows = sortedCombined.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(sortedCombined.length / PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const rankStyle = (rank: number) => {
    if (rank === 1) return "text-amber-400 font-bold";
    if (rank === 2) return "text-gray-300 font-bold";
    if (rank === 3) return "text-orange-400 font-bold";
    return "text-muted-foreground";
  };

  const maxVisitCount = topVisited[0]?.[1] || 1;
  const maxShareCount = topShared[0]?.[1] || 1;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Share Leaderboard</h1>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading events…</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <Eye className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalVisits.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Page Visits</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <Share2 className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalShares.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Share Clicks</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top 25 tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Most Visited */}
              <Card>
                <CardContent className="pt-4 pb-2">
                  <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-400" /> Most Visited (Top 25)
                  </h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead className="text-right w-28">Visits</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topVisited.map(([name, count], i) => (
                        <TableRow key={name}>
                          <TableCell className={rankStyle(i + 1)}>{i + 1}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{name}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 rounded-full bg-blue-500/20 overflow-hidden" style={{ width: 60 }}>
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / maxVisitCount) * 100}%` }} />
                              </div>
                              <span className="text-xs font-mono">{count}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a href={`/solutions/${name}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                      {topVisited.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">No data yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Most Shared */}
              <Card>
                <CardContent className="pt-4 pb-2">
                  <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-emerald-400" /> Most Shared (Top 25)
                  </h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead className="text-right w-28">Shares</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topShared.map(([name, count], i) => (
                        <TableRow key={name}>
                          <TableCell className={rankStyle(i + 1)}>{i + 1}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{name}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 rounded-full bg-emerald-500/20 overflow-hidden" style={{ width: 60 }}>
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(count / maxShareCount) * 100}%` }} />
                              </div>
                              <span className="text-xs font-mono">{count}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a href={`/solutions/${name}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                      {topShared.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">No data yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Combined table */}
            <Card>
              <CardContent className="pt-4 pb-2">
                <h2 className="text-sm font-bold text-foreground mb-3">All Assets — Visit + Share Summary</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => toggleSort("asset")}>
                          Asset <ArrowUpDown className="h-3 w-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => toggleSort("visits")}>
                          Visits <ArrowUpDown className="h-3 w-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => toggleSort("shares")}>
                          Shares <ArrowUpDown className="h-3 w-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => toggleSort("rate")}>
                          Share Rate <ArrowUpDown className="h-3 w-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map(row => (
                      <TableRow key={row.asset}>
                        <TableCell><span className="font-mono text-xs">{row.asset}</span></TableCell>
                        <TableCell className="text-right text-xs font-mono">{row.visits}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{row.shares}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{row.rate.toFixed(1)}%</TableCell>
                        <TableCell>
                          <a href={`/solutions/${row.asset}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagedRows.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">No data yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 px-1">
                    <p className="text-xs text-muted-foreground">
                      Page {page + 1} of {totalPages} ({sortedCombined.length} assets)
                    </p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        Prev
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

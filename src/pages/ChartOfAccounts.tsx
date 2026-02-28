import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Search, Save, Plus, Trash2 } from "lucide-react";

const ACCOUNT_TYPES = [
  "Asset", "Liability", "Equity", "Revenue", "Expense",
  "Contra Asset", "Contra Liability", "Contra Equity",
  "Other Income", "Other Expense",
] as const;

const BALANCES = ["Debit", "Credit"] as const;

type COARow = {
  id: string;
  canonical_name: string;
  account_type: string;
  normal_balance: string;
  keywords: string[] | null;
  is_global_default: boolean;
  created_at: string;
};

export default function ChartOfAccounts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [edits, setEdits] = useState<Record<string, Partial<COARow>>>({});
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("Asset");
  const [newBalance, setNewBalance] = useState<string>("Debit");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["chart_of_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts" as any)
        .select("*")
        .order("canonical_name");
      if (error) throw error;
      return (data as any[]) as COARow[];
    },
  });

  const filtered = useMemo(() => {
    let list = accounts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.canonical_name.toLowerCase().includes(q) ||
          (a.keywords ?? []).some((k) => k.toLowerCase().includes(q))
      );
    }
    if (typeFilter !== "all") {
      list = list.filter((a) => a.account_type === typeFilter);
    }
    return list;
  }, [accounts, search, typeFilter]);

  const updateMut = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<COARow> }) => {
      const { error } = await supabase
        .from("chart_of_accounts" as any)
        .update(changes as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      toast({ title: "Account updated" });
    },
  });

  const insertMut = useMutation({
    mutationFn: async (row: { canonical_name: string; account_type: string; normal_balance: string }) => {
      const { error } = await supabase.from("chart_of_accounts" as any).insert(row as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      setNewName("");
      toast({ title: "Account added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      toast({ title: "Account deleted" });
    },
    onError: (e: any) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  const setEdit = (id: string, field: string, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveEdit = (id: string) => {
    const changes = edits[id];
    if (!changes) return;
    updateMut.mutate({ id, changes });
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach((a) => {
      map[a.account_type] = (map[a.account_type] || 0) + 1;
    });
    return map;
  }, [accounts]);

  return (
    <SurviveSidebarLayout>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <Badge variant="secondary" className="text-sm">{accounts.length} accounts</Badge>
        </div>

        {/* Type summary */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeCounts).sort().map(([type, count]) => (
            <Badge
              key={type}
              variant="outline"
              className="cursor-pointer"
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
            >
              {type}: {count}
            </Badge>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts or keywords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Add new */}
        <div className="flex gap-2 items-end border border-border rounded-md p-3 bg-muted/30">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Account Name</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New account name" />
          </div>
          <div className="w-44">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Normal Balance</label>
            <Select value={newBalance} onValueChange={setNewBalance}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BALANCES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!newName.trim() || insertMut.isPending}
            onClick={() => insertMut.mutate({ canonical_name: newName.trim(), account_type: newType, normal_balance: newBalance })}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canonical Name</TableHead>
                  <TableHead className="w-44">Account Type</TableHead>
                  <TableHead className="w-32">Normal Balance</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const e = edits[a.id] || {};
                  const dirty = Object.keys(e).length > 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-foreground">{a.canonical_name}</TableCell>
                      <TableCell>
                        <Select
                          value={e.account_type ?? a.account_type}
                          onValueChange={(v) => setEdit(a.id, "account_type", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={e.normal_balance ?? a.normal_balance}
                          onValueChange={(v) => setEdit(a.id, "normal_balance", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BALANCES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(a.keywords ?? []).map((k) => (
                            <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {dirty && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(a.id)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMut.mutate(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

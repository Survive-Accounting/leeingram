import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  packages: any[];
}

function flattenForDiff(obj: any, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== "object") {
    result[prefix] = String(obj);
    return result;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      Object.assign(result, flattenForDiff(item, `${prefix}[${i}]`));
    });
    return result;
  }
  for (const key of Object.keys(obj)) {
    Object.assign(result, flattenForDiff(obj[key], prefix ? `${prefix}.${key}` : key));
  }
  return result;
}

function ValidationIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="h-3 w-3 text-green-400" />;
  if (status === "fail") return <XCircle className="h-3 w-3 text-destructive" />;
  return <AlertTriangle className="h-3 w-3 text-amber-400" />;
}

export function VersionDiffView({ packages }: Props) {
  const [leftVersion, setLeftVersion] = useState<string>(packages.length > 1 ? String(packages[1].version) : "");
  const [rightVersion, setRightVersion] = useState<string>(packages.length > 0 ? String(packages[0].version) : "");

  const leftPkg = packages.find((p) => String(p.version) === leftVersion);
  const rightPkg = packages.find((p) => String(p.version) === rightVersion);

  if (packages.length < 2) {
    return <p className="text-xs text-muted-foreground">Need at least 2 versions to compare.</p>;
  }

  const leftFlat = leftPkg ? flattenForDiff(leftPkg.answer_payload) : {};
  const rightFlat = rightPkg ? flattenForDiff(rightPkg.answer_payload) : {};
  const allKeys = [...new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)])].sort();

  const leftValidation: any[] = leftPkg?.validation_results ?? [];
  const rightValidation: any[] = rightPkg?.validation_results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-[10px] text-muted-foreground mr-1">Left:</span>
          <Select value={leftVersion} onValueChange={setLeftVersion}>
            <SelectTrigger className="h-7 text-xs w-20 inline-flex"><SelectValue /></SelectTrigger>
            <SelectContent>
              {packages.map((p) => <SelectItem key={p.version} value={String(p.version)}>v{p.version}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground text-xs">vs</span>
        <div>
          <span className="text-[10px] text-muted-foreground mr-1">Right:</span>
          <Select value={rightVersion} onValueChange={setRightVersion}>
            <SelectTrigger className="h-7 text-xs w-20 inline-flex"><SelectValue /></SelectTrigger>
            <SelectContent>
              {packages.map((p) => <SelectItem key={p.version} value={String(p.version)}>v{p.version}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Answer diff */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Answer Changes</p>
        <div className="rounded border border-border overflow-hidden text-[10px]">
          <div className="grid grid-cols-3 bg-muted/30 px-2 py-1 border-b border-border font-semibold text-muted-foreground">
            <span>Key</span>
            <span>v{leftVersion}</span>
            <span>v{rightVersion}</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {allKeys.map((key) => {
              const l = leftFlat[key] ?? "—";
              const r = rightFlat[key] ?? "—";
              const changed = l !== r;
              return (
                <div key={key} className={cn("grid grid-cols-3 px-2 py-0.5 border-b border-border/50", changed && "bg-amber-500/5")}>
                  <span className="font-mono truncate">{key}</span>
                  <span className={cn("truncate", changed && "text-destructive line-through")}>{l}</span>
                  <span className={cn("truncate", changed && "text-green-400")}>{r}</span>
                </div>
              );
            })}
            {allKeys.length === 0 && (
              <div className="px-2 py-2 text-muted-foreground text-center">No answer data to compare</div>
            )}
          </div>
        </div>
      </div>

      {/* Validation comparison */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Validation Comparison</p>
        <div className="rounded border border-border overflow-hidden text-[10px]">
          <div className="grid grid-cols-3 bg-muted/30 px-2 py-1 border-b border-border font-semibold text-muted-foreground">
            <span>Validator</span>
            <span>v{leftVersion}</span>
            <span>v{rightVersion}</span>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {(() => {
              const allValidators = [...new Set([...leftValidation.map((v: any) => v.validator), ...rightValidation.map((v: any) => v.validator)])];
              return allValidators.map((name) => {
                const lv = leftValidation.find((v: any) => v.validator === name);
                const rv = rightValidation.find((v: any) => v.validator === name);
                return (
                  <div key={name} className="grid grid-cols-3 px-2 py-0.5 border-b border-border/50 items-center">
                    <span className="font-mono truncate">{name}</span>
                    <span className="flex items-center gap-1">{lv ? <><ValidationIcon status={lv.status} /> {lv.status}</> : "—"}</span>
                    <span className="flex items-center gap-1">{rv ? <><ValidationIcon status={rv.status} /> {rv.status}</> : "—"}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

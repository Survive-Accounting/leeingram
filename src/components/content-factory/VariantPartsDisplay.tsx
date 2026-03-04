/**
 * VariantPartsDisplay — renders the unified parts[] schema.
 * Each part is rendered as (a), (b), etc. with type-specific UI.
 */

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type VariantPart,
  type VariantTextPart,
  type VariantJEPart,
  isTextPart,
  isJEPart,
  formatPartLabel,
} from "@/lib/variantParts";
import { useState } from "react";

interface Props {
  parts: VariantPart[];
}

function TextPartCard({ part }: { part: VariantTextPart }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">{formatPartLabel(part.label)}</span>
        <Badge variant="outline" className="text-[9px] h-4">text</Badge>
      </div>
      <div className="pl-6 space-y-1.5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Final Answer</p>
          <p className="text-sm text-foreground font-medium">{part.final_answer}</p>
          {part.final_value != null && (
            <p className="text-xs text-muted-foreground font-mono">
              = {typeof part.final_value === "number" ? part.final_value.toLocaleString() : part.final_value}
              {part.units ? ` ${part.units}` : ""}
            </p>
          )}
        </div>
        {part.explanation && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Explanation</p>
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">{part.explanation}</p>
          </div>
        )}
        {part.worked_steps && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3" /> Worked Steps
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <pre className="text-xs text-foreground/70 font-mono whitespace-pre-wrap bg-muted/30 rounded p-2">
                {part.worked_steps}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function JEPartCard({ part }: { part: VariantJEPart }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">{formatPartLabel(part.label)}</span>
        <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-400 border-blue-500/30">journal entry</Badge>
      </div>
      <div className="pl-6 space-y-3">
        {part.je_structured.map((entry, ei) => {
          const totalDebit = entry.entries.reduce((s, e) => s + (e.debit ?? 0), 0);
          const totalCredit = entry.entries.reduce((s, e) => s + (e.credit ?? 0), 0);
          const balanced = Math.abs(totalDebit - totalCredit) < 0.02;

          return (
            <div key={ei} className="rounded-md border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border">
                <span className="text-xs font-medium text-foreground">{entry.date}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] h-4",
                    balanced
                      ? "text-green-400 border-green-500/30"
                      : "text-red-400 border-red-500/30"
                  )}
                >
                  {balanced ? "Balanced" : `Off by $${Math.abs(totalDebit - totalCredit).toLocaleString()}`}
                </Badge>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-3 py-1 font-medium">Account</th>
                    <th className="text-right px-3 py-1 font-medium w-24">Debit</th>
                    <th className="text-right px-3 py-1 font-medium w-24">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.entries.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/30 last:border-0">
                      <td className={cn("px-3 py-1 text-foreground", row.credit != null && row.credit > 0 && "pl-8")}>
                        {row.account}
                      </td>
                      <td className="text-right px-3 py-1 font-mono text-foreground">
                        {row.debit != null && row.debit > 0 ? `$${row.debit.toLocaleString()}` : ""}
                      </td>
                      <td className="text-right px-3 py-1 font-mono text-foreground">
                        {row.credit != null && row.credit > 0 ? `$${row.credit.toLocaleString()}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VariantPartsDisplay({ parts }: Props) {
  if (!parts || parts.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No answer parts available.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Answer Parts</h3>
        <Badge variant="outline" className="text-[9px] h-4">
          {parts.filter(isTextPart).length} text · {parts.filter(isJEPart).length} JE
        </Badge>
      </div>
      {parts.map((part, i) => (
        <div key={i} className="border-l-2 border-border pl-3">
          {isTextPart(part) ? <TextPartCard part={part} /> : <JEPartCard part={part} />}
        </div>
      ))}
    </div>
  );
}

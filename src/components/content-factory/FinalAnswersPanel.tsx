import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

export interface FinalAnswer {
  label: string;
  value: string | number;
  unit?: string;
}

interface Props {
  answers: FinalAnswer[];
  outputType: string;
  onEdit?: (answers: FinalAnswer[]) => void;
  readOnly?: boolean;
}

export function FinalAnswersPanel({ answers, outputType, onEdit, readOnly = false }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<FinalAnswer | null>(null);

  const startEdit = (i: number) => {
    setEditing(i);
    setDraft({ ...answers[i] });
  };

  const saveEdit = () => {
    if (editing == null || !draft || !onEdit) return;
    const next = [...answers];
    next[editing] = draft;
    onEdit(next);
    setEditing(null);
    setDraft(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(null);
  };

  if (!answers || answers.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No final answers recorded.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Final Answers</h3>
        <Badge variant="outline" className="text-[9px] h-4 capitalize">{outputType.replace("_", " ")}</Badge>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {answers.map((a, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0 group hover:bg-muted/20">
                {editing === i && draft ? (
                  <>
                    <td className="px-3 py-1.5">
                      <Input
                        value={draft.label}
                        onChange={e => setDraft({ ...draft, label: e.target.value })}
                        className="h-6 text-sm border-0 p-0 bg-transparent focus-visible:ring-1"
                      />
                    </td>
                    <td className="text-right px-3 py-1.5 w-36">
                      <Input
                        value={draft.value}
                        onChange={e => setDraft({ ...draft, value: e.target.value })}
                        className="h-6 text-sm border-0 p-0 bg-transparent text-right font-mono focus-visible:ring-1"
                      />
                    </td>
                    <td className="w-16 px-1">
                      <div className="flex gap-0.5">
                        <button className="p-0.5 text-green-400 hover:text-green-300" onClick={saveEdit}><Check className="h-3 w-3" /></button>
                        <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={cancelEdit}><X className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-1.5 text-foreground">{a.label}</td>
                    <td className="text-right px-3 py-1.5 font-mono font-semibold text-foreground w-36">
                      {typeof a.value === "number" ? `$${a.value.toLocaleString()}` : a.value}
                      {a.unit && <span className="text-muted-foreground text-[10px] ml-1">{a.unit}</span>}
                    </td>
                    <td className="w-16 px-1">
                      {!readOnly && (
                        <button
                          className="p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEdit(i)}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

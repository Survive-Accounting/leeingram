import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { HighlightedText } from "@/components/content-factory/HighlightedText";
import type { Highlight } from "@/lib/highlightTypes";

/**
 * Detects pipe-delimited tables in text and renders them as styled HTML tables.
 * Non-table text is rendered as whitespace-preserving paragraphs.
 * Optionally applies highlights to non-table text segments.
 */

interface SmartTextRendererProps {
  text: string;
  className?: string;
  highlightedTextProps?: {
    highlights: Highlight[];
    showHighlights: boolean;
  };
}

interface ParsedSegment {
  type: "text" | "table";
  content: string;
  rows?: string[][];
}

function parsePipeTable(block: string): string[][] {
  return block
    .split("\n")
    .filter((l) => l.trim())
    .map((line) =>
      line
        .split("|")
        .map((c) => c.trim())
        .filter((_, i, arr) => {
          // Remove empty leading/trailing cells from pipes at start/end
          if (i === 0 && arr[0] === "") return false;
          if (i === arr.length - 1 && arr[arr.length - 1] === "") return false;
          return true;
        })
    );
}

function parseSegments(text: string): ParsedSegment[] {
  const lines = text.split("\n");
  const segments: ParsedSegment[] = [];
  let i = 0;

  while (i < lines.length) {
    // Check if this line and the next contain pipes (table block)
    if (
      i < lines.length - 1 &&
      lines[i].includes("|") &&
      lines[i + 1].includes("|")
    ) {
      // Collect consecutive pipe lines
      const start = i;
      while (i < lines.length && lines[i].includes("|")) {
        i++;
      }
      const block = lines.slice(start, i).join("\n");
      const rows = parsePipeTable(block);
      // Filter out separator rows (e.g. "---|---|---")
      const dataRows = rows.filter(
        (row) => !row.every((cell) => /^[-:]+$/.test(cell))
      );
      if (dataRows.length >= 2) {
        segments.push({ type: "table", content: block, rows: dataRows });
      } else {
        segments.push({ type: "text", content: block });
      }
    } else {
      // Collect non-table lines
      const start = i;
      while (
        i < lines.length &&
        !(
          i < lines.length - 1 &&
          lines[i].includes("|") &&
          lines[i + 1].includes("|")
        )
      ) {
        i++;
      }
      const block = lines.slice(start, i).join("\n");
      if (block.trim()) {
        segments.push({ type: "text", content: block });
      }
    }
  }

  return segments;
}

function isNumeric(cell: string): boolean {
  return /^\$?[\d,]+(\.\d+)?%?$/.test(cell.trim());
}

function stripCurrency(val: string): string {
  return val.replace(/[$,%]/g, "").replace(/,/g, "");
}

function tableToTSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (isNumeric(cell) ? stripCurrency(cell) : cell))
        .join("\t")
    )
    .join("\n");
}

function PipeTable({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;

  const handleCopy = () => {
    navigator.clipboard.writeText(tableToTSV(rows));
    toast.success("Copied — paste into Google Sheets");
  };

  return (
    <div className="relative my-3">
      <div className="absolute top-1 right-1 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={handleCopy}
        >
          <Copy className="h-3 w-3 mr-1" /> Copy for Sheets
        </Button>
      </div>
      <div className="rounded overflow-hidden border border-[hsl(var(--border))] shadow-sm">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr style={{ background: "#1A2E55" }}>
              {header.map((cell, i) => (
                <th
                  key={i}
                  className="text-left font-bold text-white"
                  style={{ padding: "6px 10px", fontSize: "11px" }}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr
                key={ri}
                style={{ background: ri % 2 === 0 ? "#FFFFFF" : "#F8F9FA" }}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "5px 10px",
                      fontSize: "11px",
                      textAlign: isNumeric(cell) ? "right" : "left",
                      borderTop: "1px solid #E0E0E0",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SmartTextRenderer({
  text,
  className,
}: SmartTextRendererProps) {
  if (!text) return <span className="text-muted-foreground">—</span>;

  const segments = parseSegments(text);

  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "table" && seg.rows ? (
          <PipeTable key={i} rows={seg.rows} />
        ) : (
          <p
            key={i}
            className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
          >
            {seg.content}
          </p>
        )
      )}
    </div>
  );
}

/** Utility: detect if text contains a pipe table */
export function containsPipeTable(text: string): boolean {
  if (!text) return false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].includes("|") && lines[i + 1].includes("|")) return true;
  }
  return false;
}

/** Utility: parse pipe tables from text for edge function use */
export function extractPipeTables(text: string): ParsedSegment[] {
  return parseSegments(text);
}

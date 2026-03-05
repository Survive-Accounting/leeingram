import { useMemo, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type Highlight, HIGHLIGHT_TYPE_COLORS, HIGHLIGHT_TYPE_LABELS } from "@/lib/highlightTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface HighlightedTextProps {
  text: string;
  highlights: Highlight[];
  showHighlights: boolean;
  editable?: boolean;
  onRemoveHighlight?: (index: number) => void;
  onAddHighlight?: (highlight: Highlight) => void;
}

interface TextSegment {
  text: string;
  highlightIndex: number | null; // index in highlights array, or null for non-highlighted
}

function buildSegments(text: string, highlights: Highlight[]): TextSegment[] {
  if (!highlights.length) return [{ text, highlightIndex: null }];

  // Find all match positions, sorted by position
  const matches: Array<{ start: number; end: number; highlightIndex: number }> = [];
  for (let hi = 0; hi < highlights.length; hi++) {
    const h = highlights[hi];
    let searchFrom = 0;
    // Find first occurrence
    const idx = text.indexOf(h.text, searchFrom);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + h.text.length, highlightIndex: hi });
    }
  }

  // Sort by start position, resolve overlaps by taking first
  matches.sort((a, b) => a.start - b.start);
  const nonOverlapping: typeof matches = [];
  for (const m of matches) {
    if (nonOverlapping.length === 0 || m.start >= nonOverlapping[nonOverlapping.length - 1].end) {
      nonOverlapping.push(m);
    }
  }

  const segments: TextSegment[] = [];
  let pos = 0;
  for (const m of nonOverlapping) {
    if (m.start > pos) {
      segments.push({ text: text.slice(pos, m.start), highlightIndex: null });
    }
    segments.push({ text: text.slice(m.start, m.end), highlightIndex: m.highlightIndex });
    pos = m.end;
  }
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), highlightIndex: null });
  }
  return segments;
}

export function HighlightedText({
  text,
  highlights,
  showHighlights,
  editable = false,
  onRemoveHighlight,
  onAddHighlight,
}: HighlightedTextProps) {
  const segments = useMemo(
    () => (showHighlights ? buildSegments(text, highlights) : [{ text, highlightIndex: null }]),
    [text, highlights, showHighlights]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionPopover, setSelectionPopover] = useState<{ text: string; x: number; y: number } | null>(null);

  const handleMouseUp = useCallback(() => {
    if (!editable || !onAddHighlight) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionPopover(null);
      return;
    }
    const selectedText = sel.toString().trim();
    if (!selectedText || selectedText.length < 2) return;
    // Make sure selected text exists in original problem text
    if (!text.includes(selectedText)) return;
    // Check not already highlighted
    if (highlights.some(h => h.text === selectedText)) return;
    if (highlights.length >= 10) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setSelectionPopover({
        text: selectedText,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 4,
      });
    }
  }, [editable, onAddHighlight, text, highlights]);

  const handleAddFromSelection = (type: Highlight["type"]) => {
    if (!selectionPopover || !onAddHighlight) return;
    onAddHighlight({ text: selectionPopover.text, type });
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={containerRef} className="relative" onMouseUp={handleMouseUp}>
      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
        {segments.map((seg, i) => {
          if (seg.highlightIndex === null) {
            return <span key={i}>{seg.text}</span>;
          }
          const h = highlights[seg.highlightIndex];
          const colorClass = HIGHLIGHT_TYPE_COLORS[h.type] || HIGHLIGHT_TYPE_COLORS.key_input;
          return (
            <span
              key={i}
              className={cn(
                "rounded px-0.5 py-px cursor-default transition-colors",
                colorClass,
                editable && "cursor-pointer"
              )}
              title={`${HIGHLIGHT_TYPE_LABELS[h.type]}: ${h.text}`}
            >
              {seg.text}
              {editable && onRemoveHighlight && (
                <button
                  className="inline-flex items-center ml-0.5 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onRemoveHighlight(seg.highlightIndex!); }}
                  title="Remove highlight"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          );
        })}
      </p>

      {/* Selection popover for adding highlights */}
      {selectionPopover && editable && (
        <div
          className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-2 space-y-1"
          style={{ left: selectionPopover.x, top: selectionPopover.y, transform: "translate(-50%, -100%)" }}
        >
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
            <Plus className="h-2.5 w-2.5 inline mr-0.5" /> Add highlight
          </p>
          <div className="flex flex-wrap gap-1">
            {(["key_input", "rate", "amount", "timing", "rule", "definition"] as const).map(type => (
              <button
                key={type}
                className={cn("text-[9px] px-1.5 py-0.5 rounded", HIGHLIGHT_TYPE_COLORS[type], "hover:ring-1 ring-foreground/20")}
                onClick={() => handleAddFromSelection(type)}
              >
                {HIGHLIGHT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Legend showing highlight type colors */
export function HighlightLegend({ highlights }: { highlights: Highlight[] }) {
  const usedTypes = [...new Set(highlights.map(h => h.type))];
  if (usedTypes.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {usedTypes.map(type => (
        <Badge key={type} variant="outline" className={cn("text-[8px] h-4", HIGHLIGHT_TYPE_COLORS[type])}>
          {HIGHLIGHT_TYPE_LABELS[type]}
        </Badge>
      ))}
    </div>
  );
}

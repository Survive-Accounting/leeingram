import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Scissors, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectAndSplitScenarios, type ScenarioBlock } from "@/lib/scenarioSegmentation";

interface Props {
  problemText: string;
  initialBlocks?: ScenarioBlock[];
  onConfirm: (blocks: ScenarioBlock[]) => void;
  onSkip: () => void;
}

export function ScenarioSplitScreen({ problemText, initialBlocks, onConfirm, onSkip }: Props) {
  const autoDetected = detectAndSplitScenarios(problemText);
  const [blocks, setBlocks] = useState<ScenarioBlock[]>(
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : autoDetected.is_multi_scenario
        ? autoDetected.scenario_blocks
        : [{ label: "Situation 1", text: problemText }]
  );

  const updateBlock = (i: number, patch: Partial<ScenarioBlock>) => {
    setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  };

  const addBlock = () => {
    setBlocks([...blocks, { label: `Situation ${blocks.length + 1}`, text: "" }]);
  };

  const removeBlock = (i: number) => {
    if (blocks.length <= 1) return;
    setBlocks(blocks.filter((_, j) => j !== i));
  };

  const reDetect = () => {
    const result = detectAndSplitScenarios(problemText);
    if (result.is_multi_scenario && result.scenario_blocks.length >= 2) {
      setBlocks(result.scenario_blocks);
    }
  };

  const isMulti = blocks.length >= 2;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Step 0: Scenario Split</span>
          {autoDetected.is_multi_scenario && (
            <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-400 border-amber-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Multi-scenario detected
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reDetect}>
            Re-detect
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSkip}>
            Skip (Single Scenario)
          </Button>
        </div>
      </div>

      {/* Blocks */}
      <div className="p-4 space-y-4">
        {blocks.map((block, i) => (
          <div key={i} className="border border-border/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={block.label}
                onChange={(e) => updateBlock(i, { label: e.target.value })}
                className="h-7 text-xs font-semibold w-40"
                placeholder="Label"
              />
              {blocks.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => removeBlock(i)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
            <Textarea
              value={block.text}
              onChange={(e) => updateBlock(i, { text: e.target.value })}
              placeholder="Paste or edit scenario text..."
              className="text-xs min-h-[100px] font-mono"
            />
          </div>
        ))}

        {/* Add scenario + Confirm */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addBlock}>
            <Plus className="h-3 w-3 mr-1" /> Add Scenario
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => onConfirm(blocks.filter(b => b.text.trim()))}
            disabled={blocks.every(b => !b.text.trim())}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {isMulti ? `Confirm ${blocks.length} Scenarios` : "Confirm Single Scenario"}
          </Button>
        </div>
      </div>
    </div>
  );
}

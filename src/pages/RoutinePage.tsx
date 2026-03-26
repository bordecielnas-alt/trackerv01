import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, RotateCcw, Pencil, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RoutineBlock {
  id: number;
  title: string;
  body: string;
  timecode: number; // seconds
}

const STORAGE_KEY = "routine-blocks";

function loadBlocks(): RoutineBlock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    { id: 1, title: "Bloc 1", body: "", timecode: 300 },
    { id: 2, title: "Bloc 2", body: "", timecode: 600 },
    { id: 3, title: "Bloc 3", body: "", timecode: 900 },
    { id: 4, title: "Bloc 4", body: "", timecode: 1200 },
  ];
}

function saveBlocks(blocks: RoutineBlock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimecode(str: string): number {
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return parts[0] || 0;
}

function renderBodyWithLinks(body: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = body.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline inline-flex items-center gap-1 hover:text-primary/80"
        >
          {part}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function RoutinePage() {
  const [blocks, setBlocks] = useState<RoutineBlock[]>(loadBlocks);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleReset = () => {
    setRunning(false);
    setElapsed(0);
  };

  const updateBlock = useCallback((id: number, updates: Partial<RoutineBlock>) => {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...updates } : b));
      saveBlocks(next);
      return next;
    });
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Routine</h1>

      {/* Stopwatch - sticky */}
      <div className="sticky top-14 z-40 bg-background py-3 border-b border-border">
        <div className="flex items-center gap-4 justify-center">
          <Button
            onClick={() => setRunning(!running)}
            variant={running ? "destructive" : "default"}
            size="lg"
            className="gap-2"
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop" : "Démarrer"}
          </Button>
          <span className="text-4xl font-mono font-bold text-foreground tabular-nums">
            {formatTime(elapsed)}
          </span>
          <Button onClick={handleReset} variant="outline" size="lg" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {blocks.map((block) => {
          const isTriggered = elapsed >= block.timecode && block.timecode > 0;
          const isEditing = editingId === block.id;

          return (
            <Card
              key={block.id}
              className={cn(
                "transition-colors duration-300",
                isTriggered && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {isEditing ? (
                  <Input
                    value={block.title}
                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                    className="text-lg font-semibold h-8 w-auto"
                  />
                ) : (
                  <CardTitle className="text-lg">{block.title}</CardTitle>
                )}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Timecode:</span>
                      <Input
                        value={formatTime(block.timecode)}
                        onChange={(e) => updateBlock(block.id, { timecode: parseTimecode(e.target.value) })}
                        className="w-24 h-8 text-center font-mono text-sm"
                        placeholder="HH:MM:SS"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTime(block.timecode)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(isEditing ? null : block.id)}
                  >
                    {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={block.body}
                    onChange={(e) => updateBlock(block.id, { body: e.target.value })}
                    rows={4}
                    placeholder="Contenu du bloc... Les URLs seront automatiquement cliquables."
                  />
                ) : (
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {block.body ? renderBodyWithLinks(block.body) : (
                      <span className="text-muted-foreground italic">Cliquez sur l'icône crayon pour éditer</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
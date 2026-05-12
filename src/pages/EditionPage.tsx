import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Upload, Settings } from "lucide-react";
import {
  getSettingsAsync, saveSettingsAsync, getEntriesAsync, saveEntriesAsync, computeScore,
  getPreferencesAsync, savePreferencesAsync,
  type TrackingParameter, type TrackingSettings, type DailyEntry,
} from "@/lib/tracking-store";

function entriesToCsv(entries: DailyEntry[], parameters: TrackingParameter[], formula: string): string {
  const headers = ["date", "score", "comment", ...parameters.map((p) => p.name)];
  const rows = entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const score = computeScore(e.values, parameters, formula);
      const comment = `"${(e.comment || "").replace(/"/g, '""')}"`;
      const vals = parameters.map((p) => String(e.values[p.id] ?? ""));
      return [e.date, score !== null ? String(score) : "", comment, ...vals].join(",");
    });
  return [headers.join(","), ...rows].join("\n");
}

function csvToEntries(csv: string, parameters: TrackingParameter[]): DailyEntry[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const paramIndexMap: Record<string, number> = {};
  parameters.forEach((p) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === p.name.toLowerCase());
    if (idx >= 0) paramIndexMap[p.id] = idx;
  });
  const commentIdx = headers.findIndex((h) => h.toLowerCase() === "comment" || h.toLowerCase() === "commentaire");
  const dateIdx = headers.findIndex((h) => h.toLowerCase() === "date");

  const entries: DailyEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols[dateIdx]) continue;
    const values: Record<string, number> = {};
    parameters.forEach((p) => {
      if (paramIndexMap[p.id] !== undefined) {
        const v = parseFloat(cols[paramIndexMap[p.id]]);
        values[p.id] = isNaN(v) ? p.defaultValue : v;
      }
    });
    let comment = commentIdx >= 0 ? (cols[commentIdx] || "") : "";
    comment = comment.replace(/^"|"$/g, "").replace(/""/g, '"');
    entries.push({ date: cols[dateIdx], values, comment });
  }
  return entries;
}

function settingsToCsv(settings: TrackingSettings): string {
  const lines = [
    "type,name,defaultValue,min,max,step,order",
    ...settings.parameters
      .sort((a, b) => a.order - b.order)
      .map((p) =>
        ["parameter", `"${p.name.replace(/"/g, '""')}"`, p.defaultValue, p.min, p.max, p.step, p.order].join(",")
      ),
    "",
    "type,value",
    `formula,"${(settings.scoreFormula || "").replace(/"/g, '""')}"`,
  ];
  return lines.join("\n");
}

function csvToSettings(csv: string): TrackingSettings | null {
  const lines = csv.trim().split("\n");
  const parameters: TrackingParameter[] = [];
  let scoreFormula = "";
  let section: "params" | "formula" | null = null;

  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols[0]?.toLowerCase() === "type" && cols[1]?.toLowerCase() === "name") {
      section = "params"; continue;
    }
    if (cols[0]?.toLowerCase() === "type" && cols[1]?.toLowerCase() === "value") {
      section = "formula"; continue;
    }
    if (!cols[0]?.trim()) continue;

    if (section === "params" && cols[0].toLowerCase() === "parameter") {
      parameters.push({
        id: crypto.randomUUID(),
        name: cols[1] || "",
        defaultValue: parseFloat(cols[2]) || 0,
        min: parseFloat(cols[3]) || 0,
        max: parseFloat(cols[4]) || 10,
        step: parseFloat(cols[5]) || 1,
        order: parseFloat(cols[6]) || parameters.length,
      });
    }
    if (section === "formula" && cols[0].toLowerCase() === "formula") {
      scoreFormula = cols[1] || "";
    }
  }

  if (parameters.length === 0 && !scoreFormula) return null;
  return { parameters, scoreFormula };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export default function EditionPage() {
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [formula, setFormula] = useState("");
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const reload = async () => {
    const settings = await getSettingsAsync();
    setParameters(settings.parameters);
    setFormula(settings.scoreFormula);
    setEntries(await getEntriesAsync());
    const prefs = await getPreferencesAsync();
    if (prefs.colWidths) setColWidths(prefs.colWidths as Record<string, number>);
  };

  useEffect(() => {
    reload();
  }, []);

  const handleColResize = useCallback(async (key: string, w: number) => {
    setColWidths((prev) => {
      const next = { ...prev, [key]: w };
      // Save async
      getPreferencesAsync().then((prefs) => {
        savePreferencesAsync({ ...prefs, colWidths: next });
      });
      return next;
    });
  }, []);

  const handleValueChange = (date: string, paramId: string, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.date === date
          ? { ...e, values: { ...e.values, [paramId]: Number(value) } }
          : e
      )
    );
  };

  const handleCommentChange = (date: string, comment: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.date === date ? { ...e, comment } : e))
    );
  };

  const handleSave = async () => {
    await saveEntriesAsync(entries);
    toast.success("Modifications enregistrées !");
  };

  const handleExport = () => {
    const csv = entriesToCsv(entries, parameters, formula);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracking-data-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export données CSV téléchargé !");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const csv = ev.target?.result as string;
        const imported = csvToEntries(csv, parameters);
        if (imported.length === 0) {
          toast.error("Aucune donnée importée. Vérifiez le format du fichier.");
          return;
        }
        const merged = [...entries];
        imported.forEach((imp) => {
          const idx = merged.findIndex((e) => e.date === imp.date);
          if (idx >= 0) merged[idx] = imp;
          else merged.push(imp);
        });
        merged.sort((a, b) => a.date.localeCompare(b.date));
        await saveEntriesAsync(merged);
        setEntries(merged);
        toast.success(`${imported.length} entrée(s) importée(s) !`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportConfig = async () => {
    const settings = await getSettingsAsync();
    const csv = settingsToCsv(settings);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracking-config-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export configuration CSV téléchargé !");
  };

  const handleImportConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const csv = ev.target?.result as string;
        const imported = csvToSettings(csv);
        if (!imported) {
          toast.error("Aucune configuration importée. Vérifiez le format.");
          return;
        }
        await saveSettingsAsync(imported);
        setParameters(imported.parameters);
        setFormula(imported.scoreFormula);
        toast.success(`Configuration importée (${imported.parameters.length} paramètre(s)) !`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Historique</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleImportConfig} className="gap-1 sm:gap-2">
            <Settings className="h-4 w-4" />
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importer Config</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportConfig} className="gap-1 sm:gap-2">
            <Settings className="h-4 w-4" />
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter Config</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport} className="gap-1 sm:gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importer CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 sm:gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </Button>
          <Button size="sm" onClick={handleSave}>Enregistrer tout</Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune donnée enregistrée.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-200px)]">
              <ResizableTable
                parameters={parameters}
                entries={entries}
                formula={formula}
                colWidths={colWidths}
                onColResize={handleColResize}
                onValueChange={handleValueChange}
                onCommentChange={handleCommentChange}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResizableHeader({
  children,
  width,
  onResize,
  className,
}: {
  children: React.ReactNode;
  width?: number;
  onResize: (w: number) => void;
  className?: string;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = thRef.current?.offsetWidth || 100;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(50, startW.current + ev.clientX - startX.current);
      onResize(newW);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <th
      ref={thRef}
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
      className={`px-2 sm:px-3 py-2 font-medium text-muted-foreground whitespace-nowrap relative select-none ${className || ""}`}
    >
      {children}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40"
        onMouseDown={onMouseDown}
      />
    </th>
  );
}

function ResizableTable({
  parameters,
  entries,
  formula,
  colWidths,
  onColResize,
  onValueChange,
  onCommentChange,
}: {
  parameters: TrackingParameter[];
  entries: DailyEntry[];
  formula: string;
  colWidths: Record<string, number>;
  onColResize: (key: string, w: number) => void;
  onValueChange: (date: string, paramId: string, value: string) => void;
  onCommentChange: (date: string, comment: string) => void;
}) {
  const sorted = [...parameters].sort((a, b) => a.order - b.order);

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border bg-muted/95 backdrop-blur-sm">
          <ResizableHeader width={colWidths["date"]} onResize={(w) => onColResize("date", w)} className="text-left sticky left-0 bg-muted/95">
            Date
          </ResizableHeader>
          <ResizableHeader width={colWidths["score"]} onResize={(w) => onColResize("score", w)} className="text-center">
            Score
          </ResizableHeader>
          <ResizableHeader width={colWidths["comment"]} onResize={(w) => onColResize("comment", w)} className="text-left">
            Commentaire
          </ResizableHeader>
          {sorted.map((p) => (
            <ResizableHeader key={p.id} width={colWidths[p.id]} onResize={(w) => onColResize(p.id, w)} className="text-center">
              {p.name}
            </ResizableHeader>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((entry) => {
            const score = computeScore(entry.values, parameters, formula);
            return (
              <tr key={entry.date} className="border-b border-border/50 hover:bg-accent/20">
                <td className="px-2 sm:px-3 py-2 font-medium text-foreground whitespace-nowrap sticky left-0 bg-card">
                  {entry.date}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center font-semibold text-primary tabular-nums">
                  {score !== null ? score : "—"}
                </td>
                <td className="px-2 sm:px-3 py-2">
                  <Input
                    className="h-8 min-w-[120px] sm:min-w-[150px]"
                    value={entry.comment}
                    onChange={(e) => onCommentChange(entry.date, e.target.value)}
                  />
                </td>
                {sorted.map((p) => (
                  <td key={p.id} className="px-2 sm:px-3 py-2">
                    <Input
                      type="number"
                      className="w-16 sm:w-20 h-8 text-center mx-auto"
                      value={entry.values[p.id] ?? ""}
                      onChange={(e) => onValueChange(entry.date, p.id, e.target.value)}
                      min={p.min}
                      max={p.max}
                      step={p.step}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}

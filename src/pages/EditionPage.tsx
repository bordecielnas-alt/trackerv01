import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import {
  getSettings, getEntries, saveEntries,
  type TrackingParameter, type DailyEntry,
} from "@/lib/tracking-store";

function entriesToCsv(entries: DailyEntry[], parameters: TrackingParameter[]): string {
  const headers = ["date", ...parameters.map((p) => p.name), "comment"];
  const rows = entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const vals = parameters.map((p) => String(e.values[p.id] ?? ""));
      const comment = `"${(e.comment || "").replace(/"/g, '""')}"`;
      return [e.date, ...vals, comment].join(",");
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

  const reload = () => {
    setParameters(getSettings().parameters);
    setEntries(getEntries());
  };

  useEffect(() => {
    reload();
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

  const handleSave = () => {
    saveEntries(entries);
    toast.success("Modifications enregistrées !");
  };

  const handleExport = () => {
    const csv = entriesToCsv(entries, parameters);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracking-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé !");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const csv = ev.target?.result as string;
        const imported = csvToEntries(csv, parameters);
        if (imported.length === 0) {
          toast.error("Aucune donnée importée. Vérifiez le format du fichier.");
          return;
        }
        // Merge: imported entries overwrite existing ones by date
        const merged = [...entries];
        imported.forEach((imp) => {
          const idx = merged.findIndex((e) => e.date === imp.date);
          if (idx >= 0) merged[idx] = imp;
          else merged.push(imp);
        });
        merged.sort((a, b) => a.date.localeCompare(b.date));
        saveEntries(merged);
        setEntries(merged);
        toast.success(`${imported.length} entrée(s) importée(s) !`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Édition</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Importer CSV
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
          <Button onClick={handleSave}>Enregistrer tout</Button>
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
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50">
                    Date
                  </th>
                  {parameters.map((p) => (
                    <th key={p.id} className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">
                      {p.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Commentaire
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => (
                    <tr key={entry.date} className="border-b border-border/50 hover:bg-accent/20">
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap sticky left-0 bg-card">
                        {entry.date}
                      </td>
                      {parameters.map((p) => (
                        <td key={p.id} className="px-3 py-2">
                          <Input
                            type="number"
                            className="w-20 h-8 text-center mx-auto"
                            value={entry.values[p.id] ?? ""}
                            onChange={(e) =>
                              handleValueChange(entry.date, p.id, e.target.value)
                            }
                            min={p.min}
                            max={p.max}
                            step={p.step}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 min-w-[150px]"
                          value={entry.comment}
                          onChange={(e) =>
                            handleCommentChange(entry.date, e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getSettings, getEntries, saveEntries,
  type TrackingParameter, type DailyEntry,
} from "@/lib/tracking-store";

export default function EditionPage() {
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);

  useEffect(() => {
    setParameters(getSettings().parameters);
    setEntries(getEntries());
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Édition</h1>
        <Button onClick={handleSave}>Enregistrer tout</Button>
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

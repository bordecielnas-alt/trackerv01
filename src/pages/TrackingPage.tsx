import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getSettings,
  getEntry,
  saveEntry,
  computeScore,
  formatDate,
  type TrackingParameter,
  type DailyEntry,
} from "@/lib/tracking-store";

// Persist selected date across tab switches
let persistedDate: Date = new Date();

export default function TrackingPage() {
  const [date, setDate] = useState<Date>(persistedDate);
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [formula, setFormula] = useState("");
  const [isExistingEntry, setIsExistingEntry] = useState(false);

  const loadData = useCallback(() => {
    const settings = getSettings();
    setParameters(settings.parameters);
    setFormula(settings.scoreFormula);
    const dateStr = formatDate(date);
    const entry = getEntry(dateStr);
    if (entry) {
      setValues(entry.values);
      setComment(entry.comment);
      setIsExistingEntry(true);
    } else {
      const defaults: Record<string, number> = {};
      settings.parameters.forEach((p) => (defaults[p.id] = p.defaultValue));
      setValues(defaults);
      setComment("");
      setIsExistingEntry(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Persist date when it changes
  useEffect(() => {
    persistedDate = date;
  }, [date]);

  const score = computeScore(values, parameters, formula);

  const handleSave = () => {
    const entry: DailyEntry = {
      date: formatDate(date),
      values,
      comment,
    };
    saveEntry(entry);
    setIsExistingEntry(true);
    toast.success(isExistingEntry ? "Données mises à jour !" : "Données enregistrées !");
  };

  const handleValueChange = (paramId: string, val: number[]) => {
    setValues((prev) => ({ ...prev, [paramId]: val[0] }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Date picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {format(date, "EEEE d MMMM yyyy", { locale: fr })}
        </h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Score */}
      {score !== null && (
        <Card className="border-2 border-primary/20 bg-accent/30">
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm font-medium text-muted-foreground">Score</span>
            <span className="text-3xl font-bold text-primary">{score}</span>
          </CardContent>
        </Card>
      )}

      {/* Parameters */}
      {parameters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun paramètre configuré. Allez dans Réglages pour en ajouter.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {parameters
              .sort((a, b) => a.order - b.order)
              .map((p) => (
                <div key={p.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">{p.name}</label>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      {values[p.id] ?? p.defaultValue}
                    </span>
                  </div>
                  <Slider
                    value={[values[p.id] ?? p.defaultValue]}
                    onValueChange={(v) => handleValueChange(p.id, v)}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.min}</span>
                    <span>{p.max}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Comment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Commentaire</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Notes du jour..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <Button
        onClick={handleSave}
        className={cn(
          "w-full gap-2",
          isExistingEntry
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-green-600 text-white hover:bg-green-700"
        )}
        size="lg"
      >
        <Save className="h-4 w-4" />
        {isExistingEntry ? "Mettre à jour" : "Enregistrer"}
      </Button>
    </div>
  );
}

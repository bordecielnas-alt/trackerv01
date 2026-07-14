import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Activity, RefreshCw, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { HealthData, HealthItem, loadHealthData, saveHealthData, syncGoogleHealth, loadHealthConfig } from "@/lib/health-store";
import { cn } from "@/lib/utils";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function last30Dates(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return out;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData>({ items: [], notes: {} });
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const dates = useMemo(() => last30Dates(), []);

  useEffect(() => {
    loadHealthData().then(setData);
    loadHealthConfig().then(c => setConfigured(c.enabled && c.hasToken));
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, HealthItem>();
    for (const it of data.items) m.set(it.date, it);
    return m;
  }, [data]);

  const upsert = async (date: string, patch: Partial<HealthItem>) => {
    const items = [...data.items];
    const idx = items.findIndex(i => i.date === date);
    const base: HealthItem = idx >= 0 ? items[idx] : { date, source: "manual" };
    const next: HealthItem = { ...base, ...patch };
    if (idx >= 0) items[idx] = next; else items.push(next);
    items.sort((a, b) => a.date.localeCompare(b.date));
    const nd: HealthData = { ...data, items };
    setData(nd);
    await saveHealthData(nd);
  };

  const handleSync = async () => {
    setSyncing(true);
    const r = await syncGoogleHealth();
    setSyncing(false);
    if (r.ok) {
      toast({ title: `Synchronisé (${r.days} jours)` });
      loadHealthData().then(setData);
    } else {
      toast({ title: "Synchronisation impossible", description: r.error, variant: "destructive" });
    }
  };

  const today = todayStr();
  const todayItem = byDate.get(today) || { date: today, source: "manual" as const };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6 text-primary" /> Health</h1>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || !configured} className="gap-1.5">
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          {configured ? "Synchroniser Google" : "Non configuré"}
        </Button>
      </div>

      {!configured && (
        <Card className="p-3 text-sm text-muted-foreground">
          Google Health n'est pas configuré. Vous pouvez saisir vos données manuellement ci-dessous. Pour activer la synchronisation Google Fit, allez dans <b>Réglages → Santé (Google Health)</b>.
        </Card>
      )}

      {/* Today quick entry */}
      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Aujourd'hui — {today}</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Field label="Pas" value={todayItem.steps} onChange={(v) => upsert(today, { steps: v })} />
          <Field label="Sommeil (h)" value={todayItem.sleep} step={0.1} onChange={(v) => upsert(today, { sleep: v })} />
          <Field label="Poids (kg)" value={todayItem.weight} step={0.1} onChange={(v) => upsert(today, { weight: v })} />
          <Field label="FC repos" value={todayItem.restingHR} onChange={(v) => upsert(today, { restingHR: v })} />
          <Field label="Humeur (1-5)" value={todayItem.mood} min={1} max={5} onChange={(v) => upsert(today, { mood: v })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Note</label>
          <Textarea rows={2} value={todayItem.note || ""} onChange={(e) => upsert(today, { note: e.target.value })} />
        </div>
      </Card>

      {/* 30-day table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
            <tr>
              <th className="text-left p-2 font-medium">Date</th>
              <th className="text-right p-2 font-medium">Pas</th>
              <th className="text-right p-2 font-medium">Sommeil</th>
              <th className="text-right p-2 font-medium">Poids</th>
              <th className="text-right p-2 font-medium">FC repos</th>
              <th className="text-right p-2 font-medium">Humeur</th>
              <th className="text-left p-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {[...dates].reverse().map(d => {
              const it = byDate.get(d);
              return (
                <tr key={d} className="border-t hover:bg-muted/30">
                  <td className="p-2">{d}</td>
                  <td className="p-2 text-right">{it?.steps ?? "—"}</td>
                  <td className="p-2 text-right">{it?.sleep ?? "—"}</td>
                  <td className="p-2 text-right">{it?.weight ?? "—"}</td>
                  <td className="p-2 text-right">{it?.restingHR ?? "—"}</td>
                  <td className="p-2 text-right">{it?.mood ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{it?.source || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, step, min, max }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; step?: number; min?: number; max?: number }) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  useEffect(() => { setLocal(value == null ? "" : String(value)); }, [value]);
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="number" step={step || 1} min={min} max={max} value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local === "" ? null : Number(local))} />
    </div>
  );
}

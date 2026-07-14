import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { CorrelationData, CorrItem, dailyAverage, loadCorrelation, pearson, saveCorrelation, DailySlots } from "@/lib/correlation-store";
import { loadHealthData, HealthItem } from "@/lib/health-store";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SLOTS: ("m" | "n" | "e")[] = ["m", "n", "e"];
const SLOT_LABEL: Record<string, string> = { m: "Matin", n: "Midi", e: "Soir" };
const WINDOW = 14;
const RANGE_PAST = 365;
const RANGE_FUTURE = 30;

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default function CorrelationPage() {
  const [data, setData] = useState<CorrelationData>({ items: [], scores: {} });
  const [health, setHealth] = useState<HealthItem[]>([]);
  // offset in days relative to today for the CENTER of the window; 0 = today at center
  const [centerOffset, setCenterOffset] = useState<number>(0);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadCorrelation().then(setData);
    loadHealthData().then(d => setHealth(d.items));
  }, []);

  const dates = useMemo(() => {
    const today = new Date();
    const center = addDays(today, centerOffset);
    const start = addDays(center, -Math.floor(WINDOW / 2));
    return Array.from({ length: WINDOW }, (_, i) => fmt(addDays(start, i)));
  }, [centerOffset]);

  const todayStr = fmt(new Date());

  const persist = async (nd: CorrelationData) => { setData(nd); await saveCorrelation(nd); };

  const setScore = (date: string, itemId: string, slot: "m" | "n" | "e", v: number | null) => {
    const scores = { ...data.scores };
    const byItem = { ...(scores[date] || {}) };
    const slots: DailySlots = { ...(byItem[itemId] || {}) };
    if (v == null) delete slots[slot]; else slots[slot] = v;
    byItem[itemId] = slots;
    scores[date] = byItem;
    persist({ ...data, scores });
  };

  const addItem = () => {
    if (!newName.trim()) return;
    const it: CorrItem = { id: Math.random().toString(36).slice(2, 10), name: newName.trim(), status: "active" };
    persist({ ...data, items: [...data.items, it] });
    setNewName("");
  };

  const removeItem = (id: string) => {
    const items = data.items.filter(i => i.id !== id);
    const scores: CorrelationData["scores"] = {};
    for (const [d, byItem] of Object.entries(data.scores)) {
      const nb: Record<string, DailySlots> = {};
      for (const [iid, s] of Object.entries(byItem)) if (iid !== id) nb[iid] = s;
      scores[d] = nb;
    }
    persist({ items, scores });
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    const items = [...data.items];
    const idx = items.findIndex(i => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    persist({ ...data, items });
  };

  const correlations = useMemo(() => {
    const series: Record<string, Record<string, number>> = {};
    const activeCorr = data.items.filter(i => i.status !== "archived");
    for (const it of activeCorr) {
      const s: Record<string, number> = {};
      for (const [d, byItem] of Object.entries(data.scores)) {
        const avg = dailyAverage(byItem[it.id]);
        if (avg != null) s[d] = avg;
      }
      if (Object.keys(s).length >= 3) series[`◐ ${it.name}`] = s;
    }
    const metrics: (keyof HealthItem)[] = ["steps", "sleep", "weight", "restingHR", "mood"];
    for (const m of metrics) {
      const s: Record<string, number> = {};
      for (const h of health) {
        const v = h[m];
        if (typeof v === "number") s[h.date] = v;
      }
      if (Object.keys(s).length >= 3) series[`♡ ${m}`] = s;
    }
    const names = Object.keys(series);
    const pairs: { a: string; b: string; r: number; n: number }[] = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const A = series[names[i]], B = series[names[j]];
        const commonDates = Object.keys(A).filter(d => B[d] != null);
        if (commonDates.length < 3) continue;
        const x = commonDates.map(d => A[d]);
        const y = commonDates.map(d => B[d]);
        const r = pearson(x, y);
        if (r != null && !Number.isNaN(r)) pairs.push({ a: names[i], b: names[j], r, n: commonDates.length });
      }
    }
    pairs.sort((p, q) => Math.abs(q.r) - Math.abs(p.r));
    return pairs.slice(0, 20);
  }, [data, health]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Correlation</h1>

      <Card className="p-4 space-y-3">
        <div className="font-semibold">Corrélations (toutes périodes)</div>
        {correlations.length === 0 && <div className="text-sm text-muted-foreground">Renseignez au moins 3 jours pour voir des corrélations apparaître.</div>}
        <div className="space-y-1">
          {correlations.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="flex-1 truncate">{p.a} <span className="text-muted-foreground">×</span> {p.b}</div>
              <div className={cn("font-mono text-xs px-2 py-0.5 rounded",
                p.r > 0.3 ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                p.r < -0.3 ? "bg-red-500/20 text-red-700 dark:text-red-400" :
                "bg-muted text-muted-foreground")}>
                r = {p.r.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground w-10 text-right">n={p.n}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Variable à analyser" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} />
          <Button onClick={addItem} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
        {data.items.length === 0 && <div className="text-sm text-muted-foreground">Aucun item. Ajoutez-en pour commencer.</div>}
      </Card>

      <Card className="overflow-x-auto">
        <div className="p-3 border-b bg-muted/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{dates[0]}</span>
            <button
              onClick={() => setCenterOffset(0)}
              className="text-xs font-medium text-primary hover:underline"
              title="Recentrer sur aujourd'hui"
            >
              Aujourd'hui
            </button>
            <span>{dates[dates.length - 1]}</span>
          </div>
          <Slider
            min={-RANGE_PAST}
            max={RANGE_FUTURE}
            step={1}
            value={[centerOffset]}
            onValueChange={(v) => setCenterOffset(v[0])}
          />
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2 font-medium sticky left-0 bg-muted/40 w-auto whitespace-nowrap">Item</th>
              {dates.map(d => (
                <th key={d} className={cn("p-1 font-medium text-center border-l", d === todayStr && "bg-primary/10")} colSpan={3}>
                  <div>{d.slice(5)}</div>
                  <div className="flex text-[9px] text-muted-foreground">
                    <div className="flex-1">M</div><div className="flex-1">N</div><div className="flex-1">S</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, idx) => (
              <tr key={it.id} className="border-t">
                <td className="p-1 sticky left-0 bg-card w-auto whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col">
                      <button
                        className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => moveItem(it.id, -1)}
                        title="Monter"
                      ><ArrowUp className="h-3 w-3" /></button>
                      <button
                        className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === data.items.length - 1}
                        onClick={() => moveItem(it.id, 1)}
                        title="Descendre"
                      ><ArrowDown className="h-3 w-3" /></button>
                    </div>
                    <Select value={it.status} onValueChange={(v) => persist({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, status: v as CorrItem["status"] } : x) })}>
                      <SelectTrigger className="h-6 w-6 p-0 border-0" title={it.status}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="persistent">Persistant</SelectItem>
                        <SelectItem value="archived">Archivé</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="h-7 text-xs border-0 min-w-[8ch]" style={{ width: `${Math.max(it.name.length + 2, 10)}ch` }} value={it.name}
                      onChange={(e) => setData({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, name: e.target.value } : x) })}
                      onBlur={() => saveCorrelation(data)} />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(it.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </td>
                {dates.map(d => (
                  <ScoreCell key={d} date={d} slots={data.scores[d]?.[it.id]}
                    onSet={(slot, v) => setScore(d, it.id, slot, v)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ScoreCell({ slots, onSet }: { date: string; slots?: DailySlots; onSet: (slot: "m" | "n" | "e", v: number | null) => void }) {
  return (
    <>
      {SLOTS.map(s => {
        const v = slots?.[s];
        return (
          <td key={s} className="p-0.5 border-l text-center">
            <button
              className={cn(
                "w-6 h-6 text-[10px] rounded transition font-medium",
                v === 0 && "bg-red-500/60 text-red-50 dark:bg-red-600/70",
                v === 1 && "bg-orange-400/60 text-orange-950 dark:text-orange-50",
                v === 2 && "bg-lime-400/60 text-lime-950 dark:text-lime-50",
                v === 3 && "bg-green-500/70 text-green-50 dark:bg-green-600/80",
                v == null && "border border-dashed border-border hover:bg-accent"
              )}
              title={SLOT_LABEL[s]}
              onClick={() => onSet(s, v == null ? 0 : v >= 3 ? null : v + 1)}
            >
              {v ?? ""}
            </button>
          </td>
        );
      })}
    </>
  );
}

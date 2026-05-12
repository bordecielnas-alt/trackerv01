import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { subDays, parseISO, isAfter, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";
import {
  getSettingsAsync, getEntriesAsync, computeScore, type TrackingParameter, type DailyEntry,
} from "@/lib/tracking-store";

const CHART_COLORS = [
  "hsl(174, 60%, 32%)", "hsl(35, 80%, 56%)", "hsl(280, 50%, 50%)",
  "hsl(200, 60%, 50%)", "hsl(340, 60%, 50%)",
];

const TIME_RANGES = [
  { label: "7j", days: 7 },
  { label: "1 mois", days: 30 },
  { label: "3 mois", days: 90 },
  { label: "6 mois", days: 180 },
  { label: "1 an", days: 365 },
];

function linearRegression(data: { x: number; y: number }[]) {
  if (data.length < 2) return null;
  const n = data.length;
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

interface TrendInfo {
  current: number | null;
  change: number | null;
  changePercent: number | null;
  direction: "up" | "down" | "flat";
  avg: number | null;
  min: number | null;
  max: number | null;
}

function computeTrend(data: Record<string, unknown>[], key: string): TrendInfo {
  const values = data.map(d => d[key] as number).filter(v => v !== null && v !== undefined && !isNaN(v));
  if (values.length === 0) return { current: null, change: null, changePercent: null, direction: "flat", avg: null, min: null, max: null };

  const current = values[values.length - 1];
  const half = Math.floor(values.length / 2);
  const recentAvg = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const olderAvg = values.slice(0, half || 1).reduce((a, b) => a + b, 0) / (half || 1);
  const change = Math.round((recentAvg - olderAvg) * 100) / 100;
  const changePercent = olderAvg !== 0 ? Math.round((change / Math.abs(olderAvg)) * 10000) / 100 : null;
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
  const min = Math.round(Math.min(...values) * 100) / 100;
  const max = Math.round(Math.max(...values) * 100) / 100;
  const direction = Math.abs(change) < 0.01 ? "flat" : change > 0 ? "up" : "down";

  return { current, change, changePercent, direction, avg, min, max };
}

function TrendBadge({ trend, positiveIsGood = true }: { trend: TrendInfo; positiveIsGood?: boolean }) {
  if (trend.current === null) return null;
  const isGood = positiveIsGood ? trend.direction === "up" : trend.direction === "down";
  const isBad = positiveIsGood ? trend.direction === "down" : trend.direction === "up";

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Dernier:</span>
        <span className="font-semibold text-foreground">{trend.current}</span>
      </div>
      {trend.change !== null && (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
          isGood ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
          isBad ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
          "bg-muted text-muted-foreground"
        }`}>
          {trend.direction === "up" ? <TrendingUp className="h-3 w-3" /> :
           trend.direction === "down" ? <TrendingDown className="h-3 w-3" /> :
           <Minus className="h-3 w-3" />}
          <span>{trend.change > 0 ? "+" : ""}{trend.change}</span>
          {trend.changePercent !== null && <span>({trend.changePercent > 0 ? "+" : ""}{trend.changePercent}%)</span>}
        </div>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Moy: <span className="font-medium text-foreground">{trend.avg}</span></span>
        <span className="flex items-center gap-0.5"><ArrowDown className="h-3 w-3" />{trend.min}</span>
        <span className="flex items-center gap-0.5"><ArrowUp className="h-3 w-3" />{trend.max}</span>
      </div>
    </div>
  );
}

interface TooltipPayloadItem {
  name: string;
  value: number | string;
  color: string;
  payload?: Record<string, unknown>;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const comment = (payload[0]?.payload?._comment as string) || "";
  return (
    <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-md p-3 text-xs min-w-[140px]">
      <div className="font-semibold mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium">{p.value}</span>
          </div>
        ))}
      </div>
      {comment && (
        <div className="mt-2 pt-2 border-t border-border italic text-muted-foreground whitespace-pre-wrap break-words max-w-[260px]">
          {comment}
        </div>
      )}
    </div>
  );
}

export default function StatisticsPage() {
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [formula, setFormula] = useState("");
  const [rangeDays, setRangeDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [visibleParams, setVisibleParams] = useState<string[]>([]);
  const [activeDot, setActiveDot] = useState(false);
  const [showRegression, setShowRegression] = useState(false);

  useEffect(() => {
    async function load() {
      const s = await getSettingsAsync();
      setParameters(s.parameters);
      setFormula(s.scoreFormula);
      setEntries(await getEntriesAsync());
    }
    load();
  }, []);

  const filteredData = useMemo(() => {
    const startDate = subDays(new Date(), rangeDays);
    return entries
      .filter((e) => isAfter(parseISO(e.date), startDate))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e, i) => {
        const row: Record<string, unknown> = {
          date: format(parseISO(e.date), "dd/MM", { locale: fr }),
          index: i,
        };
        parameters.forEach((p) => {
          row[p.name] = e.values[p.id] ?? null;
        });
        row["Score"] = computeScore(e.values, parameters, formula);
        return row;
      });
  }, [entries, parameters, formula, rangeDays]);

  const chartData = useMemo(() => {
    if (!showRegression || chartType !== "line") return filteredData;
    let data = filteredData.map((d) => ({ ...d }));

    const scorePts = data
      .map((d, i) => ({ x: i, y: d["Score"] as number }))
      .filter((d) => d.y !== null && d.y !== undefined);
    const scoreReg = linearRegression(scorePts);
    if (scoreReg) {
      data = data.map((d, i) => ({
        ...d,
        "Score (tendance)": Math.round((scoreReg.slope * i + scoreReg.intercept) * 100) / 100,
      }));
    }

    parameters.forEach((p) => {
      if (!visibleParams.includes(p.id)) return;
      const pts = data
        .map((d, i) => ({ x: i, y: d[p.name] as number }))
        .filter((d) => d.y !== null && d.y !== undefined);
      const reg = linearRegression(pts);
      if (reg) {
        data = data.map((d, i) => ({
          ...d,
          [`${p.name} (tendance)`]: Math.round((reg.slope * i + reg.intercept) * 100) / 100,
        }));
      }
    });

    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, showRegression, chartType, parameters, JSON.stringify(visibleParams)]);

  // Compute trends
  const scoreTrend = useMemo(() => computeTrend(filteredData, "Score"), [filteredData]);

  const toggleParam = (id: string) => {
    setVisibleParams((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      return [...prev, id];
    });
  };

  const handleCustomDays = () => {
    const d = parseInt(customDays);
    if (d > 0) setRangeDays(d);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setActiveDot(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {TIME_RANGES.map((r) => (
          <Button key={r.days} variant={rangeDays === r.days ? "default" : "outline"} size="sm" onClick={() => setRangeDays(r.days)}>
            {r.label}
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <Input type="number" placeholder="Jours" className="w-20 h-8" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
          <Button size="sm" variant="outline" onClick={handleCustomDays}>OK</Button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button variant={chartType === "line" ? "default" : "outline"} size="sm" onClick={() => setChartType("line")}>Courbe</Button>
          <Button variant={chartType === "bar" ? "default" : "outline"} size="sm" onClick={() => setChartType("bar")}>Histogramme</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={showRegression} onCheckedChange={setShowRegression} />
        <Label className="text-sm">Régression linéaire</Label>
      </div>

      {parameters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {parameters.map((p, i) => (
            <Button
              key={p.id}
              variant={visibleParams.includes(p.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleParam(p.id)}
              style={visibleParams.includes(p.id) ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : {}}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}

      {/* Score chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Score</CardTitle>
          <TrendBadge trend={scoreTrend} />
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Pas de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {chartType === "line" ? (
                <LineChart data={chartData} onClick={() => setActiveDot(true)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Score" stroke="hsl(174, 60%, 32%)" strokeWidth={2} dot={activeDot ? { r: 3 } : false} />
                  {showRegression && (
                    <Line type="monotone" dataKey="Score (tendance)" stroke="hsl(0, 72%, 51%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Score" fill="hsl(174, 60%, 32%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Parameter charts */}
      {visibleParams
        .map((id) => parameters.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => {
          const paramIdx = parameters.findIndex((pp) => pp.id === p!.id);
          const paramTrend = computeTrend(filteredData, p!.name);
          return (
            <Card key={p!.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{p!.name}</CardTitle>
                <TrendBadge trend={paramTrend} />
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  {chartType === "line" ? (
                    <LineChart data={chartData} onClick={() => setActiveDot(true)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey={p!.name} stroke={CHART_COLORS[paramIdx % CHART_COLORS.length]} strokeWidth={2} dot={activeDot ? { r: 3 } : false} />
                      {showRegression && (
                        <Line type="monotone" dataKey={`${p!.name} (tendance)`} stroke="hsl(0, 72%, 51%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      )}
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey={p!.name} fill={CHART_COLORS[paramIdx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

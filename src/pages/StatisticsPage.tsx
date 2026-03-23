import { useState, useEffect, useMemo } from "react";
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
import {
  getSettings, getEntries, computeScore, type TrackingParameter, type DailyEntry,
} from "@/lib/tracking-store";

const CHART_COLORS = [
  "hsl(174, 60%, 32%)", "hsl(35, 80%, 56%)", "hsl(280, 50%, 50%)",
  "hsl(200, 60%, 50%)", "hsl(340, 60%, 50%)",
];

const TIME_RANGES = [
  { label: "7j", days: 7 },
  { label: "1 mois", days: 30 },
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

export default function StatisticsPage() {
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [formula, setFormula] = useState("");
  const [rangeDays, setRangeDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [visibleParams, setVisibleParams] = useState<Set<string>>(new Set());
  const [showRegression, setShowRegression] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setParameters(s.parameters);
    setFormula(s.scoreFormula);
    setEntries(getEntries());
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

  // Compute regression lines for score + all visible params
  const chartData = useMemo(() => {
    if (!showRegression || chartType !== "line") return filteredData;

    let data = filteredData.map((d) => ({ ...d }));

    // Score regression
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

    // Parameter regressions
    parameters.forEach((p) => {
      if (!visibleParams.has(p.id)) return;
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
  }, [filteredData, showRegression, chartType, parameters, visibleParams]);

  const toggleParam = (id: string) => {
    setVisibleParams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCustomDays = () => {
    const d = parseInt(customDays);
    if (d > 0) setRangeDays(d);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {TIME_RANGES.map((r) => (
          <Button
            key={r.days}
            variant={rangeDays === r.days ? "default" : "outline"}
            size="sm"
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Jours"
            className="w-20 h-8"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={handleCustomDays}>
            OK
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant={chartType === "line" ? "default" : "outline"}
            size="sm"
            onClick={() => setChartType("line")}
          >
            Courbe
          </Button>
          <Button
            variant={chartType === "bar" ? "default" : "outline"}
            size="sm"
            onClick={() => setChartType("bar")}
          >
            Histogramme
          </Button>
        </div>
      </div>

      {/* Regression toggle */}
      <div className="flex items-center gap-2">
        <Switch checked={showRegression} onCheckedChange={setShowRegression} />
        <Label className="text-sm">Régression linéaire</Label>
      </div>

      {/* Parameter toggles */}
      {parameters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {parameters.map((p, i) => (
            <Button
              key={p.id}
              variant={visibleParams.has(p.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleParam(p.id)}
              style={
                visibleParams.has(p.id)
                  ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }
                  : {}
              }
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}

      {/* Score chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Score</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Pas de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {chartType === "line" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Score" stroke="hsl(174, 60%, 32%)" strokeWidth={2} dot={{ r: 3 }} />
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
      {parameters
        .filter((p) => visibleParams.has(p.id))
        .map((p, i) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-lg">{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                {chartType === "line" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey={p.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    {showRegression && (
                      <Line type="monotone" dataKey={`${p.name} (tendance)`} stroke="hsl(0, 72%, 51%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    )}
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 15%, 85%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey={p.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

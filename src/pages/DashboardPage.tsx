import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, BarChart3 } from "lucide-react";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getSettingsAsync, getEntriesAsync, computeScore,
  type TrackingParameter, type DailyEntry,
} from "@/lib/tracking-store";
import { apiGet } from "@/lib/api";

// --- Types ---
interface TestHabit {
  id: string; name: string; color: string;
  completions: Record<string, boolean>;
  sMax: number; sMin: number; dSPos: number; dSNeg: number;
}
interface TestHabitsData { habits: TestHabit[] }

interface SubTask { id: string; name: string; scores: Record<string, number> }
interface Task {
  id: string; name: string;
  zone: "persistent" | "planned" | "inprogress" | "done";
  subtasks: SubTask[]; color?: string;
}
interface TodoData { tasks: Task[]; dates: string[] }

// --- helpers ---
function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return dateStr(new Date()); }
function getLastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(dateStr(d)); }
  return days;
}
function formatShortDate(s: string) {
  const d = new Date(s + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function linearRegression(data: { x: number; y: number }[]) {
  if (data.length < 2) return null;
  const n = data.length;
  const sx = data.reduce((s, d) => s + d.x, 0);
  const sy = data.reduce((s, d) => s + d.y, 0);
  const sxy = data.reduce((s, d) => s + d.x * d.y, 0);
  const sx2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const den = n * sx2 - sx * sx;
  if (!den) return null;
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

function computeSeries(habit: TestHabit) {
  const pointsByDate: Record<string, number> = {};
  let S = 0, total = 0;
  const keys = Object.keys(habit.completions || {}).filter(k => habit.completions[k] === true);
  if (keys.length === 0) return { currentS: 0, pointsByDate, totalPoints: 0 };
  const startStr = keys.sort()[0];
  const t = todayStr();
  const start = new Date(startStr + "T12:00:00");
  const end = new Date((startStr > t ? startStr : t) + "T12:00:00");
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const ds = dateStr(cursor);
    const done = habit.completions[ds] === true;
    let pts: number;
    if (done) { pts = 0 + S; S = Math.min(S + habit.dSPos, habit.sMax); }
    else { const perte = 2 + 2 * Math.max(-S, 0); pts = -perte; S = Math.max(S + habit.dSNeg, habit.sMin); }
    pointsByDate[ds] = pts; total += pts;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { currentS: S, pointsByDate, totalPoints: Math.round(total * 100) / 100 };
}

// --- Trend badge (like Statistics) ---
interface TrendInfo {
  current: number | null; change: number | null; changePercent: number | null;
  direction: "up" | "down" | "flat"; avg: number | null; min: number | null; max: number | null;
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
function TrendBadge({ trend }: { trend: TrendInfo }) {
  if (trend.current === null) return null;
  const isGood = trend.direction === "up";
  const isBad = trend.direction === "down";
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Dernier:</span>
        <span className="font-semibold text-foreground">{trend.current}</span>
      </div>
      {trend.change !== null && (
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full font-medium",
          isGood ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
          isBad ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
          "bg-muted text-muted-foreground")}>
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

interface TipItem { name: string; value: number | string; color: string; payload?: Record<string, unknown> }
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const comment = (payload[0]?.payload?._comment as string) || "";
  return (
    <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-md p-3 text-xs min-w-[140px]">
      <div className="font-semibold mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
      {comment && <div className="mt-2 pt-2 border-t border-border italic text-muted-foreground whitespace-pre-wrap break-words max-w-[260px]">{comment}</div>}
    </div>
  );
}

const RANGE_DAYS = 90;
const CHART_COLORS = ["hsl(174, 60%, 32%)", "hsl(35, 80%, 56%)", "hsl(280, 50%, 50%)", "hsl(200, 60%, 50%)", "hsl(340, 60%, 50%)"];

export default function DashboardPage() {
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [formula, setFormula] = useState("");
  const [habits, setHabits] = useState<TestHabit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleParams, setVisibleParams] = useState<string[]>([]);
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    (async () => {
      const s = await getSettingsAsync();
      setParameters(s.parameters); setFormula(s.scoreFormula);
      setEntries(await getEntriesAsync());
      const th = await apiGet<TestHabitsData>("test-habits", "test-habits-data", { habits: [] });
      setHabits(th.habits || []);
      const td = await apiGet<TodoData>("todo", "todo-data", { tasks: [], dates: [] });
      setTasks(td.tasks || []);
    })();
  }, []);

  // Filtered entries in window (sorted asc)
  const windowEntries = useMemo(() => {
    const start = subDays(new Date(), RANGE_DAYS);
    return entries
      .filter(e => isAfter(parseISO(e.date), start))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  // Score chart data with regression + optional params
  const scoreData = useMemo(() => {
    const rows = windowEntries.map((e, i) => {
      const row: Record<string, unknown> = {
        date: format(parseISO(e.date), "dd/MM", { locale: fr }),
        _isoDate: e.date,
        index: i,
        _comment: e.comment || "",
        Score: computeScore(e.values, parameters, formula),
      };
      parameters.forEach(p => { row[p.name] = e.values[p.id] ?? null; });
      return row;
    });
    const pts = rows.map((d, i) => ({ x: i, y: d.Score as number })).filter(p => p.y != null && !isNaN(p.y));
    const reg = linearRegression(pts);
    if (reg) rows.forEach((r, i) => { r["Tendance"] = Math.round((reg.slope * i + reg.intercept) * 100) / 100; });
    return rows;
  }, [windowEntries, parameters, formula]);

  const scoreTrend = useMemo(() => computeTrend(scoreData, "Score"), [scoreData]);

  const recentComments = useMemo(() =>
    [...windowEntries].filter(e => e.comment?.trim()).sort((a, b) => b.date.localeCompare(a.date)),
    [windowEntries]);

  // Sync : when selectedDate change, scroll to comment
  useEffect(() => {
    if (!selectedDate) return;
    const el = commentRefs.current[selectedDate];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedDate]);

  const last90 = useMemo(() => getLastNDays(90), []);

  const CHART_ZONE_ORDER: Task["zone"][] = ["persistent", "inprogress"];
  const chartTasks = CHART_ZONE_ORDER.flatMap(z => tasks.filter(t => t.zone === z));
  const chartGroups = chartTasks
    .map(t => ({ taskName: t.name, taskColor: t.color || "#6366f1", subtasks: t.subtasks.map(st => ({ subName: st.name, scores: st.scores })) }))
    .filter(g => g.subtasks.length > 0);
  const chartDates = last90;
  const today = todayStr();
  const COL_WIDTH = 12;
  const STICKY_COL_WIDTH = 160;

  const toggleParam = (id: string) => setVisibleParams(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const onChartClick = (data: unknown) => {
    const d = data as { activePayload?: { payload?: { _isoDate?: string } }[] };
    const iso = d?.activePayload?.[0]?.payload?._isoDate;
    if (iso) setSelectedDate(iso);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" /> Dashboard
      </h1>

      {/* Ligne du haut : commentaires 1/3 + score 2/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base">Commentaires récents</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] pr-3">
              {recentComments.length === 0 && <div className="text-sm text-muted-foreground">Aucun commentaire.</div>}
              <div className="space-y-3">
                {recentComments.map(e => {
                  const active = selectedDate === e.date;
                  return (
                    <div
                      key={e.date}
                      ref={(el) => { commentRefs.current[e.date] = el; }}
                      onClick={() => setSelectedDate(e.date)}
                      className={cn(
                        "border-l-2 pl-2 cursor-pointer transition-colors rounded-r-md py-1 pr-1",
                        active ? "border-primary bg-primary/10" : "border-primary/40 hover:bg-accent/40"
                      )}
                    >
                      <div className="text-xs font-semibold text-primary">
                        {format(parseISO(e.date), "EEEE d MMMM", { locale: fr })}
                      </div>
                      <div className="text-xs text-foreground whitespace-pre-wrap">{e.comment}</div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Score</CardTitle>
              <Button asChild variant="outline" size="sm" className="h-7 gap-1.5">
                <Link to="/statistics"><BarChart3 className="h-3.5 w-3.5" /> Détail</Link>
              </Button>
            </div>
            <TrendBadge trend={scoreTrend} />
            {parameters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {parameters.map((p, i) => (
                  <Button
                    key={p.id}
                    variant={visibleParams.includes(p.id) ? "default" : "outline"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => toggleParam(p.id)}
                    style={visibleParams.includes(p.id) ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : {}}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {scoreData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Pas de données</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoreData} onClick={onChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }} />
                  <Line
                    type="monotone" dataKey="Score" stroke="hsl(174, 60%, 32%)" strokeWidth={2}
                    dot={(props: { cx?: number; cy?: number; payload?: { _isoDate?: string }; index?: number }) => {
                      const iso = props.payload?._isoDate;
                      const active = iso && iso === selectedDate;
                      const key = `dot-${props.index ?? iso ?? Math.random()}`;
                      return active
                        ? <circle key={key} cx={props.cx} cy={props.cy} r={5} fill="hsl(174, 60%, 32%)" stroke="hsl(var(--background))" strokeWidth={2} />
                        : <circle key={key} cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                    }}
                    activeDot={{ r: 5 }}
                  />
                  <Line type="monotone" dataKey="Tendance" stroke="hsl(0, 72%, 51%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  {parameters.filter(p => visibleParams.includes(p.id)).map((p, i) => (
                    <Line key={p.id} type="monotone" dataKey={p.name} stroke={CHART_COLORS[parameters.findIndex(pp => pp.id === p.id) % CHART_COLORS.length]} strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Habits synthèse */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Habits</CardTitle></CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune habitude.</p>
          ) : (
            <div className="space-y-1">
              {habits.map(h => {
                const s = computeSeries(h);
                return (
                  <div key={h.id} className="flex items-center gap-3 py-1 border-b border-border last:border-0">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: h.color }} />
                    <span className="text-sm font-medium truncate w-40 shrink-0">{h.name}</span>
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                      s.currentS > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : s.currentS < 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                    )}>Bonus = {Math.round(s.currentS * 100) / 100}</span>
                    <span className="text-xs font-semibold text-foreground shrink-0 w-16 tabular-nums">{s.totalPoints} pts</span>
                    <div className="flex-1 flex gap-[2px] overflow-x-auto">
                      {last90.map(d => {
                        const done = h.completions[d] === true;
                        const isToday = d === today;
                        return (
                          <span
                            key={d}
                            title={`${formatShortDate(d)}${done ? " ✓" : ""}`}
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              done ? "" : "bg-muted",
                              isToday && "ring-1 ring-primary"
                            )}
                            style={done ? { backgroundColor: "#22c55e" } : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* To Do — Graphique tâches actives */}
      {chartGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tâches actives</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block" style={{ width: STICKY_COL_WIDTH + chartDates.length * COL_WIDTH }}>
                <div className="flex">
                  <div className="shrink-0" style={{ width: STICKY_COL_WIDTH }} />
                  {chartDates.map(d => (
                    <div key={d} className={cn("text-center text-[8px] shrink-0", d === today ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground")} style={{ width: COL_WIDTH }}>
                      {new Date(d + "T12:00:00").getDate() === 1 ? formatShortDate(d) : ""}
                    </div>
                  ))}
                </div>
                {chartGroups.map((group, gIdx) => (
                  <div key={group.taskName + gIdx}>
                    <div className="flex">
                      <div className="shrink-0 h-5 px-2 flex items-center text-xs font-bold truncate" style={{ width: STICKY_COL_WIDTH, color: group.taskColor }}>
                        {group.taskName}
                      </div>
                      {chartDates.map(d => <div key={d} className={cn("h-5 shrink-0", d === today && "bg-primary/5")} style={{ width: COL_WIDTH }} />)}
                    </div>
                    {group.subtasks.map(sub => (
                      <div key={sub.subName} className="flex">
                        <div className="shrink-0 h-6 px-2 py-0.5 flex items-center text-[11px] text-muted-foreground" style={{ width: STICKY_COL_WIDTH }}>
                          <span className="truncate pl-3">{sub.subName}</span>
                        </div>
                        {chartDates.map((date, dIdx) => {
                          const score = sub.scores[date] ?? 0;
                          const maxH = 22;
                          const barH = score === 0 ? 0 : Math.round((score / 3) * maxH);
                          const prev = dIdx > 0 ? (sub.scores[chartDates[dIdx - 1]] ?? 0) : 0;
                          const next = dIdx < chartDates.length - 1 ? (sub.scores[chartDates[dIdx + 1]] ?? 0) : 0;
                          const hasLeft = prev > 0 && score > 0;
                          const hasRight = next > 0 && score > 0;
                          const br = `${hasLeft ? 0 : 2}px ${hasRight ? 0 : 2}px ${hasRight ? 0 : 2}px ${hasLeft ? 0 : 2}px`;
                          return (
                            <div key={date} className={cn("flex items-end justify-center shrink-0 h-6", date === today && "bg-primary/5")} style={{ width: COL_WIDTH }}>
                              {score > 0 && <div className="w-full" style={{ height: barH, backgroundColor: group.taskColor, opacity: 0.85, borderRadius: br }} title={`${sub.subName} — ${formatShortDate(date)}: ${score}`} />}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {gIdx < chartGroups.length - 1 && <div className="h-px bg-border" style={{ width: STICKY_COL_WIDTH + chartDates.length * COL_WIDTH }} />}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

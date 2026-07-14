import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  getSettingsAsync, getEntriesAsync, computeScore,
  type TrackingParameter, type DailyEntry,
} from "@/lib/tracking-store";
import { apiGet } from "@/lib/api";

// --- Types locaux (dupliqués depuis TestPage / TodoPage) ---
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

export default function DashboardPage() {
  const [parameters, setParameters] = useState<TrackingParameter[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [formula, setFormula] = useState("");
  const [habits, setHabits] = useState<TestHabit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

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

  // Score chart 3 mois + régression
  const scoreData = useMemo(() => {
    const start = subDays(new Date(), RANGE_DAYS);
    const rows = entries
      .filter(e => isAfter(parseISO(e.date), start))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e, i) => ({
        date: format(parseISO(e.date), "dd/MM", { locale: fr }),
        index: i,
        _comment: e.comment || "",
        Score: computeScore(e.values, parameters, formula),
      }));
    const pts = rows.map((d, i) => ({ x: i, y: d.Score as number })).filter(p => p.y != null && !isNaN(p.y));
    const reg = linearRegression(pts);
    if (reg) rows.forEach((r, i) => { (r as Record<string, unknown>)["Tendance"] = Math.round((reg.slope * i + reg.intercept) * 100) / 100; });
    return rows;
  }, [entries, parameters, formula]);

  // Commentaires (jusqu'à 3 mois)
  const recentComments = useMemo(() => {
    const start = subDays(new Date(), RANGE_DAYS);
    return entries
      .filter(e => e.comment?.trim() && isAfter(parseISO(e.date), start))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  const last90 = useMemo(() => getLastNDays(90), []);

  // To Do : reprise exacte de la logique du graphique de TodoPage
  const CHART_ZONE_ORDER: Task["zone"][] = ["persistent", "inprogress"];
  const chartTasks = CHART_ZONE_ORDER.flatMap(z => tasks.filter(t => t.zone === z));
  const chartGroups = chartTasks
    .map(t => ({ taskName: t.name, taskColor: t.color || "#6366f1", subtasks: t.subtasks.map(st => ({ subName: st.name, scores: st.scores })) }))
    .filter(g => g.subtasks.length > 0);
  const chartDates = last90;
  const today = todayStr();
  const COL_WIDTH = 12;
  const STICKY_COL_WIDTH = 160;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" /> Dashboard
      </h1>

      {/* Ligne du haut : commentaires 1/3 + score 2/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base">Commentaires récents (3 mois)</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-3">
              {recentComments.length === 0 && <div className="text-sm text-muted-foreground">Aucun commentaire.</div>}
              <div className="space-y-3">
                {recentComments.map(e => (
                  <div key={e.date} className="border-l-2 border-primary/40 pl-2">
                    <div className="text-xs font-semibold text-primary">
                      {format(parseISO(e.date), "EEEE d MMMM", { locale: fr })}
                    </div>
                    <div className="text-xs text-foreground whitespace-pre-wrap">{e.comment}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Score (3 mois) + régression linéaire</CardTitle></CardHeader>
          <CardContent>
            {scoreData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Pas de données</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }} />
                  <Legend />
                  <Line type="monotone" dataKey="Score" stroke="hsl(174, 60%, 32%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Tendance" stroke="hsl(0, 72%, 51%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Habits synthèse */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Habits (synthèse — 90 j)</CardTitle></CardHeader>
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
                    )}>S = {Math.round(s.currentS * 100) / 100}</span>
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
          <CardHeader className="pb-2"><CardTitle className="text-base">Tâches actives — 90 j</CardTitle></CardHeader>
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

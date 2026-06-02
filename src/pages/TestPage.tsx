import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Pencil, Check, X, Target,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Activity,
} from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";

// --- Types ---
interface TestHabit {
  id: string;
  name: string;
  category: "build" | "break";
  cue: string;
  routine: string;
  reward: string;
  completions: Record<string, boolean>; // date -> done
  createdAt: string;
  color: string;
  expanded: boolean;
  // Dynamique S
  sMax: number;
  sMin: number;
  dSPos: number;
  dSNeg: number;
}

interface TestHabitsData {
  habits: TestHabit[];
}

const HABIT_COLORS = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  "#6366f1", "#d946ef", "#0ea5e9", "#e11d48", "#ca8a04",
];

const DAYS_OF_WEEK = ["L", "M", "M", "J", "V", "S", "D"];

const DEFAULTS = { sMax: 3, sMin: -5, dSPos: 2, dSNeg: -2 };

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateStr(d));
  }
  return days;
}


function getCompletionRate(habit: TestHabit, days: number): number {
  const dates = getLastNDays(days);
  const completed = dates.filter(d => habit.completions[d]).length;
  return Math.round((completed / days) * 100);
}

// Rejoue l'historique depuis la première interaction enregistrée → today.
// Indépendant de createdAt : on part de la plus ancienne date présente dans completions.
function computeSeries(habit: TestHabit): {
  currentS: number;
  pointsByDate: Record<string, number>;
  totalPoints: number;
} {
  const pointsByDate: Record<string, number> = {};
  let S = 0;
  let total = 0;

  const keys = Object.keys(habit.completions || {}).filter(k => habit.completions[k] === true);
  if (keys.length === 0) return { currentS: 0, pointsByDate, totalPoints: 0 };

  const startStr = keys.sort()[0];
  const todayS = todayStr();
  const start = new Date(startStr + "T12:00:00");
  const end = new Date((startStr > todayS ? startStr : todayS) + "T12:00:00");
  if (isNaN(start.getTime())) return { currentS: 0, pointsByDate, totalPoints: 0 };

  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const ds = dateStr(cursor);
    const done = habit.completions[ds] === true;
    let pts: number;
    if (done) {
      pts = 0 + S; // P_base + S (S avant maj)
      S = Math.min(S + habit.dSPos, habit.sMax);
    } else {
      const perte = 2 + 2 * Math.max(-S, 0);
      pts = -perte;
      S = Math.max(S + habit.dSNeg, habit.sMin);
    }
    pointsByDate[ds] = pts;
    total += pts;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { currentS: S, pointsByDate, totalPoints: Math.round(total * 100) / 100 };
}


function formatShortDate(s: string) {
  const d = new Date(s + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TestPage() {
  const [habits, setHabits] = useState<TestHabit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TestHabit>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: "", category: "build" as "build" | "break",
    cue: "", routine: "", reward: "",
    sMax: DEFAULTS.sMax, sMin: DEFAULTS.sMin,
    dSPos: DEFAULTS.dSPos, dSNeg: DEFAULTS.dSNeg,
  });

  useEffect(() => {
    apiGet<TestHabitsData>("test-habits", "test-habits-data", { habits: [] }).then((data) => {
      setHabits(data.habits || []);
      setLoaded(true);
    });
  }, []);

  const save = useCallback((h: TestHabit[]) => {
    apiPut("test-habits", "test-habits-data", { habits: h });
  }, []);

  const updateHabits = (h: TestHabit[]) => {
    setHabits(h);
    save(h);
  };

  const toggleCompletion = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const newCompletions = { ...habit.completions, [date]: !habit.completions[date] };
    updateHabits(habits.map(h => h.id === habitId ? { ...h, completions: newCompletions } : h));
  };

  const addHabit = () => {
    if (!newHabit.name.trim()) return;
    const sMax = Math.max(0, newHabit.sMax);
    const sMin = Math.min(0, newHabit.sMin);
    const h: TestHabit = {
      id: uid(),
      name: newHabit.name,
      category: newHabit.category,
      cue: newHabit.cue,
      routine: newHabit.routine,
      reward: newHabit.reward,
      completions: {},
      createdAt: todayStr(),
      color: HABIT_COLORS[habits.length % HABIT_COLORS.length],
      expanded: false,
      sMax, sMin,
      dSPos: Math.abs(newHabit.dSPos),
      dSNeg: -Math.abs(newHabit.dSNeg),
    };
    updateHabits([...habits, h]);
    setNewHabit({
      name: "", category: "build", cue: "", routine: "", reward: "",
      sMax: DEFAULTS.sMax, sMin: DEFAULTS.sMin,
      dSPos: DEFAULTS.dSPos, dSNeg: DEFAULTS.dSNeg,
    });
    setShowAdd(false);
  };

  const deleteHabit = (id: string) => updateHabits(habits.filter(h => h.id !== id));

  const startEdit = (habit: TestHabit) => {
    setEditingId(habit.id);
    setEditForm({
      name: habit.name, cue: habit.cue, routine: habit.routine, reward: habit.reward,
      category: habit.category, color: habit.color,
      sMax: habit.sMax, sMin: habit.sMin, dSPos: habit.dSPos, dSNeg: habit.dSNeg,
    });
  };

  const confirmEdit = () => {
    if (!editingId) return;
    updateHabits(habits.map(h => h.id === editingId ? { ...h, ...editForm } as TestHabit : h));
    setEditingId(null);
  };

  const today = todayStr();
  const last21 = getLastNDays(21);
  const last90 = getLastNDays(90);

  const todayCompleted = habits.filter(h => h.completions[today]).length;
  const totalToday = habits.length;

  // Calculs globaux
  const series = habits.map(h => ({ h, s: computeSeries(h) }));
  const totalPoints = Math.round(series.reduce((a, b) => a + b.s.totalPoints, 0) * 100) / 100;
  const sumS = Math.round(series.reduce((a, b) => a + b.s.currentS, 0) * 100) / 100;

  if (!loaded) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Test</h1>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nouvelle habitude
        </Button>
      </div>

      {/* Barre de stats globale */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{totalPoints} pts</div>
                <div className="text-xs text-muted-foreground">total cumulé</div>
              </div>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              sumS > 0 ? "bg-green-100 dark:bg-green-900/20"
                : sumS < 0 ? "bg-red-100 dark:bg-red-900/20"
                : "bg-accent/50"
            )}>
              {sumS > 0 ? <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                : sumS < 0 ? <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                : <Activity className="h-4 w-4 text-muted-foreground" />}
              <span className={cn(
                "text-sm font-semibold",
                sumS > 0 ? "text-green-700 dark:text-green-400"
                  : sumS < 0 ? "text-red-700 dark:text-red-400"
                  : "text-foreground"
              )}>Σ S = {sumS}</span>
              <span className="text-xs text-muted-foreground">dynamique</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{todayCompleted}/{totalToday}</span>
              <span className="text-xs text-muted-foreground">aujourd'hui</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire ajout */}
      {showAdd && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nouvelle habitude (dynamique S)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nom de l'habitude</label>
                <Input value={newHabit.name} onChange={e => setNewHabit({ ...newHabit, name: e.target.value })} placeholder="Ex: Lecture 20 min" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant={newHabit.category === "build" ? "default" : "outline"} onClick={() => setNewHabit({ ...newHabit, category: "build" })}>
                    🟢 Construire
                  </Button>
                  <Button size="sm" variant={newHabit.category === "break" ? "default" : "outline"} onClick={() => setNewHabit({ ...newHabit, category: "break" })}>
                    🔴 Éliminer
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">🔔 Signal (Cue)</label>
                <Input value={newHabit.cue} onChange={e => setNewHabit({ ...newHabit, cue: e.target.value })} placeholder="Après mon café" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">⚡ Routine</label>
                <Input value={newHabit.routine} onChange={e => setNewHabit({ ...newHabit, routine: e.target.value })} placeholder="…" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">🎁 Récompense</label>
                <Input value={newHabit.reward} onChange={e => setNewHabit({ ...newHabit, reward: e.target.value })} placeholder="…" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">S max (≥ 0)</label>
                <Input type="number" value={newHabit.sMax} onChange={e => setNewHabit({ ...newHabit, sMax: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">S min (≤ 0)</label>
                <Input type="number" value={newHabit.sMin} onChange={e => setNewHabit({ ...newHabit, sMin: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ΔS+ (succès)</label>
                <Input type="number" value={newHabit.dSPos} onChange={e => setNewHabit({ ...newHabit, dSPos: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ΔS− (échec)</label>
                <Input type="number" value={newHabit.dSNeg} onChange={e => setNewHabit({ ...newHabit, dSNeg: Number(e.target.value) })} className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addHabit} disabled={!newHabit.name.trim()}>Ajouter</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {habits.length === 0 && !showAdd && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucune habitude</p>
            <p className="text-sm">Commencez par créer votre première habitude !</p>
          </CardContent>
        </Card>
      )}

      {habits.map(habit => {
        const { currentS, pointsByDate, totalPoints: hTotal } = computeSeries(habit);
        const rate21 = getCompletionRate(habit, 21);
        const rate90 = getCompletionRate(habit, 90);
        const isEditing = editingId === habit.id;
        const sRange = habit.sMax - habit.sMin || 1;
        const sPct = Math.max(0, Math.min(100, ((currentS - habit.sMin) / sRange) * 100));
        const points21 = Math.round(last21.reduce((a, d) => a + (pointsByDate[d] ?? 0), 0) * 100) / 100;
        const points90 = Math.round(last90.reduce((a, d) => a + (pointsByDate[d] ?? 0), 0) * 100) / 100;

        return (
          <Card key={habit.id} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: habit.color }} />
            <CardContent className="pt-3 pb-3 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => updateHabits(habits.map(h => h.id === habit.id ? { ...h, expanded: !h.expanded } : h))}>
                  {habit.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-7 text-sm" autoFocus />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={confirmEdit}><Check className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-foreground flex-1">{habit.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", habit.category === "build" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                      {habit.category === "build" ? "Construire" : "Éliminer"}
                    </span>
                  </>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    currentS > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : currentS < 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                  )}>S = {Math.round(currentS * 100) / 100}</span>
                  <span className="text-xs font-semibold text-foreground">{hTotal} pts</span>
                  <span className="text-xs text-muted-foreground">{rate21}% 21j</span>
                  <span className="text-xs text-muted-foreground">{rate90}% 90j</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(habit)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteHabit(habit.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>

              {/* Tracker 7j */}
              <div className="flex items-center gap-1">
                {last21.map(date => {
                  const done = habit.completions[date];
                  const isToday = date === today;
                  const dayIdx = new Date(date + "T12:00:00").getDay();
                  const dayLabel = DAYS_OF_WEEK[dayIdx === 0 ? 6 : dayIdx - 1];
                  const pts = pointsByDate[date];
                  return (
                    <button
                      key={date}
                      onClick={() => toggleCompletion(habit.id, date)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-all min-w-[40px]",
                        done ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/50",
                        isToday && "ring-2 ring-primary/30"
                      )}
                      title={`${formatShortDate(date)} · ${pts !== undefined ? pts + " pts" : "—"}`}
                    >
                      <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all",
                        done ? "bg-green-500 text-white scale-110" : "bg-muted text-muted-foreground"
                      )}>
                        {done ? "✓" : "·"}
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium tabular-nums",
                        pts === undefined ? "text-muted-foreground/40"
                          : pts > 0 ? "text-green-600 dark:text-green-400"
                          : pts < 0 ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      )}>
                        {pts !== undefined ? (pts > 0 ? `+${pts}` : pts) : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Détails étendus */}
              {habit.expanded && (
                <div className="border-t border-border pt-2 mt-1 space-y-3">
                  {/* Atomic Habits */}
                  {(habit.cue || habit.routine || habit.reward || isEditing) && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-accent/30 p-2">
                        <div className="font-semibold text-muted-foreground mb-0.5">🔔 Signal</div>
                        {isEditing ? (
                          <Input value={editForm.cue || ""} onChange={e => setEditForm({ ...editForm, cue: e.target.value })} className="h-6 text-xs" />
                        ) : (<span>{habit.cue || "—"}</span>)}
                      </div>
                      <div className="rounded-md bg-accent/30 p-2">
                        <div className="font-semibold text-muted-foreground mb-0.5">⚡ Routine</div>
                        {isEditing ? (
                          <Input value={editForm.routine || ""} onChange={e => setEditForm({ ...editForm, routine: e.target.value })} className="h-6 text-xs" />
                        ) : (<span>{habit.routine || "—"}</span>)}
                      </div>
                      <div className="rounded-md bg-accent/30 p-2">
                        <div className="font-semibold text-muted-foreground mb-0.5">🎁 Récompense</div>
                        {isEditing ? (
                          <Input value={editForm.reward || ""} onChange={e => setEditForm({ ...editForm, reward: e.target.value })} className="h-6 text-xs" />
                        ) : (<span>{habit.reward || "—"}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Barre S */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>S min {habit.sMin}</span>
                      <span className="font-semibold text-foreground">S = {Math.round(currentS * 100) / 100}</span>
                      <span>S max {habit.sMax}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                      {(() => {
                        const zeroPct = ((0 - habit.sMin) / sRange) * 100;
                        const leftPct = currentS >= 0 ? zeroPct : sPct;
                        const widthPct = Math.abs(sPct - zeroPct);
                        return (
                          <div
                            className={cn(
                              "absolute top-0 h-full transition-all",
                              currentS >= 0 ? "bg-green-500" : "bg-red-500"
                            )}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          />
                        );
                      })()}
                      <div
                        className="absolute top-0 h-full w-px bg-foreground/40"
                        style={{ left: `${((0 - habit.sMin) / sRange) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Points 21j : <span className={cn("font-medium", points21 > 0 ? "text-green-600 dark:text-green-400" : points21 < 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{points21}</span></span>
                      <span>Points 90j : <span className={cn("font-medium", points90 > 0 ? "text-green-600 dark:text-green-400" : points90 < 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{points90}</span></span>
                    </div>
                  </div>

                  {/* Édition paramètres S */}
                  {isEditing && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">S max</label>
                        <Input type="number" value={editForm.sMax ?? 0} onChange={e => setEditForm({ ...editForm, sMax: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">S min</label>
                        <Input type="number" value={editForm.sMin ?? 0} onChange={e => setEditForm({ ...editForm, sMin: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">ΔS+</label>
                        <Input type="number" value={editForm.dSPos ?? 0} onChange={e => setEditForm({ ...editForm, dSPos: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">ΔS−</label>
                        <Input type="number" value={editForm.dSNeg ?? 0} onChange={e => setEditForm({ ...editForm, dSNeg: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                    </div>
                  )}

                  {/* Heatmap 30j */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">90 derniers jours</div>
                    <div className="flex gap-[2px] flex-wrap">
                      {last90.map(date => {
                        const done = habit.completions[date];
                        const pts = pointsByDate[date];
                        return (
                          <button
                            key={date}
                            onClick={() => toggleCompletion(habit.id, date)}
                            className={cn(
                              "w-4 h-4 rounded-sm transition-colors",
                              done ? "bg-green-500" : "bg-muted"
                            )}
                            title={`${formatShortDate(date)}: ${done ? "✓" : "✗"}${pts !== undefined ? ` (${pts} pts)` : ""}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Sélecteur couleur */}
                  {isEditing && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Couleur</div>
                      <div className="flex gap-1 flex-wrap">
                        {HABIT_COLORS.map(c => (
                          <button
                            key={c}
                            className={cn("w-5 h-5 rounded-full border-2", editForm.color === c ? "border-foreground" : "border-transparent")}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditForm({ ...editForm, color: c })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

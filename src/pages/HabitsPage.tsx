import { useState, useEffect, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Pencil, Check, X, Flame, Trophy, Target, Star, Zap,
  ChevronDown, ChevronRight
} from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";

// --- Types ---
interface Habit {
  id: string;
  name: string;
  category: "build" | "break";
  cue: string;
  routine: string;
  reward: string;
  frequency: "daily" | "weekly" | "custom";
  customDays?: number[];
  completions: Record<string, boolean>; // date -> done
  createdAt: string;
  color: string;
  expanded: boolean;
}

interface HabitsData {
  habits: Habit[];
  xp: number;
  level: number;
  badges: string[];
}

const HABIT_COLORS = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  "#6366f1", "#d946ef", "#0ea5e9", "#e11d48", "#ca8a04",
];

const DAYS_OF_WEEK = ["L", "M", "M", "J", "V", "S", "D"];

const BADGES_CONFIG: { id: string; name: string; icon: typeof Flame; desc: string; check: (h: Habit) => boolean }[] = [
  { id: "first_step", name: "Premier pas", icon: Star, desc: "Compléter une habitude pour la première fois", check: (h) => Object.values(h.completions).some(Boolean) },
  { id: "week_streak", name: "Semaine de feu", icon: Flame, desc: "7 jours consécutifs", check: (h) => getStreak(h) >= 7 },
  { id: "month_streak", name: "Mois d'acier", icon: Trophy, desc: "30 jours consécutifs", check: (h) => getStreak(h) >= 30 },
  { id: "century", name: "Centurion", icon: Zap, desc: "100 complétions au total", check: (h) => Object.values(h.completions).filter(Boolean).length >= 100 },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return days;
}

function getStreak(habit: Habit): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (habit.completions[ds]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getCompletionRate(habit: Habit, days: number): number {
  const dates = getLastNDays(days);
  const completed = dates.filter(d => habit.completions[d]).length;
  return Math.round((completed / days) * 100);
}

function calcLevel(xp: number): { level: number; xpForNext: number; xpInLevel: number } {
  // Each level requires level * 50 XP
  let level = 1;
  let totalNeeded = 0;
  while (true) {
    const needed = level * 50;
    if (totalNeeded + needed > xp) {
      return { level, xpForNext: needed, xpInLevel: xp - totalNeeded };
    }
    totalNeeded += needed;
    level++;
  }
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [xp, setXp] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Habit>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: "", category: "build" as const, cue: "", routine: "", reward: "", frequency: "daily" as const });

  useEffect(() => {
    apiGet<HabitsData>("habits", "habits-data", { habits: [], xp: 0, level: 1, badges: [] }).then((data) => {
      setHabits(data.habits || []);
      setXp(data.xp || 0);
      setBadges(data.badges || []);
      setLoaded(true);
    });
  }, []);

  const save = useCallback((h: Habit[], newXp?: number, newBadges?: string[]) => {
    const lvl = calcLevel(newXp ?? xp);
    apiPut("habits", "habits-data", { habits: h, xp: newXp ?? xp, level: lvl.level, badges: newBadges ?? badges });
  }, [xp, badges]);

  const updateHabits = (h: Habit[], newXp?: number, newBadges?: string[]) => {
    setHabits(h);
    if (newXp !== undefined) setXp(newXp);
    if (newBadges !== undefined) setBadges(newBadges);
    save(h, newXp, newBadges);
  };

  const toggleCompletion = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const wasCompleted = habit.completions[date];
    const newCompletions = { ...habit.completions, [date]: !wasCompleted };
    const newHabits = habits.map(h => h.id === habitId ? { ...h, completions: newCompletions } : h);

    let newXp = xp;
    if (!wasCompleted) {
      newXp += 10; // +10 XP per completion
      const streak = getStreak({ ...habit, completions: newCompletions });
      if (streak >= 3) newXp += 5; // streak bonus
    } else {
      newXp = Math.max(0, newXp - 10);
    }

    // Check for new badges
    const updatedHabit = { ...habit, completions: newCompletions };
    const newBadges = [...badges];
    BADGES_CONFIG.forEach(b => {
      const badgeKey = `${habitId}_${b.id}`;
      if (!newBadges.includes(badgeKey) && b.check(updatedHabit)) {
        newBadges.push(badgeKey);
        newXp += 50; // badge bonus
      }
    });

    setXp(newXp);
    setBadges(newBadges);
    updateHabits(newHabits, newXp, newBadges);
  };

  const addHabit = () => {
    if (!newHabit.name.trim()) return;
    const h: Habit = {
      id: uid(),
      name: newHabit.name,
      category: newHabit.category,
      cue: newHabit.cue,
      routine: newHabit.routine,
      reward: newHabit.reward,
      frequency: newHabit.frequency,
      completions: {},
      createdAt: todayStr(),
      color: HABIT_COLORS[habits.length % HABIT_COLORS.length],
      expanded: false,
    };
    updateHabits([...habits, h]);
    setNewHabit({ name: "", category: "build", cue: "", routine: "", reward: "", frequency: "daily" });
    setShowAdd(false);
  };

  const deleteHabit = (id: string) => updateHabits(habits.filter(h => h.id !== id));

  const startEdit = (habit: Habit) => {
    setEditingId(habit.id);
    setEditForm({ name: habit.name, cue: habit.cue, routine: habit.routine, reward: habit.reward, category: habit.category, color: habit.color });
  };

  const confirmEdit = () => {
    if (!editingId) return;
    updateHabits(habits.map(h => h.id === editingId ? { ...h, ...editForm } : h));
    setEditingId(null);
  };

  const today = todayStr();
  const last7 = getLastNDays(7);
  const last30 = getLastNDays(30);
  const levelInfo = calcLevel(xp);

  const todayCompleted = habits.filter(h => h.completions[today]).length;
  const totalToday = habits.length;

  if (!loaded) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Habitudes</h1>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nouvelle habitude
        </Button>
      </div>

      {/* Gamification bar */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Level */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Niveau {levelInfo.level}</div>
                <div className="text-xs text-muted-foreground">{xp} XP total</div>
              </div>
            </div>
            {/* XP progress to next level */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{levelInfo.xpInLevel} / {levelInfo.xpForNext} XP</span>
                <span>Niveau {levelInfo.level + 1}</span>
              </div>
              <Progress value={(levelInfo.xpInLevel / levelInfo.xpForNext) * 100} className="h-2" />
            </div>
            {/* Today's score */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{todayCompleted}/{totalToday}</span>
              <span className="text-xs text-muted-foreground">aujourd'hui</span>
            </div>
            {/* Streak display */}
            {habits.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                  {Math.max(...habits.map(h => getStreak(h)), 0)}j
                </span>
                <span className="text-xs text-orange-600 dark:text-orange-400/70">meilleur streak</span>
              </div>
            )}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {badges.map(b => {
                const badgeId = b.split("_").slice(1).join("_");
                const cfg = BADGES_CONFIG.find(bc => bc.id === badgeId);
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <div key={b} className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-xs font-medium text-yellow-700 dark:text-yellow-400" title={cfg.desc}>
                    <Icon className="h-3 w-3" />
                    {cfg.name}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add habit form */}
      {showAdd && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nouvelle habitude (Atomic Habits)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nom de l'habitude</label>
                <Input value={newHabit.name} onChange={e => setNewHabit({ ...newHabit, name: e.target.value })} placeholder="Ex: Méditer 10 min" className="mt-1" />
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
            {/* Atomic Habits: Cue, Routine, Reward */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">🔔 Signal (Cue)</label>
                <Input value={newHabit.cue} onChange={e => setNewHabit({ ...newHabit, cue: e.target.value })} placeholder="Après mon café" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">⚡ Routine</label>
                <Input value={newHabit.routine} onChange={e => setNewHabit({ ...newHabit, routine: e.target.value })} placeholder="Méditer 10 min" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">🎁 Récompense</label>
                <Input value={newHabit.reward} onChange={e => setNewHabit({ ...newHabit, reward: e.target.value })} placeholder="Sensation de calme" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addHabit} disabled={!newHabit.name.trim()}>Ajouter</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Habits list with 7-day tracker */}
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
        const streak = getStreak(habit);
        const rate7 = getCompletionRate(habit, 7);
        const rate30 = getCompletionRate(habit, 30);
        const isEditing = editingId === habit.id;

        return (
          <Card key={habit.id} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: habit.color }} />
            <CardContent className="pt-3 pb-3 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2">
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
                {/* Stats pills */}
                <div className="flex items-center gap-2 shrink-0">
                  {streak > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                      <Flame className="h-3 w-3" /> {streak}j
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{rate7}% 7j</span>
                  <span className="text-xs text-muted-foreground">{rate30}% 30j</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(habit)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteHabit(habit.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>

              {/* 7-day completion tracker */}
              <div className="flex items-center gap-1">
                {last7.map(date => {
                  const done = habit.completions[date];
                  const isToday = date === today;
                  const dayIdx = new Date(date + "T12:00:00").getDay();
                  const dayLabel = DAYS_OF_WEEK[dayIdx === 0 ? 6 : dayIdx - 1];
                  return (
                    <button
                      key={date}
                      onClick={() => toggleCompletion(habit.id, date)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-all min-w-[36px]",
                        done ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/50",
                        isToday && "ring-2 ring-primary/30"
                      )}
                      title={formatShortDate(date)}
                    >
                      <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all",
                        done ? "bg-green-500 text-white scale-110" : "bg-muted text-muted-foreground"
                      )}>
                        {done ? "✓" : "·"}
                      </div>
                    </button>
                  );
                })}
                <div className="ml-2 flex-1">
                  <Progress value={rate7} className="h-1.5" />
                </div>
              </div>

              {/* Expanded details */}
              {habit.expanded && (
                <div className="border-t border-border pt-2 mt-1 space-y-2">
                  {/* Atomic Habits loop */}
                  {(habit.cue || habit.routine || habit.reward) && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-accent/30 p-2">
                        <div className="font-semibold text-muted-foreground mb-0.5">🔔 Signal</div>
                        {isEditing ? (
                          <Input value={editForm.cue || ""} onChange={e => setEditForm({ ...editForm, cue: e.target.value })} className="h-6 text-xs" />
                        ) : (
                          <span>{habit.cue || "—"}</span>
                        )}
                      </div>
                      <div className="rounded-md bg-accent/30 p-2">
                        <div className="font-semibold text-muted-foreground mb-0.5">⚡ Routine</div>
                        {isEditing ? (
                          <Input value={editForm.routine || ""} onChange={e => setEditForm({ ...editForm, routine: e.target.value })} className="h-6 text-xs" />
                        ) : (
                          <span>{habit.routine || "—"}</span>
                        )}
                      </div>
                      <div className="rounded-md bg-accent/30 p-2">
                        <div className="font-semibold text-muted-foreground mb-0.5">🎁 Récompense</div>
                        {isEditing ? (
                          <Input value={editForm.reward || ""} onChange={e => setEditForm({ ...editForm, reward: e.target.value })} className="h-6 text-xs" />
                        ) : (
                          <span>{habit.reward || "—"}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 30-day heat map */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">30 derniers jours</div>
                    <div className="flex gap-[2px] flex-wrap">
                      {last30.map(date => {
                        const done = habit.completions[date];
                        return (
                          <button
                            key={date}
                            onClick={() => toggleCompletion(habit.id, date)}
                            className={cn(
                              "w-4 h-4 rounded-sm transition-colors",
                              done ? "bg-green-500" : "bg-muted"
                            )}
                            title={`${formatShortDate(date)}: ${done ? "✓" : "✗"}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Color picker */}
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

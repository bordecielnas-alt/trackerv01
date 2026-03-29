import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
  Eye, EyeOff, Pencil, Check, X
} from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";

// --- Types ---
interface SubTask {
  id: string;
  name: string;
  scores: Record<string, number>; // date -> 0-3
}

interface Task {
  id: string;
  name: string;
  zone: "persistent" | "planned" | "inprogress" | "done";
  subtasks: SubTask[];
  notes: string;
  expanded: boolean;
  notesExpanded: boolean;
}

interface TodoData {
  tasks: Task[];
  dates: string[];
}

const ZONES = [
  { key: "persistent" as const, label: "Persistante" },
  { key: "planned" as const, label: "À planifier" },
  { key: "inprogress" as const, label: "En cours" },
  { key: "done" as const, label: "Terminée" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function calcProgress(subtasks: SubTask[], dates: string[]): number {
  if (subtasks.length === 0 || dates.length === 0) return 0;
  let total = 0, max = 0;
  for (const st of subtasks) {
    for (const d of dates) {
      total += st.scores[d] ?? 0;
      max += 3;
    }
  }
  return max === 0 ? 0 : Math.round((total / max) * 100);
}

function generateDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = -7; i < count - 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SCORE_COLORS = [
  "bg-muted text-muted-foreground",
  "bg-yellow-200 text-yellow-900",
  "bg-orange-300 text-orange-900",
  "bg-green-400 text-green-900",
];

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dates, setDates] = useState<string[]>(() => generateDates(30));
  const [hideDone, setHideDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragTask, setDragTask] = useState<string | null>(null);

  // Load
  useEffect(() => {
    apiGet<TodoData>("todo", "todo-data", { tasks: [], dates: [] }).then((data) => {
      if (data.tasks?.length) setTasks(data.tasks);
      if (data.dates?.length) setDates(data.dates);
      else setDates(generateDates(30));
      setLoaded(true);
    });
  }, []);

  // Save
  const save = useCallback(
    (t: Task[], d?: string[]) => {
      const payload: TodoData = { tasks: t, dates: d ?? dates };
      apiPut("todo", "todo-data", payload);
    },
    [dates]
  );

  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    save(newTasks);
  };

  // --- Task CRUD ---
  const addTask = (zone: Task["zone"]) => {
    const t: Task = {
      id: uid(), name: "Nouvelle tâche", zone,
      subtasks: [], notes: "", expanded: true, notesExpanded: false
    };
    updateTasks([...tasks, t]);
  };

  const deleteTask = (id: string) => updateTasks(tasks.filter((t) => t.id !== id));

  const updateTask = (id: string, patch: Partial<Task>) => {
    updateTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  // --- Subtask CRUD ---
  const addSubtask = (taskId: string) => {
    const st: SubTask = { id: uid(), name: "Sous-tâche", scores: {} };
    updateTasks(
      tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, st] } : t
      )
    );
  };

  const deleteSubtask = (taskId: string, stId: string) => {
    updateTasks(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== stId) }
          : t
      )
    );
  };

  const updateSubtask = (taskId: string, stId: string, patch: Partial<SubTask>) => {
    updateTasks(
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === stId ? { ...s, ...patch } : s
              ),
            }
          : t
      )
    );
  };

  const cycleScore = (taskId: string, stId: string, date: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const st = task?.subtasks.find((s) => s.id === stId);
    if (!st) return;
    const cur = st.scores[date] ?? 0;
    const next = (cur + 1) % 4;
    updateSubtask(taskId, stId, { scores: { ...st.scores, [date]: next } });
  };

  // --- Drag & Drop ---
  const handleDrop = (zone: Task["zone"]) => {
    if (!dragTask) return;
    updateTask(dragTask, { zone });
    setDragTask(null);
  };

  // --- Inline edit helpers ---
  const startEditTask = (id: string, name: string) => {
    setEditingTask(id);
    setEditName(name);
  };
  const confirmEditTask = () => {
    if (editingTask) {
      updateTask(editingTask, { name: editName });
      setEditingTask(null);
    }
  };
  const startEditSubtask = (id: string, name: string) => {
    setEditingSubtask(id);
    setEditName(name);
  };
  const confirmEditSubtask = (taskId: string) => {
    if (editingSubtask) {
      updateSubtask(taskId, editingSubtask, { name: editName });
      setEditingSubtask(null);
    }
  };

  if (!loaded) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">To Do</h1>
        <Button
          variant="outline" size="sm"
          onClick={() => setHideDone(!hideDone)}
          className="gap-1.5"
        >
          {hideDone ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {hideDone ? "Afficher terminées" : "Masquer terminées"}
        </Button>
      </div>

      {ZONES.filter((z) => !(z.key === "done" && hideDone)).map((zone) => {
        const zoneTasks = tasks.filter((t) => t.zone === zone.key);
        return (
          <div
            key={zone.key}
            className="rounded-lg border border-border bg-card p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(zone.key)}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {zone.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({zoneTasks.length})
                </span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => addTask(zone.key)} className="gap-1 h-7">
                <Plus className="h-3.5 w-3.5" /> Tâche
              </Button>
            </div>

            {zoneTasks.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">Aucune tâche</p>
            )}

            <div className="space-y-1">
              {zoneTasks.map((task) => {
                const progress = calcProgress(task.subtasks, dates);
                return (
                  <div
                    key={task.id}
                    className="rounded-md border border-border bg-background"
                    draggable
                    onDragStart={() => setDragTask(task.id)}
                  >
                    {/* Task header */}
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                      <button
                        onClick={() => updateTask(task.id, { expanded: !task.expanded })}
                        className="shrink-0"
                      >
                        {task.expanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {editingTask === task.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && confirmEditTask()}
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={confirmEditTask}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingTask(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="text-sm font-medium text-foreground truncate flex-1 cursor-pointer"
                          onDoubleClick={() => startEditTask(task.id, task.name)}
                        >
                          {task.name}
                        </span>
                      )}

                      {/* Progress */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => startEditTask(task.id, task.name)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {/* Move buttons */}
                        <select
                          value={task.zone}
                          onChange={(e) => updateTask(task.id, { zone: e.target.value as Task["zone"] })}
                          className="h-7 text-xs border border-input rounded bg-background px-1"
                        >
                          {ZONES.map((z) => (
                            <option key={z.key} value={z.key}>{z.label}</option>
                          ))}
                        </select>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          onClick={() => deleteTask(task.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {task.expanded && (
                      <div className="border-t border-border">
                        {/* Notes toggle */}
                        <div className="px-3 py-1 border-b border-border">
                          <button
                            className="text-xs text-muted-foreground flex items-center gap-1"
                            onClick={() => updateTask(task.id, { notesExpanded: !task.notesExpanded })}
                          >
                            {task.notesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Notes
                          </button>
                          {task.notesExpanded && (
                            <Textarea
                              value={task.notes}
                              onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                              placeholder="Notes…"
                              className="mt-1 text-xs min-h-[60px]"
                            />
                          )}
                        </div>

                        {/* Subtasks + date grid */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="sticky left-0 bg-card z-10 px-2 py-1 text-left font-medium text-muted-foreground min-w-[180px]">
                                  Sous-tâche
                                </th>
                                {dates.map((d) => (
                                  <th key={d} className="px-1 py-1 text-center font-medium text-muted-foreground whitespace-nowrap min-w-[40px]">
                                    {formatShortDate(d)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {task.subtasks.map((st) => (
                                <tr key={st.id} className="border-b border-border last:border-0">
                                  <td className="sticky left-0 bg-card z-10 px-2 py-1">
                                    <div className="flex items-center gap-1">
                                      {editingSubtask === st.id ? (
                                        <>
                                          <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-6 text-xs w-24"
                                            autoFocus
                                            onKeyDown={(e) => e.key === "Enter" && confirmEditSubtask(task.id)}
                                          />
                                          <button onClick={() => confirmEditSubtask(task.id)}>
                                            <Check className="h-3 w-3 text-primary" />
                                          </button>
                                          <button onClick={() => setEditingSubtask(null)}>
                                            <X className="h-3 w-3" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <span
                                            className="truncate max-w-[120px] cursor-pointer"
                                            onDoubleClick={() => startEditSubtask(st.id, st.name)}
                                          >
                                            {st.name}
                                          </span>
                                          <button onClick={() => startEditSubtask(st.id, st.name)}>
                                            <Pencil className="h-3 w-3 text-muted-foreground" />
                                          </button>
                                          <button onClick={() => deleteSubtask(task.id, st.id)}>
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  {dates.map((d) => {
                                    const score = st.scores[d] ?? 0;
                                    return (
                                      <td key={d} className="px-1 py-1 text-center">
                                        <button
                                          onClick={() => cycleScore(task.id, st.id, d)}
                                          className={cn(
                                            "w-7 h-7 rounded text-xs font-semibold transition-colors",
                                            SCORE_COLORS[score]
                                          )}
                                        >
                                          {score}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="px-3 py-1.5">
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                            onClick={() => addSubtask(task.id)}>
                            <Plus className="h-3 w-3" /> Sous-tâche
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

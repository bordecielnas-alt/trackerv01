import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
  Eye, EyeOff, Pencil, Check, X, ChevronsDownUp, ChevronsUpDown, Palette
} from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";

// --- Types ---
interface SubTask {
  id: string;
  name: string;
  scores: Record<string, number>;
}

interface Task {
  id: string;
  name: string;
  zone: "persistent" | "planned" | "inprogress" | "done";
  subtasks: SubTask[];
  notes: string;
  expanded: boolean;
  notesExpanded: boolean;
  color?: string;
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

const TASK_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#64748b",
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function calcTotalScore(subtasks: SubTask[]): number {
  let total = 0;
  for (const st of subtasks) {
    for (const v of Object.values(st.scores)) {
      total += v;
    }
  }
  return total;
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

function renderClickableText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{part}</a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dates, setDates] = useState<string[]>(() => generateDates(30));
  const [hideDone, setHideDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [allExpanded, setAllExpanded] = useState(true);
  const [colorPicker, setColorPicker] = useState<string | null>(null);

  // Drag state for tasks
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Drag state for subtasks
  const [dragSubId, setDragSubId] = useState<{ taskId: string; subId: string } | null>(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState<number | null>(null);

  useEffect(() => {
    apiGet<TodoData>("todo", "todo-data", { tasks: [], dates: [] }).then((data) => {
      if (data.tasks?.length) setTasks(data.tasks);
      if (data.dates?.length) setDates(data.dates);
      else setDates(generateDates(30));
      setLoaded(true);
    });
  }, []);

  const save = useCallback(
    (t: Task[], d?: string[]) => {
      apiPut("todo", "todo-data", { tasks: t, dates: d ?? dates });
    },
    [dates]
  );

  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    save(newTasks);
  };

  const addTask = (zone: Task["zone"]) => {
    const t: Task = {
      id: uid(), name: "Nouvelle tâche", zone,
      subtasks: [], notes: "", expanded: true, notesExpanded: false,
      color: TASK_COLORS[tasks.length % TASK_COLORS.length]
    };
    updateTasks([...tasks, t]);
  };

  const deleteTask = (id: string) => updateTasks(tasks.filter((t) => t.id !== id));
  const updateTask = (id: string, patch: Partial<Task>) => {
    updateTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addSubtask = (taskId: string) => {
    const st: SubTask = { id: uid(), name: "Sous-tâche", scores: {} };
    updateTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, st] } : t));
  };
  const deleteSubtask = (taskId: string, stId: string) => {
    updateTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== stId) } : t));
  };
  const updateSubtask = (taskId: string, stId: string, patch: Partial<SubTask>) => {
    updateTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === stId ? { ...s, ...patch } : s) } : t));
  };

  const cycleScore = (taskId: string, stId: string, date: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const st = task?.subtasks.find((s) => s.id === stId);
    if (!st) return;
    const cur = st.scores[date] ?? 0;
    updateSubtask(taskId, stId, { scores: { ...st.scores, [date]: (cur + 1) % 4 } });
  };

  // --- Task drag & drop (reorder within zone + move between zones) ---
  const handleTaskDragStart = (taskId: string) => setDragTaskId(taskId);
  const handleTaskDragOver = (e: React.DragEvent, zone: string, idx: number) => {
    if (!dragTaskId) return;
    e.preventDefault();
    setDragOverZone(zone);
    setDragOverIdx(idx);
  };
  const handleTaskDrop = (zone: Task["zone"]) => {
    if (!dragTaskId) return;
    const taskIdx = tasks.findIndex((t) => t.id === dragTaskId);
    if (taskIdx === -1) return;
    const newTasks = [...tasks];
    const [moved] = newTasks.splice(taskIdx, 1);
    moved.zone = zone;
    // Find insert position among zone tasks
    const zoneTasks = newTasks.filter((t) => t.zone === zone);
    const insertAfterIdx = dragOverIdx !== null && dragOverIdx < zoneTasks.length
      ? newTasks.indexOf(zoneTasks[dragOverIdx])
      : (zoneTasks.length > 0 ? newTasks.indexOf(zoneTasks[zoneTasks.length - 1]) + 1 : newTasks.length);
    newTasks.splice(insertAfterIdx, 0, moved);
    updateTasks(newTasks);
    setDragTaskId(null);
    setDragOverZone(null);
    setDragOverIdx(null);
  };

  // --- Subtask drag & drop ---
  const handleSubDragStart = (taskId: string, subId: string) => {
    setDragSubId({ taskId, subId });
  };
  const handleSubDragOver = (e: React.DragEvent, idx: number) => {
    if (!dragSubId) return;
    e.preventDefault();
    setDragOverSubIdx(idx);
  };
  const handleSubDrop = (taskId: string) => {
    if (!dragSubId || dragSubId.taskId !== taskId || dragOverSubIdx === null) {
      setDragSubId(null);
      setDragOverSubIdx(null);
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const subs = [...task.subtasks];
    const fromIdx = subs.findIndex((s) => s.id === dragSubId.subId);
    if (fromIdx === -1) return;
    const [moved] = subs.splice(fromIdx, 1);
    subs.splice(dragOverSubIdx, 0, moved);
    updateTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: subs } : t));
    setDragSubId(null);
    setDragOverSubIdx(null);
  };

  // Expand / collapse all
  const toggleExpandAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    updateTasks(tasks.map((t) => ({ ...t, expanded: next })));
  };

  const startEditTask = (id: string, name: string) => { setEditingTask(id); setEditName(name); };
  const confirmEditTask = () => {
    if (editingTask) { updateTask(editingTask, { name: editName }); setEditingTask(null); }
  };
  const startEditSubtask = (id: string, name: string) => { setEditingSubtask(id); setEditName(name); };
  const confirmEditSubtask = (taskId: string) => {
    if (editingSubtask) { updateSubtask(taskId, editingSubtask, { name: editName }); setEditingSubtask(null); }
  };

  // --- Bubble chart data ---
  const chartTasks = tasks.filter((t) => t.zone !== "done");
  const chartSubtasks: { taskName: string; taskColor: string; subName: string; date: string; score: number }[] = [];
  for (const t of allDoneTasks) {
    for (const st of t.subtasks) {
      for (const [d, s] of Object.entries(st.scores)) {
        if (s > 0) chartSubtasks.push({ taskName: t.name, taskColor: t.color || "#6366f1", subName: st.name, date: d, score: s });
      }
    }
  }

  // Unique subtask names and dates for chart
  const chartSubNames = [...new Set(chartSubtasks.map((c) => c.subName))];
  const chartDates = [...new Set(chartSubtasks.map((c) => c.date))].sort();

  if (!loaded) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">To Do</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleExpandAll} className="gap-1.5">
            {allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
            {allExpanded ? "Tout replier" : "Tout déplier"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHideDone(!hideDone)} className="gap-1.5">
            {hideDone ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hideDone ? "Afficher terminées" : "Masquer terminées"}
          </Button>
        </div>
      </div>

      {ZONES.filter((z) => !(z.key === "done" && hideDone)).map((zone) => {
        const zoneTasks = tasks.filter((t) => t.zone === zone.key);
        return (
          <div
            key={zone.key}
            className={cn("rounded-lg border border-border bg-card p-3", dragOverZone === zone.key && "ring-2 ring-primary/30")}
            onDragOver={(e) => { if (dragTaskId) { e.preventDefault(); setDragOverZone(zone.key); } }}
            onDragLeave={() => { if (dragOverZone === zone.key) setDragOverZone(null); }}
            onDrop={() => handleTaskDrop(zone.key)}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {zone.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">({zoneTasks.length})</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => addTask(zone.key)} className="gap-1 h-7">
                <Plus className="h-3.5 w-3.5" /> Tâche
              </Button>
            </div>

            {zoneTasks.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">Aucune tâche</p>
            )}

            <div className="space-y-1">
              {zoneTasks.map((task, tIdx) => {
                const totalScore = calcTotalScore(task.subtasks);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-md border border-border bg-background",
                      dragOverZone === zone.key && dragOverIdx === tIdx && "border-primary border-dashed"
                    )}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleTaskDragStart(task.id); }}
                    onDragOver={(e) => handleTaskDragOver(e, zone.key, tIdx)}
                    onDragEnd={() => { setDragTaskId(null); setDragOverZone(null); setDragOverIdx(null); }}
                  >
                    {/* Task header */}
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                      {/* Color indicator */}
                      <div className="relative shrink-0">
                        <button
                          className="w-3 h-3 rounded-full border border-border shrink-0"
                          style={{ backgroundColor: task.color || "#6366f1" }}
                          onClick={() => setColorPicker(colorPicker === task.id ? null : task.id)}
                          title="Couleur"
                        />
                        {colorPicker === task.id && (
                          <div className="absolute top-5 left-0 z-50 bg-popover border border-border rounded-md p-2 flex gap-1 flex-wrap w-[120px] shadow-lg">
                            {TASK_COLORS.map((c) => (
                              <button
                                key={c}
                                className={cn("w-5 h-5 rounded-full border-2", task.color === c ? "border-foreground" : "border-transparent")}
                                style={{ backgroundColor: c }}
                                onClick={() => { updateTask(task.id, { color: c }); setColorPicker(null); }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => updateTask(task.id, { expanded: !task.expanded })} className="shrink-0">
                        {task.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>

                      {editingTask === task.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmEditTask()} />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={confirmEditTask}><Check className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingTask(null)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-foreground truncate flex-1 cursor-pointer" onDoubleClick={() => startEditTask(task.id, task.name)}>
                          {task.name}
                        </span>
                      )}

                      {/* Score total */}
                      <span className="text-xs font-semibold text-muted-foreground shrink-0 ml-auto tabular-nums">{totalScore} pts</span>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditTask(task.id, task.name)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <select
                          value={task.zone}
                          onChange={(e) => updateTask(task.id, { zone: e.target.value as Task["zone"] })}
                          className="h-7 text-xs border border-input rounded bg-background px-1"
                        >
                          {ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
                        </select>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTask(task.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {task.expanded && (
                      <div className="border-t border-border">
                        {/* Notes toggle */}
                        <div className="px-3 py-1 border-b border-border">
                          <button className="text-xs text-muted-foreground flex items-center gap-1" onClick={() => updateTask(task.id, { notesExpanded: !task.notesExpanded })}>
                            {task.notesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Notes
                          </button>
                          {task.notesExpanded && (
                            <div className="mt-1">
                              <Textarea value={task.notes} onChange={(e) => updateTask(task.id, { notes: e.target.value })} placeholder="Notes…" className="text-xs min-h-[60px]" />
                              {task.notes && (
                                <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{renderClickableText(task.notes)}</div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Subtasks + date grid */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="sticky left-0 bg-card z-10 px-2 py-1 text-left font-medium text-muted-foreground min-w-[180px]">Sous-tâche</th>
                                {dates.map((d) => (
                                  <th key={d} className="px-1 py-1 text-center font-medium text-muted-foreground whitespace-nowrap min-w-[40px]">{formatShortDate(d)}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {task.subtasks.map((st, stIdx) => (
                                <tr
                                  key={st.id}
                                  className={cn("border-b border-border last:border-0", dragOverSubIdx === stIdx && dragSubId?.taskId === task.id && "bg-accent/30")}
                                  draggable
                                  onDragStart={(e) => { e.stopPropagation(); handleSubDragStart(task.id, st.id); }}
                                  onDragOver={(e) => handleSubDragOver(e, stIdx)}
                                  onDrop={(e) => { e.stopPropagation(); handleSubDrop(task.id); }}
                                  onDragEnd={() => { setDragSubId(null); setDragOverSubIdx(null); }}
                                >
                                  <td className="sticky left-0 bg-card z-10 px-2 py-1">
                                    <div className="flex items-center gap-1">
                                      <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab shrink-0" />
                                      {editingSubtask === st.id ? (
                                        <>
                                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-6 text-xs w-24" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmEditSubtask(task.id)} />
                                          <button onClick={() => confirmEditSubtask(task.id)}><Check className="h-3 w-3 text-primary" /></button>
                                          <button onClick={() => setEditingSubtask(null)}><X className="h-3 w-3" /></button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="truncate max-w-[120px] cursor-pointer" onDoubleClick={() => startEditSubtask(st.id, st.name)}>{st.name}</span>
                                          <button onClick={() => startEditSubtask(st.id, st.name)}><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                                          <button onClick={() => deleteSubtask(task.id, st.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
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
                                          className={cn("w-7 h-7 rounded text-xs font-semibold transition-colors",
                                            score === 0 ? "bg-muted text-muted-foreground" :
                                            score === 1 ? "bg-yellow-200 text-yellow-900" :
                                            score === 2 ? "bg-orange-300 text-orange-900" :
                                            "bg-green-400 text-green-900"
                                          )}
                                        >{score}</button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-3 py-1.5">
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => addSubtask(task.id)}>
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

      {/* Bubble chart for done tasks */}
      {chartSubtasks.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Graphique des tâches terminées</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                {/* Y-axis labels */}
                <div className="flex flex-col pr-2 pt-6">
                  {chartSubNames.map((name) => (
                    <div key={name} className="h-10 flex items-center text-xs text-muted-foreground truncate max-w-[120px]">{name}</div>
                  ))}
                </div>
                {/* Chart grid */}
                <div className="flex-1 overflow-x-auto">
                  {/* X-axis header */}
                  <div className="flex">
                    {chartDates.map((d) => (
                      <div key={d} className="w-10 text-center text-xs text-muted-foreground shrink-0">{formatShortDate(d)}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  {chartSubNames.map((subName) => (
                    <div key={subName} className="flex h-10 items-center">
                      {chartDates.map((date) => {
                        const entry = chartSubtasks.find((c) => c.subName === subName && c.date === date);
                        const score = entry?.score ?? 0;
                        const color = entry?.taskColor ?? "transparent";
                        const size = score === 0 ? 0 : 8 + score * 6;
                        return (
                          <div key={date} className="w-10 flex items-center justify-center shrink-0">
                            {score > 0 && (
                              <div
                                className="rounded-full"
                                style={{ width: size, height: size, backgroundColor: color, opacity: 0.85 }}
                                title={`${subName} — ${formatShortDate(date)}: ${score}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

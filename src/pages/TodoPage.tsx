import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
  Eye, EyeOff, Pencil, Check, X, ChevronsDownUp, ChevronsUpDown, Palette,
  ChevronLeft, ChevronsLeft, ChevronsRight, Calendar
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
  "#0ea5e9", "#d946ef", "#84cc16", "#f43f5e", "#06b6d4",
  "#a855f7", "#10b981", "#e11d48", "#7c3aed", "#ca8a04",
  "#0284c7", "#c026d3", "#65a30d", "#be123c", "#0891b2",
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

const WINDOW_DAYS = 30; // Number of date columns visible at once
const SHIFT_DAYS = 30;  // Days shifted per arrow click
const COL_WIDTH = 40;
const STICKY_COL_WIDTH = 180;

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateToStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build a sliding window of WINDOW_DAYS dates.
 * `offsetDays` shifts the window relative to a today-centered baseline.
 * - offset=0  → window centered on today
 * - offset=-30 → 30 days earlier (past)
 * - offset=+30 → 30 days later (future)
 */
function buildDateWindow(offsetDays: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  const startOffset = -Math.floor(WINDOW_DAYS / 2) + offsetDays;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + startOffset + i);
    dates.push(dateToStr(d));
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

function NotesEditor({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const textToHtml = (text: string) => {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const withLinks = escaped.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80" data-url="true">$1</a>'
    );
    return withLinks.replace(/\n/g, "<br>");
  };

  const htmlToText = (el: HTMLElement) => {
    let text = "";
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || "";
      } else if (node.nodeName === "BR") {
        text += "\n";
      } else if (node.nodeName === "A") {
        text += (node as HTMLElement).textContent || "";
      } else if (node.nodeName === "DIV" || node.nodeName === "P") {
        if (text && !text.endsWith("\n")) text += "\n";
        text += htmlToText(node as HTMLElement);
      } else {
        text += (node as HTMLElement).textContent || "";
      }
    }
    return text;
  };

  useEffect(() => {
    if (editorRef.current && !isEditing) {
      editorRef.current.innerHTML = value ? textToHtml(value) : "";
    }
  }, [value, isEditing]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const newText = htmlToText(editorRef.current);
    onChange(newText);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editorRef.current) {
      const newText = htmlToText(editorRef.current);
      onChange(newText);
      // Re-render with clickable links
      editorRef.current.innerHTML = newText ? textToHtml(newText) : "";
    }
    onBlur();
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A" && target.dataset.url && !isEditing) {
      e.preventDefault();
      window.open(target.getAttribute("href") || "", "_blank");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
  };

  return (
    <div className="mt-1 mb-1">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-placeholder="Notes, liens, remarques…"
        className={cn(
          "text-xs min-h-[80px] whitespace-pre-wrap rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !value && "before:content-[attr(data-placeholder)] before:text-muted-foreground before:pointer-events-none"
        )}
      />
    </div>
  );
}

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [windowOffset, setWindowOffset] = useState<number>(0); // in days, 0 = today-centered
  const dates = buildDateWindow(windowOffset);
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

  const today = todayStr();

  useEffect(() => {
    apiGet<TodoData>("todo", "todo-data", { tasks: [], dates: [] }).then((data) => {
      if (data.tasks?.length) setTasks(data.tasks);
      // Note: `dates` field is no longer driven by storage — we always show a sliding window.
      setLoaded(true);
    });
  }, []);

  // Window navigation
  const shiftWindow = (days: number) => setWindowOffset((o) => o + days);
  const resetWindow = () => setWindowOffset(0);

  // Range label (first → last visible date)
  const rangeLabel = dates.length > 0
    ? `${formatShortDate(dates[0])} → ${formatShortDate(dates[dates.length - 1])}`
    : "";

  const save = useCallback((t: Task[]) => {
    // Persist tasks only; dates are window-driven and not stored.
    apiPut("todo", "todo-data", { tasks: t, dates: [] });
  }, []);

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

  // --- Chart data: grouped by task ---
  // Show only persistent + inprogress tasks (in that order). Keep ALL subtasks
  // in their user-defined order, even those with no scores in the visible window.
  const CHART_ZONE_ORDER: Task["zone"][] = ["persistent", "inprogress"];
  const chartTasks = CHART_ZONE_ORDER.flatMap((z) => tasks.filter((t) => t.zone === z));
  const chartGroups: { taskName: string; taskColor: string; subtasks: { subName: string; scores: Record<string, number> }[] }[] = [];
  for (const t of chartTasks) {
    const subs = t.subtasks.map((st) => ({ subName: st.name, scores: st.scores }));
    if (subs.length > 0) chartGroups.push({ taskName: t.name, taskColor: t.color || "#6366f1", subtasks: subs });
  }
  const chartDates = dates;

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

      {/* Date window navigation — arrows shift the visible 30-day window */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-border rounded-md p-2 shadow-sm">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftWindow(-SHIFT_DAYS)} title="Mois précédent">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftWindow(-7)} title="Semaine précédente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground tabular-nums">{rangeLabel}</span>
          {windowOffset !== 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetWindow}>
              Aujourd'hui
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftWindow(7)} title="Semaine suivante">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftWindow(SHIFT_DAYS)} title="Mois suivant">
            <ChevronsRight className="h-4 w-4" />
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
                          <div className="absolute top-5 left-0 z-50 bg-popover border border-border rounded-md p-2 flex gap-1 flex-wrap w-[160px] shadow-lg">
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
                            Notes {task.notes && !task.notesExpanded && <span className="text-muted-foreground/60 ml-1 truncate max-w-[200px] inline-block align-bottom">— {task.notes.split('\n')[0]}</span>}
                          </button>
                          {task.notesExpanded && (
                            <NotesEditor
                              value={task.notes}
                              onChange={(val) => updateTask(task.id, { notes: val })}
                              onBlur={() => save(tasks)}
                            />
                          )}
                        </div>

                        {/* Subtasks + date grid */}
                        <div className="overflow-x-auto">

                          <table
                            className="text-xs table-fixed"
                            style={{ width: STICKY_COL_WIDTH + dates.length * COL_WIDTH }}
                          >
                            <thead>
                              <tr className="border-b border-border">
                                <th
                                  className="sticky left-0 bg-card z-10 px-2 py-1 text-left font-medium text-muted-foreground"
                                  style={{ width: STICKY_COL_WIDTH, minWidth: STICKY_COL_WIDTH, maxWidth: STICKY_COL_WIDTH }}
                                >Sous-tâche</th>
                                {dates.map((d) => (
                                  <th
                                    key={d}
                                    className={cn(
                                      "py-1 text-center font-medium whitespace-nowrap",
                                      d === today ? "text-primary bg-primary/10" : "text-muted-foreground"
                                    )}
                                    style={{ width: COL_WIDTH, minWidth: COL_WIDTH, maxWidth: COL_WIDTH }}
                                  >
                                    {formatShortDate(d)}
                                  </th>
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
                                      <td
                                        key={d}
                                        className={cn("py-1 text-center", d === today && "bg-primary/5")}
                                        style={{ width: COL_WIDTH, minWidth: COL_WIDTH, maxWidth: COL_WIDTH }}
                                      >
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
      {chartGroups.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            Graphique des tâches actives
            <span className="ml-2 text-xs font-normal text-muted-foreground normal-case">— {rangeLabel}</span>
          </h2>
          <div className="overflow-x-auto">
            <div className="inline-block" style={{ minWidth: STICKY_COL_WIDTH + chartDates.length * COL_WIDTH }}>
              {/* Header row: empty label + date columns */}
              <div className="flex">
                <div className="shrink-0" style={{ width: STICKY_COL_WIDTH, minWidth: STICKY_COL_WIDTH }} />
                {chartDates.map((d) => (
                  <div
                    key={d}
                    className={cn(
                      "text-center text-[10px] shrink-0 whitespace-nowrap",
                      d === today ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground"
                    )}
                    style={{ width: COL_WIDTH, minWidth: COL_WIDTH, maxWidth: COL_WIDTH }}
                  >
                    {formatShortDate(d)}
                  </div>
                ))}
              </div>

              {chartGroups.map((group, gIdx) => (
                <Fragment key={group.taskName + gIdx}>
                  {/* Task title row — label aligned, empty grid */}
                  <div className="flex">
                    <div
                      className="shrink-0 h-6 flex items-center text-xs font-bold truncate"
                      style={{ width: STICKY_COL_WIDTH, minWidth: STICKY_COL_WIDTH, color: group.taskColor }}
                    >
                      {group.taskName}
                    </div>
                    {chartDates.map((d) => (
                      <div
                        key={d}
                        className={cn("h-6 shrink-0", d === today && "bg-primary/5")}
                        style={{ width: COL_WIDTH, minWidth: COL_WIDTH, maxWidth: COL_WIDTH }}
                      />
                    ))}
                  </div>

                  {/* One row per subtask */}
                  {group.subtasks.map((sub) => (
                    <div key={sub.subName} className="flex">
                      <div
                        className="shrink-0 h-8 flex items-center text-xs text-muted-foreground truncate pl-3"
                        style={{ width: STICKY_COL_WIDTH, minWidth: STICKY_COL_WIDTH }}
                      >
                        {sub.subName}
                      </div>
                      {chartDates.map((date, dIdx) => {
                        const score = sub.scores[date] ?? 0;
                        const maxH = 28;
                        const barH = score === 0 ? 0 : Math.round((score / 3) * maxH);
                        const prevDate = dIdx > 0 ? chartDates[dIdx - 1] : null;
                        const nextDate = dIdx < chartDates.length - 1 ? chartDates[dIdx + 1] : null;
                        const prevScore = prevDate ? (sub.scores[prevDate] ?? 0) : 0;
                        const nextScore = nextDate ? (sub.scores[nextDate] ?? 0) : 0;
                        const hasLeft = prevScore > 0 && score > 0;
                        const hasRight = nextScore > 0 && score > 0;
                        const borderRadius = `${hasLeft ? 0 : 3}px ${hasRight ? 0 : 3}px ${hasRight ? 0 : 3}px ${hasLeft ? 0 : 3}px`;
                        return (
                          <div
                            key={date}
                            className={cn("flex items-end justify-center shrink-0 h-8", date === today && "bg-primary/5")}
                            style={{ width: COL_WIDTH, minWidth: COL_WIDTH, maxWidth: COL_WIDTH }}
                          >
                            {score > 0 && (
                              <div
                                className="w-full"
                                style={{ height: barH, backgroundColor: group.taskColor, opacity: 0.85, borderRadius }}
                                title={`${group.taskName} / ${sub.subName} — ${formatShortDate(date)}: ${score}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Continuous separator across full width */}
                  {gIdx < chartGroups.length - 1 && (
                    <div className="h-px bg-border" style={{ width: STICKY_COL_WIDTH + chartDates.length * COL_WIDTH }} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

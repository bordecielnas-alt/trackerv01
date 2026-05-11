import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ListTodo, CheckCircle2 } from "lucide-react";
import {
  InspirationTodoItem,
  loadInspirationTodos,
  saveInspirationTodos,
} from "@/lib/inspiration-todo-store";
import { cn } from "@/lib/utils";

export default function InspirationTodo() {
  const [items, setItems] = useState<InspirationTodoItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newText, setNewText] = useState("");
  const saveTimer = useRef<number | null>(null);
  const skipSave = useRef(true);

  useEffect(() => {
    loadInspirationTodos().then((d) => {
      setItems(d.items || []);
      setLoaded(true);
    });
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveInspirationTodos({ items });
    }, 500);
  }, [items, loaded]);

  const addItem = () => {
    const text = newText.trim();
    if (!text) return;
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        done: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewText("");
  };

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, done: !it.done, completedAt: !it.done ? new Date().toISOString() : null }
          : it,
      ),
    );
  };

  const updateText = (id: string, text: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const todo = items.filter((it) => !it.done);
  const done = items.filter((it) => it.done);

  if (!loaded) return null;

  return (
    <>
      <Card className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">À faire</h2>
          <span className="ml-auto text-xs text-muted-foreground">{todo.length}</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            placeholder="Nouvelle tâche…"
          />
          <Button size="icon" onClick={addItem} aria-label="Ajouter">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1.5 overflow-auto flex-1">
          {todo.map((it) => (
            <Row
              key={it.id}
              item={it}
              onToggle={() => toggle(it.id)}
              onChange={(t) => updateText(it.id, t)}
              onDelete={() => remove(it.id)}
            />
          ))}
          {todo.length === 0 && (
            <li className="text-sm text-muted-foreground italic px-1">Rien à faire 🎉</li>
          )}
        </ul>
      </Card>

      <Card className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-secondary" />
          <h2 className="font-semibold">Terminé</h2>
          <span className="ml-auto text-xs text-muted-foreground">{done.length}</span>
        </div>
        <ul className="space-y-1.5 overflow-auto flex-1">
          {done.map((it) => (
            <Row
              key={it.id}
              item={it}
              onToggle={() => toggle(it.id)}
              onChange={(t) => updateText(it.id, t)}
              onDelete={() => remove(it.id)}
            />
          ))}
          {done.length === 0 && (
            <li className="text-sm text-muted-foreground italic px-1">Aucune tâche terminée</li>
          )}
        </ul>
      </Card>
    </>
  );
}

function Row({
  item,
  onToggle,
  onChange,
  onDelete,
}: {
  item: InspirationTodoItem;
  onToggle: () => void;
  onChange: (t: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  useEffect(() => { setDraft(item.text); }, [item.text]);

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== item.text) onChange(t);
    else setDraft(item.text);
  };

  return (
    <li className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/40">
      <Checkbox checked={item.done} onCheckedChange={onToggle} />
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(item.text); setEditing(false); }
          }}
          className="h-7 px-2 py-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "flex-1 text-left text-sm truncate",
            item.done && "line-through text-muted-foreground",
          )}
          title={item.text}
        >
          {item.text}
        </button>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

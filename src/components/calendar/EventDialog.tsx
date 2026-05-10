import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaldavEvent, EventPayload, listCalendars } from "@/lib/caldav-store";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CaldavEvent | null;
  defaultDate?: Date;
  onSubmit: (payload: EventPayload) => Promise<void>;
}

function toLocalInput(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (allDay) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventDialog({ open, onOpenChange, initial, defaultDate, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setTitle(initial.title);
      setAllDay(initial.allDay);
      setStart(toLocalInput(initial.start, initial.allDay));
      setEnd(toLocalInput(initial.end, initial.allDay));
      setLocation(initial.location || "");
      setDescription(initial.description || "");
    } else {
      const base = defaultDate || new Date();
      const startD = new Date(base);
      startD.setHours(9, 0, 0, 0);
      const endD = new Date(startD);
      endD.setHours(10);
      setTitle("");
      setAllDay(false);
      setStart(toLocalInput(startD.toISOString(), false));
      setEnd(toLocalInput(endD.toISOString(), false));
      setLocation("");
      setDescription("");
    }
  }, [open, initial, defaultDate]);

  const handleSave = async () => {
    if (!title.trim()) { setError("Titre requis"); return; }
    setSaving(true); setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        allDay,
        location: location.trim(),
        description: description.trim(),
      });
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier l'évènement" : "Nouvel évènement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={allDay} onCheckedChange={setAllDay} id="allday" />
            <Label htmlFor="allday">Toute la journée</Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Début</Label>
              <Input type={allDay ? "date" : "datetime-local"} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type={allDay ? "date" : "datetime-local"} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Lieu</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

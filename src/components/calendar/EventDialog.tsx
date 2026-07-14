import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaldavEvent, EventPayload, listCalendars, RRule } from "@/lib/caldav-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CaldavEvent | null;
  defaultDate?: Date;
  onSubmit: (payload: EventPayload) => Promise<void>;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

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
  const [color, setColor] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState<string>("");
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<RRule["freq"]>("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: calendars = [] } = useQuery({
    queryKey: ["caldav-calendars"], queryFn: listCalendars,
    enabled: open && !initial, staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setTitle(initial.title); setAllDay(initial.allDay);
      setStart(toLocalInput(initial.start, initial.allDay));
      setEnd(toLocalInput(initial.end, initial.allDay));
      setLocation(initial.location || ""); setDescription(initial.description || "");
      setColor(initial.color || null);
      setRecurring(!!initial.rrule);
      if (initial.rrule) {
        setFreq(initial.rrule.freq); setInterval(initial.rrule.interval || 1);
        setUntil(initial.rrule.until ? initial.rrule.until.slice(0, 10) : "");
      }
    } else {
      const base = defaultDate || new Date();
      const startD = new Date(base); startD.setHours(9, 0, 0, 0);
      const endD = new Date(startD); endD.setHours(10);
      setTitle(""); setAllDay(false);
      setStart(toLocalInput(startD.toISOString(), false)); setEnd(toLocalInput(endD.toISOString(), false));
      setLocation(""); setDescription(""); setColor(null);
      setRecurring(false); setFreq("WEEKLY"); setInterval(1); setUntil("");
    }
  }, [open, initial, defaultDate]);

  useEffect(() => {
    if (!initial && calendars.length && !calendarUrl) setCalendarUrl(calendars[0].url);
  }, [calendars, initial, calendarUrl]);

  const handleSave = async () => {
    if (!title.trim()) { setError("Titre requis"); return; }
    setSaving(true); setError(null);
    try {
      const rrule: RRule | null = recurring ? {
        freq, interval: Math.max(1, interval),
        until: until ? new Date(until + "T23:59:59").toISOString() : null,
      } : null;
      await onSubmit({
        title: title.trim(),
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        allDay, location: location.trim(), description: description.trim(),
        color, rrule,
        ...(initial ? {} : { calendarUrl: calendarUrl || undefined }),
      });
      onOpenChange(false);
    } catch (e: any) { setError(e?.message || "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Modifier l'évènement" : "Nouvel évènement"}</DialogTitle></DialogHeader>
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
            <div><Label>Début</Label><Input type={allDay ? "date" : "datetime-local"} value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Fin</Label><Input type={allDay ? "date" : "datetime-local"} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div><Label>Lieu</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

          <div>
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={() => setColor(null)} className={cn("w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs", !color ? "border-primary" : "border-transparent")}>∅</button>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("w-7 h-7 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={recurring} onCheckedChange={setRecurring} id="rec" />
              <Label htmlFor="rec">Récurrent</Label>
            </div>
            {recurring && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Tous les</Label>
                  <Input type="number" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label className="text-xs">Fréquence</Label>
                  <Select value={freq} onValueChange={(v) => setFreq(v as RRule["freq"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Jour(s)</SelectItem>
                      <SelectItem value="WEEKLY">Semaine(s)</SelectItem>
                      <SelectItem value="MONTHLY">Mois</SelectItem>
                      <SelectItem value="YEARLY">Année(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Jusqu'au</Label>
                  <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {!initial && calendars.length > 1 && (
            <div>
              <Label>Calendrier</Label>
              <Select value={calendarUrl} onValueChange={setCalendarUrl}>
                <SelectTrigger><SelectValue placeholder="Choisir un calendrier" /></SelectTrigger>
                <SelectContent>{calendars.map((c) => <SelectItem key={c.url} value={c.url}>{c.displayName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {error && <div className="text-sm text-destructive whitespace-pre-wrap break-words">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents, CaldavEvent } from "@/lib/caldav-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, CalendarRange, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; return addDays(x, -day); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function fmtTime(d: Date) { return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }

export default function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));

  const { from, to } = useMemo(() => {
    if (view === "month") {
      const s = startOfMonth(cursor); const e = endOfMonth(cursor);
      return { from: addDays(startOfWeek(s), -7), to: addDays(startOfWeek(e), 14) };
    }
    if (view === "week") {
      const s = startOfWeek(cursor); return { from: s, to: addDays(s, 7) };
    }
    return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
  }, [view, cursor]);

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["caldav", from.toISOString(), to.toISOString()],
    queryFn: () => fetchEvents(from, to),
    retry: false,
  });

  const navigate = (dir: -1 | 1) => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else if (view === "week") setCursor(addDays(cursor, 7 * dir));
    else setCursor(addDays(cursor, dir));
  };

  const title = useMemo(() => {
    if (view === "month") return cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(cursor); const e = addDays(s, 6);
      return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return cursor.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [view, cursor]);

  const errorMessage = (error as Error | null)?.message;
  const isConfigError = errorMessage?.includes("non configuré") || errorMessage?.includes("CalDAV libraries");

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarRange className="h-6 w-6 text-primary" /> Calendrier</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>Aujourd'hui</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <div className="font-medium capitalize px-2 min-w-[200px] text-center">{title}</div>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="month">Mois</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="day">Jour</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Impossible de charger le calendrier</div>
            <div className="text-muted-foreground">{errorMessage}</div>
            {isConfigError && (
              <Link to="/admin" className="text-primary underline mt-1 inline-block">Configurer dans l'onglet Admin →</Link>
            )}
          </div>
        </Card>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Chargement des évènements…</div>}

      {view === "month" && <MonthView cursor={cursor} events={events} onPickDay={(d) => { setCursor(d); setView("day"); }} />}
      {view === "week" && <WeekView cursor={cursor} events={events} />}
      {view === "day" && <DayView cursor={cursor} events={events} />}
    </div>
  );
}

function eventColor() { return "bg-primary/15 text-primary border-l-2 border-primary"; }

function EventChip({ ev, full }: { ev: CaldavEvent; full?: boolean }) {
  const start = new Date(ev.start);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate hover:opacity-80", eventColor())}>
          {!ev.allDay && !full && <span className="font-medium mr-1">{fmtTime(start)}</span>}
          {ev.title}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-1.5">
          <div className="font-semibold">{ev.title}</div>
          <div className="text-xs text-muted-foreground">
            {ev.allDay ? "Toute la journée" : `${fmtTime(new Date(ev.start))} – ${fmtTime(new Date(ev.end))}`}
            {" • "}{new Date(ev.start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {ev.location && <div className="text-xs">📍 {ev.location}</div>}
          {ev.description && <div className="text-xs whitespace-pre-wrap text-muted-foreground border-t pt-2">{ev.description}</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MonthView({ cursor, events, onPickDay }: { cursor: Date; events: CaldavEvent[]; onPickDay: (d: Date) => void }) {
  const start = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7 bg-muted/40 text-xs font-medium">
        {dayNames.map((n) => <div key={n} className="px-2 py-1.5 text-center">{n}</div>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const dayEvents = events.filter((e) => sameDay(new Date(e.start), d)).sort((a, b) => +new Date(a.start) - +new Date(b.start));
          return (
            <div key={i} className={cn("border-t border-l p-1 min-h-[100px] flex flex-col gap-0.5", !inMonth && "bg-muted/20 text-muted-foreground", (i + 1) % 7 === 0 && "border-r")}>
              <button onClick={() => onPickDay(d)} className={cn("text-xs font-medium self-start px-1.5 py-0.5 rounded hover:bg-accent", isToday && "bg-primary text-primary-foreground")}>{d.getDate()}</button>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => <EventChip key={e.uid + e.start} ev={e} />)}
                {dayEvents.length > 3 && <button onClick={() => onPickDay(d)} className="text-[10px] text-muted-foreground hover:text-foreground text-left px-1">+{dayEvents.length - 3} autre(s)</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HoursColumn() {
  return (
    <div className="flex flex-col text-[10px] text-muted-foreground">
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="h-12 border-t pr-1 text-right">{String(h).padStart(2, "0")}:00</div>
      ))}
    </div>
  );
}

function DayColumn({ date, events }: { date: Date; events: CaldavEvent[] }) {
  const dayEvents = events.filter((e) => sameDay(new Date(e.start), date));
  return (
    <div className="relative flex-1 border-l">
      {Array.from({ length: 24 }, (_, h) => <div key={h} className="h-12 border-t" />)}
      {dayEvents.map((ev) => {
        if (ev.allDay) return null;
        const s = new Date(ev.start); const e = new Date(ev.end);
        const top = (s.getHours() + s.getMinutes() / 60) * 48;
        const height = Math.max(20, ((e.getTime() - s.getTime()) / 3600000) * 48);
        return (
          <div key={ev.uid + ev.start} className="absolute left-1 right-1" style={{ top, height }}>
            <EventChip ev={ev} full />
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ cursor, events }: { cursor: Date; events: CaldavEvent[] }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex">
        <div className="w-12" />
        {days.map((d) => (
          <div key={d.toISOString()} className={cn("flex-1 text-center py-2 text-xs font-medium border-l", sameDay(d, today) && "bg-primary/10 text-primary")}>
            {d.toLocaleDateString("fr-FR", { weekday: "short" })} <span className="font-bold">{d.getDate()}</span>
          </div>
        ))}
      </div>
      <div className="flex max-h-[70vh] overflow-y-auto">
        <div className="w-12"><HoursColumn /></div>
        {days.map((d) => <DayColumn key={d.toISOString()} date={d} events={events} />)}
      </div>
    </div>
  );
}

function DayView({ cursor, events }: { cursor: Date; events: CaldavEvent[] }) {
  const allDay = events.filter((e) => e.allDay && sameDay(new Date(e.start), cursor));
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {allDay.length > 0 && (
        <div className="border-b p-2 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Toute la journée</div>
          {allDay.map((e) => <EventChip key={e.uid} ev={e} full />)}
        </div>
      )}
      <div className="flex max-h-[75vh] overflow-y-auto">
        <div className="w-14"><HoursColumn /></div>
        <DayColumn date={cursor} events={events} />
      </div>
    </div>
  );
}

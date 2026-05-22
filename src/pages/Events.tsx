/**
 * Events.tsx — Pre-primary teacher's class-scoped calendar composer.
 *
 * Writes to the same `pp_events` collection that the
 * pre-primary-parent-dashboard /calendar page subscribes to, BUT scoped
 * strictly to the teacher's assigned class (audience='class',
 * classId=primaryClass.id is FORCED — no audience picker on this surface).
 *
 * Mirrors the Notices composer UX so the teacher has a single mental
 * model. Distinct mobile + desktop layouts per project policy.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Users,
  Search,
  X,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Same set as parent useEvents.ts so types stay in sync
const TYPES = [
  { key: "celebration", label: "Celebration", emoji: "🎉" },
  { key: "ptm", label: "PTM", emoji: "🤝" },
  { key: "trip", label: "Trip", emoji: "🚌" },
  { key: "exam", label: "Assessment", emoji: "📝" },
  { key: "general", label: "General", emoji: "📅" },
  { key: "holiday", label: "Holiday", emoji: "🏖️" },
] as const;

type EventType = (typeof TYPES)[number]["key"];
type Audience = "school" | "stage" | "class";

const TYPE_BG: Record<EventType, string> = {
  holiday: "bg-edu-light-red text-edu-red border-edu-red/30",
  ptm: "bg-edu-light-blue text-edu-blue border-edu-blue/30",
  celebration: "bg-edu-light-pink text-edu-pink border-edu-pink/30",
  exam: "bg-edu-light-yellow text-edu-yellow border-edu-yellow/30",
  trip: "bg-edu-light-green text-edu-green border-edu-green/30",
  general: "bg-secondary text-edu-navy border-border",
};

interface EventRow {
  id: string;
  schoolId: string;
  audience: Audience;
  classId?: string;
  className?: string;
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  createdBy?: string;
  createdByName?: string;
  createdByRole?: "principal" | "teacher" | "owner";
}

interface FormState {
  title: string;
  description: string;
  type: EventType;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
}

const todayStr = () => new Date().toLocaleDateString("en-CA");

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  type: "celebration",
  startDate: todayStr(),
  endDate: "",
  allDay: true,
  startTime: "",
  endTime: "",
  location: "",
});

export default function Events() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const isDesktop = useIsDesktop();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const schoolId = teacherData?.schoolId;
  const classId = primaryClass?.id;
  const myUid = teacherData?.id;

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    // Pull 90 days back through 365 days forward, then filter class-audience client-side.
    const today = new Date();
    const lower = new Date(today);
    lower.setDate(lower.getDate() - 90);
    const lowerStr = lower.toLocaleDateString("en-CA");

    const q = query(
      collection(db, "pp_events"),
      where("schoolId", "==", schoolId),
      where("startDate", ">=", lowerStr),
      orderBy("startDate", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: EventRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          const audience = (data.audience as Audience) || "school";
          if (audience === "class" && data.classId !== classId) return;
          rows.push({
            id: d.id,
            schoolId: data.schoolId,
            audience,
            classId: data.classId,
            className: data.className,
            title: data.title || "",
            description: data.description,
            type: (data.type as EventType) || "general",
            startDate: data.startDate || "",
            endDate: data.endDate,
            startTime: data.startTime,
            endTime: data.endTime,
            allDay: data.allDay !== false,
            location: data.location,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            createdByRole: data.createdByRole,
          });
        });
        setEvents(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[Events] subscription:", err);
        toast.error(
          `Could not load events: ${err instanceof Error ? err.message : err}`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [schoolId, classId]);

  const upcoming = useMemo(() => {
    const today = todayStr();
    return events
      .filter((e) => (e.endDate || e.startDate) >= today)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }, [events]);

  const past = useMemo(() => {
    const today = todayStr();
    return events
      .filter((e) => (e.endDate || e.startDate) < today)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [events]);

  const filtered = useMemo(() => {
    const list = tab === "upcoming" ? upcoming : past;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        (e.location || "").toLowerCase().includes(q)
    );
  }, [upcoming, past, tab, search]);

  const stats = useMemo(() => {
    return {
      upcoming: upcoming.length,
      mine: events.filter((e) => e.createdBy === myUid).length,
      thisWeek: upcoming.filter((e) => {
        const days = differenceInCalendarDays(parseISO(e.startDate), new Date());
        return days >= 0 && days <= 7;
      }).length,
    };
  }, [events, upcoming, myUid]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (e: EventRow) => {
    if (e.createdBy !== myUid) {
      toast.error("You can only edit events you created");
      return;
    }
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description || "",
      type: e.type,
      startDate: e.startDate,
      endDate: e.endDate || "",
      allDay: e.allDay,
      startTime: e.startTime || "",
      endTime: e.endTime || "",
      location: e.location || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !classId || !teacherData?.id) {
      toast.error("Missing class context");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.startDate) {
      toast.error("Start date is required");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      toast.error("End date must be on or after start date");
      return;
    }
    if (!form.allDay && form.startTime && form.endTime && form.endTime <= form.startTime) {
      toast.error("End time must be after start time");
      return;
    }

    setSaving(true);
    try {
      const payload: DocumentData = {
        schoolId,
        audience: "class" as const,
        classId,
        className: primaryClass?.name,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        allDay: form.allDay,
        startTime: form.allDay ? undefined : form.startTime || undefined,
        endTime: form.allDay ? undefined : form.endTime || undefined,
        location: form.location.trim() || undefined,
        createdBy: teacherData.id,
        createdByName: teacherData.name || teacherData.email || "Teacher",
        createdByRole: "teacher" as const,
      };

      if (editingId) {
        await updateDoc(doc(db, "pp_events", editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        toast.success("Event updated");
      } else {
        await addDoc(collection(db, "pp_events"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success(
          `Event added · ${primaryClass?.name} parents will see it on their Calendar ✓`
        );
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (err) {
      console.error("[Events] save:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save event: ${msg.slice(0, 200)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: EventRow) => {
    if (e.createdBy !== myUid) {
      toast.error("Only the principal can delete events not created by you.");
      return;
    }
    if (!window.confirm(`Delete "${e.title}"? Parents stop seeing it immediately.`))
      return;
    try {
      await deleteDoc(doc(db, "pp_events", e.id));
      toast.success("Event deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not delete: ${msg.slice(0, 120)}`);
    }
  };

  // ── EARLY RETURNS go AFTER all hooks ──────────────────────────────────
  if (classLoading) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Resolving your class…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-bold text-edu-navy">No class assigned</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "py-4 space-y-4 animate-fade-in",
          isDesktop ? "px-6 lg:px-10 max-w-7xl mx-auto" : "px-4"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "rounded-xl bg-edu-light-pink text-edu-pink flex items-center justify-center",
                isDesktop ? "w-10 h-10" : "w-9 h-9"
              )}
            >
              <CalendarIcon className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
            </div>
            <div>
              <h1
                className={cn(
                  "font-black text-edu-navy leading-none",
                  isDesktop ? "text-2xl" : "text-xl"
                )}
              >
                Class Events
              </h1>
              <p className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" />
                {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="h-10 px-4 rounded-xl bg-edu-navy text-white font-bold text-sm flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>

        {/* Stats banner */}
        <div className="rounded-2xl bg-gradient-to-br from-edu-pink to-edu-navy text-white p-4 shadow-md">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
            <Sparkles className="w-3 h-3" /> Overview
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Stat label="Upcoming" value={stats.upcoming} />
            <Stat label="This week" value={stats.thisWeek} />
            <Stat label="Yours" value={stats.mine} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-secondary rounded-xl p-1 gap-1">
          <TabBtn
            active={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
            label="Upcoming"
            count={upcoming.length}
          />
          <TabBtn
            active={tab === "past"}
            onClick={() => setTab("past")}
            label="Past"
            count={past.length}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Info banner */}
        <Card className="border-edu-light-blue bg-edu-light-blue/30">
          <CardContent className="p-3 text-[11px] text-foreground/80 flex items-start gap-2">
            <Users className="w-4 h-4 text-edu-blue shrink-0 mt-0.5" />
            <p>
              Events you add here go to <strong>parents of {primaryClass.name}</strong> only.
              School-wide and stage-wide events (visible below) come from the
              principal — those you can read but not edit.
            </p>
          </CardContent>
        </Card>

        {/* List */}
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading events…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            onCompose={openNew}
            hasEvents={events.length > 0}
            tab={tab}
          />
        ) : (
          <ul
            className={cn(
              isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
            )}
          >
            {filtered.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                myUid={myUid}
                onEdit={() => openEdit(e)}
                onDelete={() => handleDelete(e)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Composer dialog */}
      {dialogOpen && (
        <ComposerSheet
          form={form}
          setForm={setForm}
          editing={!!editingId}
          saving={saving}
          className={primaryClass.name}
          onClose={() => {
            if (saving) return;
            setDialogOpen(false);
            setEditingId(null);
            setForm(emptyForm());
          }}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-white/70 mt-1">
        {label}
      </p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition",
        active ? "bg-white text-edu-navy shadow-sm" : "text-muted-foreground"
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "px-1.5 rounded-full text-[10px] font-black leading-none py-0.5",
            active ? "bg-edu-light-blue text-edu-blue" : "bg-white"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EventCard({
  event,
  myUid,
  onEdit,
  onDelete,
}: {
  event: EventRow;
  myUid?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = parseISO(event.startDate);
  const end = event.endDate ? parseISO(event.endDate) : null;
  const multiDay = end && event.endDate && event.endDate !== event.startDate;
  const typeMeta = TYPES.find((t) => t.key === event.type) || TYPES[0];
  const daysOut = differenceInCalendarDays(start, new Date());
  const mine = event.createdBy === myUid;

  let timeStr = "";
  if (event.allDay) timeStr = "All day";
  else if (event.startTime && event.endTime) timeStr = `${event.startTime} – ${event.endTime}`;
  else if (event.startTime) timeStr = event.startTime;

  return (
    <li
      className={cn(
        "rounded-2xl border-2 p-4 bg-white transition",
        mine ? "border-edu-blue/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Date block */}
        <div className="shrink-0 text-center rounded-xl bg-edu-light-blue/30 border border-edu-blue/20 px-2 py-1.5 min-w-[52px]">
          <p className="text-[9px] uppercase font-black tracking-widest text-edu-blue">
            {format(start, "MMM")}
          </p>
          <p className="text-xl font-black text-edu-navy leading-none mt-0.5">
            {format(start, "d")}
          </p>
          {multiDay && (
            <p className="text-[9px] font-bold text-muted-foreground mt-0.5">
              –{format(end!, "d")}
            </p>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none mt-0.5">
              {typeMeta.emoji}
            </span>
            <p className="font-black text-edu-navy text-sm leading-tight flex-1">
              {event.title}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {typeMeta.label}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span
              className={cn(
                "text-[10px] font-bold rounded px-1.5 py-0.5",
                event.audience === "class"
                  ? "bg-edu-light-blue text-edu-blue"
                  : event.audience === "stage"
                  ? "bg-edu-light-green text-edu-green"
                  : "bg-edu-light-pink text-edu-pink"
              )}
            >
              {event.audience === "class"
                ? "Your class"
                : event.audience === "stage"
                ? "Pre-Primary"
                : "School-wide"}
            </span>
            {daysOut >= 0 && daysOut <= 7 && (
              <span className="text-[10px] font-bold text-edu-blue bg-edu-light-blue px-1.5 py-0.5 rounded">
                {daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `In ${daysOut}d`}
              </span>
            )}
          </div>

          {event.description && (
            <p className="text-xs text-foreground/80 leading-relaxed mt-2 whitespace-pre-wrap line-clamp-3">
              {event.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {timeStr && (
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeStr}
              </span>
            )}
            {event.location && (
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {event.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
        <span className="font-semibold">
          {mine ? (
            <span className="text-edu-blue">By you</span>
          ) : (
            <>By {event.createdByName || "Principal"}</>
          )}
        </span>
        {mine && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-7 h-7 rounded-lg hover:bg-edu-light-red flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 text-edu-red" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyState({
  onCompose,
  hasEvents,
  tab,
}: {
  onCompose: () => void;
  hasEvents: boolean;
  tab: "upcoming" | "past";
}) {
  return (
    <Card>
      <CardContent className="p-10 text-center">
        <p className="text-5xl mb-3">📅</p>
        <p className="text-base font-black text-edu-navy">
          {!hasEvents
            ? "No class events yet"
            : tab === "upcoming"
            ? "Nothing upcoming"
            : "No past events"}
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
          {!hasEvents
            ? "Add your first event — parents see it instantly in their Calendar."
            : tab === "upcoming"
            ? "Add an event to give parents a heads-up about what's coming."
            : "Past events will show here once they happen."}
        </p>
        {!hasEvents && (
          <button
            type="button"
            onClick={onCompose}
            className="mt-4 h-10 px-5 rounded-xl bg-edu-navy text-white font-bold text-sm inline-flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add first event
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function ComposerSheet({
  form,
  setForm,
  editing,
  saving,
  className,
  onClose,
  onSave,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  saving: boolean;
  className: string;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-white shadow-2xl overflow-y-auto",
          "w-full max-w-md max-h-[92vh]",
          "rounded-t-3xl lg:rounded-2xl lg:max-w-lg",
          "animate-slide-up lg:animate-fade-in"
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="lg:hidden w-12 h-1.5 bg-border rounded-full mx-auto mt-2.5 mb-1" />

        <div className="px-5 pt-3 pb-2 flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-edu-navy">
              {editing ? "Edit Event" : "New Event"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Shows on <strong>{className}</strong> parents' Calendar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 mt-3 space-y-4">
          {/* Title */}
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Annual Day rehearsal"
              maxLength={120}
            />
          </Field>

          {/* Type */}
          <Field label="Type">
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.key })}
                  className={cn(
                    "rounded-xl border-2 p-2 text-center transition active:scale-95",
                    form.type === t.key
                      ? "border-edu-navy bg-edu-navy/5"
                      : "border-border hover:border-foreground/30"
                  )}
                >
                  <div className="text-lg leading-none">{t.emoji}</div>
                  <div className="text-[9px] font-bold mt-0.5 text-muted-foreground uppercase tracking-wider">
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </Field>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End date (optional)">
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                min={form.startDate}
              />
            </Field>
          </div>

          {/* All-day toggle + times */}
          <label className="flex items-center gap-2 rounded-xl border border-border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-edu-navy">All-day event</p>
              <p className="text-[10px] text-muted-foreground">
                Uncheck to set specific times
              </p>
            </div>
          </label>
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time">
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </Field>
              <Field label="End time">
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </Field>
            </div>
          )}

          {/* Location */}
          <Field label="Location (optional)">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Playground, Main Hall, Park entrance"
              maxLength={100}
            />
          </Field>

          {/* Description */}
          <Field label="Description (optional)">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What parents need to know — what to pack, dress code, drop-off plans"
              rows={3}
              maxLength={1000}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
            />
          </Field>
        </div>

        <div className="px-5 mt-5 pb-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 px-4 rounded-xl border border-border text-sm font-bold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-10 px-5 rounded-xl bg-edu-navy text-white font-bold text-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editing ? (
              "Save changes"
            ) : (
              "Add to Calendar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}

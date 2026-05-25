/**
 * Events.tsx — Pre-primary teacher's class-scoped calendar composer.
 * Cartoonified 2026-05-25. Writes to pp_events with audience='class' +
 * classId forced. Teacher sees school/stage/own-class events but can only
 * edit/delete events they created.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Users,
  Search,
  X,
  MapPin,
  Clock,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
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
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useIsDesktop } from "@/hooks/useIsDesktop";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · CLASS EVENTS
   Storybook-sherbet calendar composer. Sherbet surface per event type,
   tappable date block per card, mine-only edit/delete actions.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const MINT = "#10B981";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";
const LAV = "#A78BFA";
const BUTTER = "#F59E0B";
const RED = "#EF4444";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

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

const TYPE_TONE: Record<EventType, { tone: string; surface: string }> = {
  celebration: {
    tone: BLUSH,
    surface: "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)",
  },
  ptm: {
    tone: SKY,
    surface: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
  },
  trip: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
  },
  exam: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
  },
  general: {
    tone: NAVY,
    surface: "linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)",
  },
  holiday: {
    tone: RED,
    surface: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
  },
};

const AUDIENCE_META: Record<Audience, { tone: string; label: string; emoji: string }> = {
  school: { tone: BLUSH, label: "School-wide", emoji: "🏫" },
  stage: { tone: MINT, label: "Pre-Primary", emoji: "🌱" },
  class: { tone: SKY, label: "Your class", emoji: "👶" },
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

  useEffect(() => {
    if (!dialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogOpen]);

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
    if (
      !form.allDay &&
      form.startTime &&
      form.endTime &&
      form.endTime <= form.startTime
    ) {
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
    if (
      !window.confirm(
        `Delete "${e.title}"? Parents stop seeing it immediately.`
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "pp_events", e.id));
      toast.success("Event deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not delete: ${msg.slice(0, 120)}`);
    }
  };

  if (classLoading) return <CenteredLoader label="Resolving your class…" />;
  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
      </div>
    );
  }

  const cardCols = isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr";

  return (
    <>
      <div
        className="animate-fade-in"
        style={{
          padding: isDesktop ? "24px 28px 80px" : "16px 16px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
        }}
      >
        {/* Hero */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: isDesktop ? "22px 26px" : "18px 18px",
            background:
              "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 55%, #FFFFFF 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={BLUSH} dense />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: `0 8px 18px ${BLUSH}55`,
                transform: "rotate(-8deg)",
                flexShrink: 0,
              }}
              aria-hidden
            >
              🎉
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: BLUSH,
                  opacity: 0.9,
                }}
              >
                Class calendar
              </p>
              <h1
                style={{
                  fontSize: isDesktop ? 26 : 21,
                  fontWeight: 800,
                  letterSpacing: "-0.6px",
                  color: NAVY,
                  marginTop: 2,
                }}
              >
                Class Events{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  📅
                </span>
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? 13 : 12,
                  fontWeight: 500,
                  color: "#64748B",
                  marginTop: 4,
                }}
              >
                {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
              </p>
            </div>
            <button
              type="button"
              onClick={openNew}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 18px",
                borderRadius: 16,
                background: `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                boxShadow: `0 10px 24px -8px ${BLUSH}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <Plus size={16} strokeWidth={2.6} />
              {isDesktop ? "New Event" : "New"}
            </button>
          </div>
        </div>

        {/* 3-stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <CounterCard
            label="Upcoming"
            value={stats.upcoming}
            emoji="📅"
            tone={SKY}
            surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          />
          <CounterCard
            label="This week"
            value={stats.thisWeek}
            emoji="⚡"
            tone={stats.thisWeek > 0 ? BUTTER : "#94A3B8"}
            surface={
              stats.thisWeek > 0
                ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
                : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
            }
          />
          <CounterCard
            label="Yours"
            value={stats.mine}
            emoji="✍️"
            tone={BLUSH}
            surface="linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
          />
        </div>

        {/* Tab toggle */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            padding: 4,
            borderRadius: 16,
            background: "#F1F5F9",
          }}
        >
          <TabBtn
            active={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
            label="Upcoming"
            count={upcoming.length}
            tone={SKY}
          />
          <TabBtn
            active={tab === "past"}
            onClick={() => setTab("past")}
            label="Past"
            count={past.length}
            tone="#94A3B8"
          />
        </div>

        {/* Search */}
        <SearchPillow value={search} onChange={setSearch} />

        {/* Info banner */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            padding: "12px 14px",
            background: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
            boxShadow: PILLOW,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <DotScribbles color={SKY} />
          <span
            style={{
              position: "relative",
              zIndex: 1,
              width: 32,
              height: 32,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transform: "rotate(-6deg)",
              boxShadow: `0 6px 14px ${SKY}55`,
            }}
            aria-hidden
          >
            <Users size={15} strokeWidth={2.4} />
          </span>
          <p
            style={{
              position: "relative",
              zIndex: 1,
              fontSize: 12,
              fontWeight: 600,
              color: "#0F172A",
              lineHeight: 1.5,
            }}
          >
            Events you add go to{" "}
            <strong style={{ color: SKY }}>parents of {primaryClass.name}</strong>{" "}
            only. School + stage events below are from the principal — read-only.
          </p>
        </div>

        {/* List */}
        {loading ? (
          <CenteredLoader label="Loading events…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasEvents={events.length > 0}
            tab={tab}
            onCompose={openNew}
          />
        ) : (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: cardCols,
              gap: 12,
              padding: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {filtered.map((e) => (
              <li key={e.id}>
                <EventCard
                  event={e}
                  myUid={myUid}
                  onEdit={() => openEdit(e)}
                  onDelete={() => handleDelete(e)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialogOpen && (
        <ComposerSheet
          isDesktop={isDesktop}
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

/* ═══════════════════════ building blocks ═══════════════════════ */

function CenteredLoader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "48px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        color: "#64748B",
      }}
    >
      <Loader2 className="animate-spin" />
      <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

function CounterCard({
  label,
  value,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
  emoji: string;
  tone: string;
  surface: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "12px 12px 10px",
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-1.2px",
            color: tone,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 20,
            lineHeight: 1,
            transform: "rotate(8deg)",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))",
          }}
          aria-hidden
        >
          {emoji}
        </span>
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: tone,
          opacity: 0.75,
          marginTop: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
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
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: active ? "#fff" : "transparent",
        color: active ? NAVY : "#64748B",
        fontSize: 12,
        fontWeight: 800,
        border: "none",
        cursor: "pointer",
        boxShadow: active ? "0 2px 8px rgba(15,23,42,0.08)" : "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all 160ms ease",
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            padding: "2px 7px",
            borderRadius: 999,
            background: active ? `${tone}1f` : "#fff",
            color: active ? tone : "#64748B",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SearchPillow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
        padding: "4px 4px 4px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Search size={16} color="#94A3B8" strokeWidth={2.4} />
      <input
        placeholder="Search events…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 14,
          fontWeight: 600,
          color: "#0F172A",
          padding: "12px 8px",
          minWidth: 0,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "#F1F5F9",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          <X size={14} color="#64748B" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

function EmptyState({
  hasEvents,
  tab,
  onCompose,
}: {
  hasEvents: boolean;
  tab: "upcoming" | "past";
  onCompose: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 16px",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <p style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>
        {!hasEvents ? "📅" : tab === "upcoming" ? "🌤️" : "📚"}
      </p>
      <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>
        {!hasEvents
          ? "No class events yet"
          : tab === "upcoming"
          ? "Nothing upcoming"
          : "No past events"}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "#64748B",
          marginTop: 6,
          maxWidth: 280,
          margin: "6px auto 0",
          lineHeight: 1.5,
        }}
      >
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
          style={{
            marginTop: 14,
            padding: "10px 18px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 8px 18px -6px ${BLUSH}88`,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          <Plus size={14} strokeWidth={2.6} />
          Add first event
        </button>
      )}
    </div>
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
  const multiDay = !!(end && event.endDate && event.endDate !== event.startDate);
  const typeMeta = TYPES.find((t) => t.key === event.type) || TYPES[0];
  const tt = TYPE_TONE[event.type];
  const audMeta = AUDIENCE_META[event.audience];
  const daysOut = differenceInCalendarDays(start, new Date());
  const mine = event.createdBy === myUid;

  let timeStr = "";
  if (event.allDay) timeStr = "All day";
  else if (event.startTime && event.endTime)
    timeStr = `${event.startTime} – ${event.endTime}`;
  else if (event.startTime) timeStr = event.startTime;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: tt.surface,
        boxShadow: PILLOW,
        borderLeft: `5px solid ${tt.tone}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <DotScribbles color={tt.tone} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        {/* Date block */}
        <div
          style={{
            flexShrink: 0,
            minWidth: 56,
            textAlign: "center",
            borderRadius: 14,
            padding: "8px 6px",
            background: "#fff",
            boxShadow: `inset 0 0 0 1px ${tt.tone}33, 0 4px 10px ${tt.tone}1f`,
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: tt.tone,
            }}
          >
            {format(start, "MMM")}
          </p>
          <p
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: NAVY,
              lineHeight: 1,
              marginTop: 2,
              letterSpacing: "-1px",
            }}
          >
            {format(start, "d")}
          </p>
          {multiDay && end && (
            <p
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#64748B",
                marginTop: 2,
              }}
            >
              –{format(end, "d")}
            </p>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <span
              aria-hidden
              style={{
                fontSize: 18,
                transform: "rotate(-6deg)",
                display: "inline-block",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {typeMeta.emoji}
            </span>
            <p
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.2px",
                flex: 1,
                lineHeight: 1.25,
              }}
            >
              {event.title}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 8,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: `linear-gradient(135deg, ${tt.tone}, ${tt.tone}cc)`,
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `0 3px 8px ${tt.tone}44`,
              }}
            >
              {typeMeta.label}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: audMeta.tone,
                background: "#fff",
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `inset 0 0 0 1px ${audMeta.tone}55`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {audMeta.emoji} {audMeta.label}
            </span>
            {daysOut >= 0 && daysOut <= 7 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
                  padding: "3px 8px",
                  borderRadius: 999,
                  boxShadow: `0 3px 8px ${BUTTER}44`,
                  transform: "rotate(2deg)",
                }}
              >
                {daysOut === 0
                  ? "🔥 Today"
                  : daysOut === 1
                  ? "Tomorrow"
                  : `In ${daysOut}d`}
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <p
              style={{
                fontSize: 12,
                color: "#0F172A",
                lineHeight: 1.55,
                marginTop: 8,
                whiteSpace: "pre-wrap",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {event.description}
            </p>
          )}

          {/* Time + location */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            {timeStr && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748B",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Clock size={11} strokeWidth={2.4} />
                {timeStr}
              </span>
            )}
            {event.location && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748B",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MapPin size={11} strokeWidth={2.4} />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          paddingTop: 8,
          borderTop: "1px dashed rgba(15,23,42,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B" }}>
          {mine ? (
            <span style={{ color: BLUSH }}>✍️ By you</span>
          ) : (
            <>— {event.createdByName || "Principal"}</>
          )}
        </span>
        {mine && (
          <div style={{ display: "flex", gap: 4 }}>
            <IconButton tone={SKY} onClick={onEdit} title="Edit">
              <Pencil size={13} strokeWidth={2.4} />
            </IconButton>
            <IconButton tone={RED} onClick={onDelete} title="Delete">
              <Trash2 size={13} strokeWidth={2.4} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  tone,
  onClick,
  title,
  children,
}: {
  tone: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        background: "#fff",
        color: tone,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: `inset 0 0 0 1px ${tone}33`,
      }}
      className="active:scale-90 hover:-translate-y-0.5 transition"
    >
      {children}
    </button>
  );
}

/* ═══════════════════════ Composer sheet ═══════════════════════ */

function ComposerSheet({
  isDesktop,
  form,
  setForm,
  editing,
  saving,
  className,
  onClose,
  onSave,
}: {
  isDesktop: boolean;
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
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
        animation: "fade-in 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isDesktop ? 560 : 480,
          maxHeight: isDesktop ? "92vh" : "94vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #FFF4F8 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: isDesktop ? 28 : "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
          position: "relative",
          margin: isDesktop ? "0 16px" : 0,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(255,244,248,0.95) 0%, rgba(255,255,255,0.85) 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: isDesktop ? "16px 22px 14px" : "10px 18px 12px",
            borderRadius: isDesktop ? "28px 28px 0 0" : "28px 28px 0 0",
            zIndex: 10,
          }}
        >
          {!isDesktop && (
            <div
              style={{
                width: 48,
                height: 5,
                borderRadius: 999,
                background: "#E2E8F0",
                margin: "0 auto 12px",
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: BLUSH,
                  opacity: 0.85,
                }}
              >
                {editing ? "Edit event" : "New event"}
              </p>
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: NAVY,
                  marginTop: 2,
                  letterSpacing: "-0.4px",
                }}
              >
                {editing ? "Update Event" : "Compose Event"}{" "}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    transform: "rotate(-6deg)",
                  }}
                >
                  🎉
                </span>
              </p>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748B",
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CalendarIcon size={11} strokeWidth={2.4} />
                Shows on <strong style={{ color: BLUSH }}>{className}</strong>{" "}
                parents' Calendar
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "#F1F5F9",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} color="#64748B" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div
          style={{
            padding: isDesktop ? "16px 22px 24px" : "12px 18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Title */}
          <div>
            <FieldLabel emoji="🏷️">Title</FieldLabel>
            <PillowInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="e.g. Annual Day rehearsal"
              maxLength={120}
            />
          </div>

          {/* Type tiles */}
          <div>
            <FieldLabel emoji="🎯">Type</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {TYPES.map((t) => {
                const tt = TYPE_TONE[t.key];
                const selected = form.type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm({ ...form, type: t.key })}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "12px 6px",
                      borderRadius: 16,
                      background: selected ? tt.surface : "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${tt.tone}, ${PILLOW}`
                        : PILLOW,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-95"
                  >
                    <span
                      style={{
                        fontSize: 22,
                        transform: selected ? "rotate(-8deg)" : "none",
                        transition: "transform 200ms ease",
                      }}
                      aria-hidden
                    >
                      {t.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        color: selected ? tt.tone : "#475569",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <FieldLabel emoji="📅">Start date</FieldLabel>
              <PillowInput
                type="date"
                value={form.startDate}
                onChange={(v) => setForm({ ...form, startDate: v })}
              />
            </div>
            <div>
              <FieldLabel emoji="🏁">End date (opt)</FieldLabel>
              <PillowInput
                type="date"
                value={form.endDate}
                onChange={(v) => setForm({ ...form, endDate: v })}
                min={form.startDate}
              />
            </div>
          </div>

          {/* All-day toggle */}
          <label
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 16,
              background: form.allDay
                ? "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
                : "#fff",
              boxShadow: form.allDay
                ? `inset 0 0 0 2px ${SKY}, ${PILLOW}`
                : PILLOW,
              cursor: "pointer",
            }}
          >
            {form.allDay && <DotScribbles color={SKY} />}
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              style={{
                width: 16,
                height: 16,
                accentColor: SKY,
                cursor: "pointer",
                position: "relative",
                zIndex: 1,
              }}
            />
            <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: form.allDay ? SKY : NAVY,
                }}
              >
                🌞 All-day event
              </p>
              <p style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                Uncheck to set specific start/end times
              </p>
            </div>
          </label>

          {/* Times (only when not all-day) */}
          {!form.allDay && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <FieldLabel emoji="🕐">Start time</FieldLabel>
                <PillowInput
                  type="time"
                  value={form.startTime}
                  onChange={(v) => setForm({ ...form, startTime: v })}
                />
              </div>
              <div>
                <FieldLabel emoji="🕔">End time</FieldLabel>
                <PillowInput
                  type="time"
                  value={form.endTime}
                  onChange={(v) => setForm({ ...form, endTime: v })}
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <FieldLabel emoji="📍">Location (optional)</FieldLabel>
            <PillowInput
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
              placeholder="e.g. Playground, Main Hall, Park entrance"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <FieldLabel emoji="📝">Description (optional)</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What parents need to know — what to pack, dress code, drop-off plans"
              rows={3}
              maxLength={1000}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 16,
                background: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                color: "#0F172A",
                outline: "none",
                resize: "none",
                boxShadow: PILLOW,
                fontFamily: "inherit",
                lineHeight: 1.55,
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "12px 18px",
                borderRadius: 16,
                background: "#fff",
                color: "#64748B",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: saving ? "default" : "pointer",
                boxShadow: PILLOW,
                opacity: saving ? 0.6 : 1,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: 16,
                background: saving
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: saving ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: saving ? "none" : `0 10px 24px -6px ${BLUSH}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CalendarIcon size={14} strokeWidth={2.4} />
              )}
              {editing ? "Save changes" : "Add to Calendar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillowInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  min?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      type={type}
      min={min}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 16,
        background: "#fff",
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        color: "#0F172A",
        outline: "none",
        boxShadow: PILLOW,
      }}
    />
  );
}

function FieldLabel({
  emoji,
  children,
}: {
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {emoji && (
        <span
          aria-hidden
          style={{
            fontSize: 13,
            transform: "rotate(-6deg)",
            display: "inline-block",
          }}
        >
          {emoji}
        </span>
      )}
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: NAVY,
          opacity: 0.75,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function DotScribbles({
  color,
  dense = false,
}: {
  color: string;
  dense?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        opacity: dense ? 0.1 : 0.07,
        pointerEvents: "none",
      }}
    >
      <circle cx="14%" cy="24%" r="2.5" fill={color} />
      <circle cx="82%" cy="14%" r="1.8" fill={color} />
      <circle cx="68%" cy="62%" r="2" fill={color} />
      <circle cx="22%" cy="80%" r="1.6" fill={color} />
      <circle cx="48%" cy="32%" r="1.4" fill={color} />
      {dense && (
        <>
          <circle cx="90%" cy="80%" r="2.2" fill={color} />
          <circle cx="6%" cy="60%" r="1.4" fill={color} />
          <circle cx="55%" cy="88%" r="1.6" fill={color} />
        </>
      )}
    </svg>
  );
}

// Palette constants reserved for future variants on this page.
void LAV;

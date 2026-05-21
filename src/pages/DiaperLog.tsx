import { useMemo, useState } from "react";
import {
  Droplet,
  Loader2,
  Toilet,
  CheckCircle2,
  X,
  Undo2,
  Clock,
  Sparkles,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  usePPDiaperLogs,
  type DiaperType,
  type DiaperEntry,
  DIAPER_TYPE_LABEL,
  DIAPER_TYPE_EMOJI,
} from "@/hooks/usePPDiaperLogs";

const DIAPER_TYPES: DiaperType[] = [
  "wet",
  "soiled",
  "mixed",
  "dry_check",
  "washroom",
];

const TYPE_COLOR: Record<DiaperType, string> = {
  wet: "bg-edu-light-blue text-edu-blue border-edu-blue/30",
  soiled: "bg-edu-light-orange text-edu-orange border-edu-orange/40",
  mixed: "bg-edu-light-red text-edu-red border-edu-red/30",
  dry_check: "bg-edu-light-green text-edu-green border-edu-green/30",
  washroom: "bg-edu-light-yellow text-edu-yellow border-edu-yellow/40",
};

const minutesSince = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Math.max(0, Math.round((Date.now() - t) / 60000));
};

const sinceLabel = (mins: number): string => {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
};

interface ChildSummary {
  child: RosterChild;
  lastEntry: DiaperEntry | null;
  todayCount: number;
  minsSince: number | null;
}

export default function DiaperLog() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const {
    data,
    loading: logsLoading,
    addEntry,
    undoLast,
  } = usePPDiaperLogs(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyType, setBusyType] = useState<DiaperType | null>(null);

  const loading = classLoading || rosterLoading || logsLoading;

  const summaries: ChildSummary[] = useMemo(() => {
    const entries = data?.entries || [];
    const byChild = new Map<string, DiaperEntry[]>();
    for (const e of entries) {
      const arr = byChild.get(e.studentId) || [];
      arr.push(e);
      byChild.set(e.studentId, arr);
    }
    return roster.map((c) => {
      const arr = (byChild.get(c.id) || []).slice().sort((a, b) =>
        a.recordedAt < b.recordedAt ? 1 : -1
      );
      const last = arr[0] || null;
      return {
        child: c,
        lastEntry: last,
        todayCount: arr.length,
        minsSince: last ? minutesSince(last.recordedAt) : null,
      };
    });
  }, [data?.entries, roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.child.name.toLowerCase().includes(q));
  }, [summaries, search]);

  const stats = useMemo(() => {
    const total = data?.entries.length || 0;
    const uniqueKids = new Set((data?.entries || []).map((e) => e.studentId))
      .size;
    return { total, uniqueKids };
  }, [data?.entries]);

  const activeChild = filtered.find((s) => s.child.id === activeChildId);

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
        <p className="text-xs text-muted-foreground mt-1">
          Contact your principal to be added to a class.
        </p>
      </div>
    );
  }

  if (loading && roster.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading diaper log…</p>
      </div>
    );
  }

  const handleQuickLog = async (
    child: RosterChild,
    type: DiaperType,
    closeSheet?: boolean
  ) => {
    setBusyType(type);
    try {
      await addEntry({
        studentId: child.id,
        studentName: child.name,
        type,
        note: note.trim() || undefined,
      });
      toast.success(
        `${DIAPER_TYPE_EMOJI[type]} ${DIAPER_TYPE_LABEL[type]} logged for ${child.name.split(" ")[0]}`
      );
      setNote("");
      if (closeSheet) setActiveChildId(null);
    } catch (err) {
      console.error("[DiaperLog] addEntry failed:", err);
      toast.error("Could not save. Check connection.");
    } finally {
      setBusyType(null);
    }
  };

  const handleUndo = async (child: RosterChild) => {
    try {
      await undoLast(child.id);
      toast.message(`Removed last entry for ${child.name.split(" ")[0]}`);
    } catch (err) {
      console.error("[DiaperLog] undoLast failed:", err);
      toast.error("Could not undo.");
    }
  };

  const sharedHeader = (
    <div className="flex items-baseline justify-between pt-1">
      <div>
        <p className="text-xs text-muted-foreground font-semibold">
          {format(new Date(), "EEEE, d MMM")} · {primaryClass.name}
        </p>
        <h1
          className={cn(
            "font-black text-edu-navy mt-0.5",
            isDesktop ? "text-2xl" : "text-xl"
          )}
        >
          Diaper &amp; Washroom 🚼
        </h1>
      </div>
    </div>
  );

  const statsBanner = (
    <div className="rounded-2xl bg-gradient-to-br from-edu-blue to-edu-navy text-white p-4 shadow-md">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
        <Sparkles className="w-3 h-3" />
        Today
      </div>
      <div className="flex items-baseline gap-6 mt-1">
        <div>
          <p className="text-3xl font-black leading-none">{stats.total}</p>
          <p className="text-[11px] text-white/80 mt-0.5">entries logged</p>
        </div>
        <div>
          <p className="text-3xl font-black leading-none">
            {stats.uniqueKids}/{roster.length || "—"}
          </p>
          <p className="text-[11px] text-white/80 mt-0.5">children changed</p>
        </div>
      </div>
    </div>
  );

  const searchBar = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search a child…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-9"
      />
    </div>
  );

  if (isDesktop) {
    return (
      <DesktopLayout
        header={sharedHeader}
        stats={statsBanner}
        search={searchBar}
        summaries={filtered}
        allEntries={data?.entries || []}
        onLog={handleQuickLog}
        onUndo={handleUndo}
        busyType={busyType}
      />
    );
  }

  return (
    <>
      <MobileLayout
        header={sharedHeader}
        stats={statsBanner}
        search={searchBar}
        summaries={filtered}
        onOpen={(id) => setActiveChildId(id)}
      />
      {activeChild && (
        <ChildActionSheet
          summary={activeChild}
          note={note}
          onNoteChange={setNote}
          busyType={busyType}
          onLog={(type) => handleQuickLog(activeChild.child, type, true)}
          onUndo={() => handleUndo(activeChild.child)}
          onClose={() => {
            setActiveChildId(null);
            setNote("");
          }}
        />
      )}
    </>
  );
}

// ─── Mobile Layout ────────────────────────────────────────────────────────
function MobileLayout({
  header,
  stats,
  search,
  summaries,
  onOpen,
}: {
  header: React.ReactNode;
  stats: React.ReactNode;
  search: React.ReactNode;
  summaries: ChildSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      {header}
      {stats}
      {search}

      {summaries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-xs text-muted-foreground">
            No children match.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {summaries.map((s) => (
            <li key={s.child.id}>
              <button
                type="button"
                onClick={() => onOpen(s.child.id)}
                className="w-full text-left active:scale-[0.99] transition"
              >
                <ChildRowCard summary={s} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChildRowCard({ summary }: { summary: ChildSummary }) {
  const { child, lastEntry, todayCount, minsSince } = summary;
  const overdue =
    minsSince === null ? false : minsSince > 180; // 3hr threshold

  return (
    <Card
      className={cn(
        "border transition",
        overdue && "border-edu-orange/60 bg-edu-light-orange/30",
        !overdue && lastEntry && "border-border",
        !lastEntry && "border-dashed border-border"
      )}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <Avatar name={child.name} photoURL={child.photoURL} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-edu-navy truncate">
            {child.name}
          </p>
          {lastEntry ? (
            <p className="text-[11px] text-muted-foreground truncate">
              {DIAPER_TYPE_EMOJI[lastEntry.type]}{" "}
              {DIAPER_TYPE_LABEL[lastEntry.type]} · {sinceLabel(minsSince ?? 0)}
              {todayCount > 1 && ` · ${todayCount}x today`}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Not logged yet today
            </p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-edu-blue">
          Log
        </span>
      </CardContent>
    </Card>
  );
}

function ChildActionSheet({
  summary,
  note,
  onNoteChange,
  busyType,
  onLog,
  onUndo,
  onClose,
}: {
  summary: ChildSummary;
  note: string;
  onNoteChange: (v: string) => void;
  busyType: DiaperType | null;
  onLog: (type: DiaperType) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const { child, lastEntry, todayCount } = summary;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-2 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={child.name} photoURL={child.photoURL} size="lg" />
            <div className="min-w-0">
              <p className="text-lg font-black text-edu-navy truncate">
                {child.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {todayCount} entries today
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-secondary/50 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {lastEntry && (
          <div className="mx-5 mt-2 rounded-xl bg-secondary/50 p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-foreground/80 flex-1">
              Last: {DIAPER_TYPE_EMOJI[lastEntry.type]}{" "}
              {DIAPER_TYPE_LABEL[lastEntry.type]} at {lastEntry.time}
              {lastEntry.note && ` · "${lastEntry.note}"`}
            </p>
            <button
              type="button"
              onClick={onUndo}
              className="text-[11px] font-bold text-edu-red flex items-center gap-1"
            >
              <Undo2 className="w-3 h-3" />
              Undo
            </button>
          </div>
        )}

        <div className="px-5 mt-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
            Quick log
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DIAPER_TYPES.map((t) => (
              <TypeButton
                key={t}
                type={t}
                busy={busyType === t}
                onClick={() => onLog(t)}
              />
            ))}
          </div>
        </div>

        <div className="px-5 mt-4 pb-5">
          <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Anything to flag for parent?"
            rows={2}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Tip: rashes, leakage, or signs of discomfort.
          </p>
        </div>
      </div>
    </div>
  );
}

function TypeButton({
  type,
  busy,
  onClick,
}: {
  type: DiaperType;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 font-bold text-xs active:scale-95 transition disabled:opacity-50",
        TYPE_COLOR[type]
      )}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span className="text-xl leading-none">{DIAPER_TYPE_EMOJI[type]}</span>
      )}
      <span>{DIAPER_TYPE_LABEL[type]}</span>
    </button>
  );
}

// ─── Desktop Layout ───────────────────────────────────────────────────────
function DesktopLayout({
  header,
  stats,
  search,
  summaries,
  allEntries,
  onLog,
  onUndo,
  busyType,
}: {
  header: React.ReactNode;
  stats: React.ReactNode;
  search: React.ReactNode;
  summaries: ChildSummary[];
  allEntries: DiaperEntry[];
  onLog: (
    child: RosterChild,
    type: DiaperType,
    closeSheet?: boolean
  ) => Promise<void>;
  onUndo: (child: RosterChild) => Promise<void>;
  busyType: DiaperType | null;
}) {
  const sortedEntries = useMemo(
    () =>
      [...allEntries].sort((a, b) =>
        a.recordedAt < b.recordedAt ? 1 : -1
      ),
    [allEntries]
  );

  return (
    <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">{header}</div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">{stats}</div>
        <div>{search}</div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          {summaries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No children match.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {summaries.map((s) => (
                <DesktopChildCard
                  key={s.child.id}
                  summary={s}
                  busyType={busyType}
                  onLog={(t) => onLog(s.child, t, false)}
                  onUndo={() => onUndo(s.child)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-2">
          <h2 className="text-sm font-bold text-edu-navy mb-2">
            Today's Timeline
          </h2>
          {sortedEntries.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                No entries yet.
              </CardContent>
            </Card>
          ) : (
            <ol className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
              {sortedEntries.map((e) => (
                <li key={e.id}>
                  <Card>
                    <CardContent className="p-2.5 flex items-center gap-2">
                      <span className="text-lg">
                        {DIAPER_TYPE_EMOJI[e.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-edu-navy truncate">
                          {e.studentName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {DIAPER_TYPE_LABEL[e.type]} · {e.time}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

function DesktopChildCard({
  summary,
  busyType,
  onLog,
  onUndo,
}: {
  summary: ChildSummary;
  busyType: DiaperType | null;
  onLog: (type: DiaperType) => void;
  onUndo: () => void;
}) {
  const { child, lastEntry, todayCount, minsSince } = summary;
  const overdue = minsSince === null ? false : minsSince > 180;

  return (
    <Card
      className={cn(
        "border transition",
        overdue && "border-edu-orange/60 bg-edu-light-orange/30"
      )}
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar name={child.name} photoURL={child.photoURL} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-edu-navy truncate">
              {child.name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {lastEntry
                ? `${DIAPER_TYPE_EMOJI[lastEntry.type]} ${sinceLabel(minsSince ?? 0)} · ${todayCount}x today`
                : "Not logged yet"}
            </p>
          </div>
          {lastEntry && (
            <button
              type="button"
              onClick={onUndo}
              title="Undo last entry"
              className="text-muted-foreground hover:text-edu-red w-7 h-7 rounded-lg hover:bg-edu-light-red/40 flex items-center justify-center"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {DIAPER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={busyType !== null}
              onClick={() => onLog(t)}
              title={DIAPER_TYPE_LABEL[t]}
              className={cn(
                "h-10 rounded-lg border-2 flex items-center justify-center text-base font-bold transition active:scale-95 disabled:opacity-50",
                TYPE_COLOR[t]
              )}
            >
              {busyType === t ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                DIAPER_TYPE_EMOJI[t]
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────
function Avatar({
  name,
  photoURL,
  size = "md",
}: {
  name: string;
  photoURL?: string;
  size?: "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dim = size === "lg" ? "w-12 h-12" : "w-10 h-10";
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={cn(dim, "rounded-xl object-cover")}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        "rounded-xl bg-edu-light-blue text-edu-blue flex items-center justify-center font-black text-sm"
      )}
    >
      {initials}
    </div>
  );
}

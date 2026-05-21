import { useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  X,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  usePPBehaviorNotes,
  type BehaviorTier,
  type BehaviorType,
  BEHAVIOR_TIER_LABEL,
  BEHAVIOR_TYPE_LABEL,
  BEHAVIOR_TYPE_COLOR,
} from "@/hooks/usePPBehaviorNotes";

const TIERS: BehaviorTier[] = ["teacher_only", "principal", "parent"];
const TYPES: BehaviorType[] = ["positive", "neutral", "concern"];

const TIER_ICON: Record<BehaviorTier, React.ComponentType<{ className?: string }>> =
  {
    teacher_only: Lock,
    principal: EyeOff,
    parent: Eye,
  };

const TIER_COLOR: Record<BehaviorTier, string> = {
  teacher_only: "text-muted-foreground",
  principal: "text-edu-yellow",
  parent: "text-edu-green",
};

const TYPE_EMOJI: Record<BehaviorType, string> = {
  positive: "🌟",
  neutral: "📝",
  concern: "⚠️",
};

export default function BehaviorNotes() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { notes, loading: notesLoading, addNote } = usePPBehaviorNotes(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [filterChild, setFilterChild] = useState<string>("");
  const [filterTier, setFilterTier] = useState<BehaviorTier | "">("");
  const [dialog, setDialog] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [content, setContent] = useState("");
  const [tier, setTier] = useState<BehaviorTier>("parent");
  const [type, setType] = useState<BehaviorType>("positive");
  const [saving, setSaving] = useState(false);

  const loading = classLoading || notesLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterChild && n.studentId !== filterChild) return false;
      if (filterTier && n.tier !== filterTier) return false;
      if (q) {
        const hay = `${n.studentName} ${n.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, search, filterChild, filterTier]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: notes.length,
      today: notes.filter((n) => n.date === today).length,
      positive: notes.filter((n) => n.type === "positive").length,
      concern: notes.filter((n) => n.type === "concern").length,
    };
  }, [notes]);

  if (classLoading) {
    return (
      <div className="px-4 py-12 flex flex-col items-center gap-3 text-muted-foreground">
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

  if (loading && notes.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading notes…</p>
      </div>
    );
  }

  const openAdd = (preChildId?: string) => {
    setStudentId(preChildId || "");
    setContent("");
    setTier("parent");
    setType("positive");
    setDialog(true);
  };

  const submit = async () => {
    const child = roster.find((c) => c.id === studentId);
    if (!child) {
      toast.error("Pick a child");
      return;
    }
    if (content.trim().length < 5) {
      toast.error("Note is too short");
      return;
    }
    setSaving(true);
    try {
      await addNote({
        studentId: child.id,
        studentName: child.name,
        content,
        tier,
        type,
      });
      toast.success(`Note saved for ${child.name.split(" ")[0]}`);
      setDialog(false);
    } catch (e) {
      console.error("[BehaviorNotes] addNote:", e);
      toast.error("Could not save note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "py-4 space-y-4 animate-fade-in",
        isDesktop ? "px-6 lg:px-10 max-w-7xl mx-auto" : "px-4"
      )}
    >
      <div className="flex items-start justify-between gap-2 pt-1">
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
            Behavior Notes 📝
          </h1>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          className="h-10 px-4 rounded-xl bg-edu-navy text-white font-bold text-sm flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-4 h-4" /> {isDesktop && "New note"}
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-edu-blue to-edu-navy text-white p-4 shadow-md">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
          <Sparkles className="w-3 h-3" /> Observations
        </div>
        <div className="grid grid-cols-4 gap-3 mt-2">
          <Stat label="Total" value={stats.total} />
          <Stat label="Today" value={stats.today} />
          <Stat label="Positive" value={stats.positive} good />
          <Stat label="Concern" value={stats.concern} warn={stats.concern > 0} />
        </div>
      </div>

      <div className={isDesktop ? "grid grid-cols-3 gap-3" : "grid grid-cols-1 gap-2"}>
        <div className={isDesktop ? "" : ""}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <select
          value={filterChild}
          onChange={(e) => setFilterChild(e.target.value)}
          className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground"
        >
          <option value="">All children</option>
          {roster.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value as BehaviorTier | "")}
          className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground"
        >
          <option value="">All visibility</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {BEHAVIOR_TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-sm font-bold text-edu-navy">No notes yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap the + button to record an observation about a child.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul
          className={cn(
            isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
          )}
        >
          {filtered.map((n) => {
            const TierIcon = TIER_ICON[n.tier];
            return (
              <li key={n.id}>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-edu-navy truncate">
                          {TYPE_EMOJI[n.type]} {n.studentName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(n.createdAt), "d MMM · h:mm a")} ·
                          by {n.createdByName || "Teacher"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-[10px] font-bold shrink-0",
                          TIER_COLOR[n.tier]
                        )}
                      >
                        <TierIcon className="w-3 h-3" />
                        {n.tier === "teacher_only"
                          ? "Teacher"
                          : n.tier === "principal"
                          ? "Principal"
                          : "Parent"}
                      </div>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {n.content}
                    </p>
                    <div
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        BEHAVIOR_TYPE_COLOR[n.type]
                      )}
                    >
                      {BEHAVIOR_TYPE_LABEL[n.type]}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => !saving && setDialog(false)}
        >
          <div
            className={cn(
              "w-full bg-white pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto animate-slide-up",
              isDesktop
                ? "max-w-lg rounded-3xl shadow-2xl"
                : "max-w-md rounded-t-3xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  New note
                </p>
                <p className="text-lg font-black text-edu-navy">
                  Behavior observation
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setDialog(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary/50 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 mt-3 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Child
                </label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground"
                >
                  <option value="">Choose a child…</option>
                  {roster.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "h-12 rounded-xl border-2 text-xs font-bold transition active:scale-95",
                        type === t
                          ? BEHAVIOR_TYPE_COLOR[t]
                          : "border-border text-foreground bg-white"
                      )}
                    >
                      <div className="text-lg leading-none">{TYPE_EMOJI[t]}</div>
                      <div className="mt-0.5">{BEHAVIOR_TYPE_LABEL[t]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Visibility
                </label>
                <div className="space-y-1.5">
                  {TIERS.map((t) => {
                    const TIcon = TIER_ICON[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTier(t)}
                        className={cn(
                          "w-full h-12 rounded-xl border-2 text-xs font-bold flex items-center justify-between px-3 transition active:scale-[0.99]",
                          tier === t
                            ? "border-edu-navy bg-edu-light-blue/30 text-edu-navy"
                            : "border-border text-foreground bg-white"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <TIcon className={cn("w-4 h-4", TIER_COLOR[t])} />
                          {BEHAVIOR_TIER_LABEL[t]}
                        </span>
                        {tier === t && (
                          <span className="text-[10px] font-black bg-edu-navy text-white px-2 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Observation
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="What did you observe? Be specific and behavior-focused."
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
                />
              </div>
            </div>

            <div className="px-5 mt-4 pb-5">
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="w-full h-12 rounded-xl bg-edu-navy text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
  good,
}: {
  label: string;
  value: number;
  warn?: boolean;
  good?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-2xl font-black leading-none",
          warn && "text-edu-yellow",
          good && "text-edu-green"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

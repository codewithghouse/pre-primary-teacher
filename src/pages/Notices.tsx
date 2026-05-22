/**
 * Notices.tsx — Pre-primary teacher's class-scoped notices composer.
 *
 * Teachers write to the same `pp_announcements` collection that the
 * pre-primary-parent-dashboard /announcements page subscribes to, BUT
 * scoped strictly to their assigned class (audience='class', classId =
 * primaryClass.id is FORCED — no audience picker on this surface).
 *
 * Mirrors the principal-dashboard's PreAnnouncements UX so the founder
 * has a single mental model. Distinct mobile + desktop layouts per
 * project policy.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Users,
  Search,
  X,
  Calendar as CalendarIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
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

// Minimal Label — this dashboard's shadcn setup doesn't ship the Radix
// Label primitive, so use a plain semantic <label> with the same look.
function Label({
  htmlFor,
  className,
  children,
}: {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-xs font-bold uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </label>
  );
}

const TYPES = [
  { key: "info", label: "Notice", emoji: "📣" },
  { key: "event", label: "Event", emoji: "🎉" },
  { key: "alert", label: "Important", emoji: "⚠️" },
  { key: "celebration", label: "Celebration", emoji: "🎊" },
  { key: "reminder", label: "Reminder", emoji: "🔔" },
] as const;

type NoticeType = (typeof TYPES)[number]["key"];
type Audience = "school" | "stage" | "class";

const TYPE_BG: Record<NoticeType, string> = {
  info: "bg-edu-light-blue text-edu-blue border-edu-blue/30",
  event: "bg-edu-light-pink text-edu-pink border-edu-pink/30",
  alert: "bg-edu-light-red text-edu-red border-edu-red/30",
  celebration: "bg-edu-light-yellow text-edu-yellow border-edu-yellow/30",
  reminder: "bg-edu-light-orange text-edu-orange border-edu-orange/30",
};

interface NoticeRow {
  id: string;
  schoolId: string;
  audience: Audience;
  classId?: string;
  className?: string;
  title: string;
  body: string;
  type: NoticeType;
  pinned?: boolean;
  publishedAt?: string;
  expiresAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdByRole?: "principal" | "teacher" | "owner";
}

interface FormState {
  title: string;
  body: string;
  type: NoticeType;
  pinned: boolean;
  expiresAt: string;
}

const emptyForm = (): FormState => ({
  title: "",
  body: "",
  type: "info",
  pinned: false,
  expiresAt: "",
});

export default function Notices() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const isDesktop = useIsDesktop();

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const schoolId = teacherData?.schoolId;
  const classId = primaryClass?.id;
  const myUid = teacherData?.id;

  // Subscription scoped to this teacher's class — pulls both notices THIS
  // teacher posted AND any notices the principal posted for this class.
  // Reads ALL school-wide notices in too because parents in this class see
  // them; teacher can preview what their parents are seeing.
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pp_announcements"),
      where("schoolId", "==", schoolId),
      orderBy("publishedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: NoticeRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          const audience = (data.audience as Audience) || "school";
          // Filter: school + stage + class-matching-my-class
          if (audience === "class" && data.classId !== classId) return;

          rows.push({
            id: d.id,
            schoolId: data.schoolId,
            audience,
            classId: data.classId,
            className: data.className,
            title: data.title || "",
            body: data.body || "",
            type: (data.type as NoticeType) || "info",
            pinned: Boolean(data.pinned),
            publishedAt:
              data.publishedAt instanceof Timestamp
                ? data.publishedAt.toDate().toISOString()
                : data.publishedAt,
            expiresAt:
              data.expiresAt instanceof Timestamp
                ? data.expiresAt.toDate().toISOString()
                : data.expiresAt,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            createdByRole: data.createdByRole,
          });
        });
        rows.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return (b.publishedAt || "").localeCompare(a.publishedAt || "");
        });
        setNotices(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[Notices] subscription:", err);
        toast.error(
          `Could not load notices: ${
            err instanceof Error ? err.message : err
          }`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [schoolId, classId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notices;
    return notices.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
    );
  }, [notices, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: notices.length,
      mine: notices.filter((n) => n.createdBy === myUid).length,
      pinned: notices.filter((n) => n.pinned).length,
      active: notices.filter(
        (n) => !n.expiresAt || new Date(n.expiresAt).getTime() > now
      ).length,
    };
  }, [notices, myUid]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (n: NoticeRow) => {
    if (n.createdBy !== myUid) {
      toast.error("You can only edit notices you posted");
      return;
    }
    setEditingId(n.id);
    setForm({
      title: n.title,
      body: n.body,
      type: n.type,
      pinned: !!n.pinned,
      expiresAt: n.expiresAt ? n.expiresAt.slice(0, 16) : "",
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
    if (form.body.trim().length < 5) {
      toast.error("Body too short");
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
        body: form.body.trim(),
        type: form.type,
        pinned: form.pinned,
        expiresAt: form.expiresAt
          ? Timestamp.fromDate(new Date(form.expiresAt))
          : undefined,
        createdBy: teacherData.id,
        createdByName: teacherData.name || teacherData.email || "Teacher",
        createdByRole: "teacher" as const,
      };
      if (editingId) {
        const ref = doc(db, "pp_announcements", editingId);
        await updateDoc(ref, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        toast.success("Notice updated");
      } else {
        await addDoc(collection(db, "pp_announcements"), {
          ...payload,
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        toast.success(
          `Posted to ${primaryClass?.name} parents — they'll see it live ✓`
        );
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (err) {
      console.error("[Notices] save:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save notice: ${msg.slice(0, 200)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (n: NoticeRow) => {
    if (n.createdBy !== myUid) {
      toast.error("You can only pin notices you posted");
      return;
    }
    try {
      await updateDoc(doc(db, "pp_announcements", n.id), {
        pinned: !n.pinned,
        updatedAt: serverTimestamp(),
      });
      toast.success(n.pinned ? "Unpinned" : "Pinned");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not update: ${msg.slice(0, 120)}`);
    }
  };

  const handleDelete = async (n: NoticeRow) => {
    if (n.createdBy !== myUid) {
      toast.error(
        "Only the principal can delete notices not posted by you. Ask them."
      );
      return;
    }
    if (!window.confirm(`Delete "${n.title}"? Parents stop seeing it immediately.`))
      return;
    try {
      await deleteDoc(doc(db, "pp_announcements", n.id));
      toast.success("Notice deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not delete: ${msg.slice(0, 120)}`);
    }
  };

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
                "rounded-xl bg-edu-light-blue text-edu-blue flex items-center justify-center",
                isDesktop ? "w-10 h-10" : "w-9 h-9"
              )}
            >
              <Megaphone className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
            </div>
            <div>
              <h1
                className={cn(
                  "font-black text-edu-navy leading-none",
                  isDesktop ? "text-2xl" : "text-xl"
                )}
              >
                Class Notices
              </h1>
              <p className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" />
                {primaryClass.name} ·{" "}
                {format(new Date(), "EEEE, d MMM")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="h-10 px-4 rounded-xl bg-edu-navy text-white font-bold text-sm flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Notice
          </button>
        </div>

        {/* Stats banner */}
        <div className="rounded-2xl bg-gradient-to-br from-edu-blue to-edu-navy text-white p-4 shadow-md">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
            <Sparkles className="w-3 h-3" /> Overview
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <Stat label="Total seen" value={stats.total} />
            <Stat label="Yours" value={stats.mine} />
            <Stat label="Active" value={stats.active} />
            <Stat label="Pinned" value={stats.pinned} />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notices…"
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
              Notices you post here go to <strong>parents of {primaryClass.name}</strong> only.
              School-wide and stage-wide notices (visible below) come from the
              principal — those you can read but not edit.
            </p>
          </CardContent>
        </Card>

        {/* List */}
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading notices…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCompose={openNew} hasNotices={notices.length > 0} />
        ) : (
          <ul
            className={cn(
              isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
            )}
          >
            {filtered.map((n) => (
              <NoticeCard
                key={n.id}
                notice={n}
                myUid={myUid}
                onEdit={() => openEdit(n)}
                onDelete={() => handleDelete(n)}
                onTogglePin={() => handleTogglePin(n)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Composer dialog (custom — keeps the teacher's bottom-sheet feel on mobile) */}
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
          isDesktop={isDesktop}
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

function NoticeCard({
  notice,
  myUid,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  notice: NoticeRow;
  myUid?: string;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const typeMeta = TYPES.find((t) => t.key === notice.type) || TYPES[0];
  const expired =
    notice.expiresAt && new Date(notice.expiresAt).getTime() < Date.now();
  const mine = notice.createdBy === myUid;

  return (
    <li
      className={cn(
        "relative rounded-2xl border-2 p-4 bg-white transition",
        notice.pinned
          ? "border-edu-yellow/60 bg-edu-light-yellow/30"
          : mine
          ? "border-edu-blue/30"
          : "border-border",
        expired && "opacity-60"
      )}
    >
      {notice.pinned && (
        <Pin className="absolute top-3 right-3 w-3.5 h-3.5 text-edu-yellow" />
      )}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg border",
            TYPE_BG[notice.type]
          )}
        >
          {typeMeta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-edu-navy text-sm leading-tight">
            {notice.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {typeMeta.label}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span
              className={cn(
                "text-[10px] font-bold rounded px-1.5 py-0.5",
                notice.audience === "class"
                  ? "bg-edu-light-blue text-edu-blue"
                  : notice.audience === "stage"
                  ? "bg-edu-light-green text-edu-green"
                  : "bg-edu-light-pink text-edu-pink"
              )}
            >
              {notice.audience === "class"
                ? "Your class"
                : notice.audience === "stage"
                ? "All Pre-Primary"
                : "School-wide"}
            </span>
            {notice.publishedAt && (
              <>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {formatDistanceToNow(new Date(notice.publishedAt), {
                    addSuffix: true,
                  })}
                </span>
              </>
            )}
            {expired && (
              <span className="text-[10px] font-bold text-edu-red bg-edu-light-red px-1.5 py-0.5 rounded">
                Expired
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-foreground/80 leading-relaxed mt-3 whitespace-pre-wrap line-clamp-4">
        {notice.body}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
        <span className="font-semibold">
          {mine ? (
            <span className="text-edu-blue">By you</span>
          ) : (
            <>By {notice.createdByName || "Principal"}</>
          )}
          {notice.expiresAt && !expired && (
            <>
              {" · "}
              <span className="text-edu-orange">
                exp {format(new Date(notice.expiresAt), "d MMM, h:mm a")}
              </span>
            </>
          )}
        </span>
        {mine && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onTogglePin}
              className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center"
              title={notice.pinned ? "Unpin" : "Pin to top"}
            >
              {notice.pinned ? (
                <PinOff className="w-3.5 h-3.5 text-edu-yellow" />
              ) : (
                <Pin className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
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
  hasNotices,
}: {
  onCompose: () => void;
  hasNotices: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-10 text-center">
        <p className="text-5xl mb-3">📬</p>
        <p className="text-base font-black text-edu-navy">
          {hasNotices ? "No matches" : "No notices yet"}
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
          {hasNotices
            ? "Try a different search term."
            : "Send your first class notice — parents see it instantly in their app."}
        </p>
        {!hasNotices && (
          <button
            type="button"
            onClick={onCompose}
            className="mt-4 h-10 px-5 rounded-xl bg-edu-navy text-white font-bold text-sm inline-flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Compose first notice
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
  isDesktop,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  saving: boolean;
  className: string;
  onClose: () => void;
  onSave: () => void;
  isDesktop: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
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

        {/* Header */}
        <div className="px-5 pt-3 pb-2 flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-edu-navy">
              {editing ? "Edit Notice" : "New Notice"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Posts to <strong>{className}</strong> parents only
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
          <div>
            <Label
              htmlFor="t-title"
              className="text-xs font-bold uppercase tracking-wider"
            >
              Title
            </Label>
            <Input
              id="t-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Picnic Friday — pack lunch"
              maxLength={120}
              className="mt-1"
            />
          </div>

          {/* Body */}
          <div>
            <Label
              htmlFor="t-body"
              className="text-xs font-bold uppercase tracking-wider"
            >
              Body
            </Label>
            <textarea
              id="t-body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Full details parents need to know…"
              rows={4}
              maxLength={1500}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {form.body.length}/1500
            </p>
          </div>

          {/* Type */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider">
              Type
            </Label>
            <div className="mt-1 grid grid-cols-5 gap-2">
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
                  title={t.label}
                >
                  <div className="text-lg leading-none">{t.emoji}</div>
                  <div className="text-[9px] font-bold mt-0.5 text-muted-foreground uppercase tracking-wider">
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pin + Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-border p-3 cursor-pointer hover:border-foreground/30 transition">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) =>
                  setForm({ ...form, pinned: e.target.checked })
                }
                className="w-4 h-4"
              />
              <div className="flex-1">
                <p className="text-xs font-bold text-edu-navy flex items-center gap-1">
                  <Pin className="w-3 h-3" /> Pin to top
                </p>
                <p className="text-[10px] text-muted-foreground">Stays at top</p>
              </div>
            </label>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" /> Expires (optional)
              </Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm({ ...form, expiresAt: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
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
              "Post notice"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

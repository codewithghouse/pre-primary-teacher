import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Filter,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  usePPIncidents,
  INCIDENT_TYPE_EMOJI,
  INCIDENT_TYPE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  ALL_INCIDENT_TYPES,
  ALL_SEVERITIES,
  type Incident,
  type IncidentSeverity,
  type IncidentType,
} from "@/hooks/usePPIncidents";

export default function Incidents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { incidents, loading: incLoading, addIncident } = usePPIncidents(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [filterChild, setFilterChild] = useState<string>("");
  const [filterType, setFilterType] = useState<IncidentType | "">("");
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | "">("");
  const [showHandled, setShowHandled] = useState(false);

  const [dialog, setDialog] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<IncidentType>("injury");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [parentNotified, setParentNotified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);

  // Deep-link: /incidents?child=<id>&open=1 → opens composer pre-filled.
  // Used by Child Profile 360 "Log incident" CTA.
  useEffect(() => {
    const childParam = searchParams.get("child");
    const openParam = searchParams.get("open");
    if (openParam === "1" && childParam) {
      setStudentId(childParam);
      setDialog(true);
      // Strip the params so refresh doesn't re-open
      const next = new URLSearchParams(searchParams);
      next.delete("child");
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (justSavedAt === null) return;
    const t = setTimeout(() => setJustSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [justSavedAt]);

  const filtersActive = !!(
    filterChild ||
    filterType ||
    filterSeverity ||
    search.trim() ||
    showHandled
  );
  const clearFilters = () => {
    setFilterChild("");
    setFilterType("");
    setFilterSeverity("");
    setSearch("");
    setShowHandled(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (!showHandled && i.handled) return false;
      if (filterChild && i.studentId !== filterChild) return false;
      if (filterType && i.type !== filterType) return false;
      if (filterSeverity && i.severity !== filterSeverity) return false;
      if (q) {
        const hay = `${i.studentName} ${i.title} ${i.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, search, filterChild, filterType, filterSeverity, showHandled]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: incidents.length,
      today: incidents.filter((i) => i.date === today).length,
      unhandled: incidents.filter((i) => !i.handled).length,
      critical: incidents.filter((i) => i.severity === "critical" && !i.handled)
        .length,
    };
  }, [incidents]);

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

  if (incLoading && incidents.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading incidents…</p>
      </div>
    );
  }

  const openAdd = (preChildId?: string) => {
    setStudentId(preChildId || "");
    setType("injury");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setActionTaken("");
    setParentNotified(false);
    setDialog(true);
  };

  const submit = async () => {
    const child = roster.find((c) => c.id === studentId);
    if (!child) {
      toast.error("Pick a child");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Title too short");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Description too short — give some detail");
      return;
    }
    setSaving(true);
    try {
      await addIncident({
        studentId: child.id,
        studentName: child.name,
        type,
        severity,
        title,
        description,
        actionTaken: actionTaken.trim() || undefined,
        parentNotified,
      });
      toast.success(
        `${INCIDENT_TYPE_EMOJI[type]} ${INCIDENT_TYPE_LABEL[type]} incident logged for ${child.name.split(" ")[0]}`
      );
      setDialog(false);
      clearFilters();
      setJustSavedAt(Date.now());
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      console.error("[Incidents] addIncident:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not save incident: ${msg.slice(0, 140)}`);
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
              "font-black text-edu-navy mt-0.5 flex items-center gap-2",
              isDesktop ? "text-2xl" : "text-xl"
            )}
          >
            <ShieldAlert className="w-5 h-5 text-edu-red" /> Incidents
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Append-only safety + escalation log · visible to principal
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          className="h-10 px-4 rounded-xl bg-edu-red text-white font-bold text-sm flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-4 h-4" /> {isDesktop && "Log incident"}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Total" value={stats.total} accent="text-edu-navy" />
        <StatTile label="Today" value={stats.today} accent="text-edu-blue" />
        <StatTile
          label="Unhandled"
          value={stats.unhandled}
          accent={stats.unhandled > 0 ? "text-edu-orange" : "text-edu-green"}
        />
        <StatTile
          label="Critical"
          value={stats.critical}
          accent={stats.critical > 0 ? "text-edu-red" : "text-muted-foreground"}
        />
      </div>

      {/* Filters */}
      <div className={isDesktop ? "grid grid-cols-4 gap-3" : "grid grid-cols-1 gap-2"}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as IncidentType | "")}
          className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground"
        >
          <option value="">All types</option>
          {ALL_INCIDENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {INCIDENT_TYPE_EMOJI[t]} {INCIDENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as IncidentSeverity | "")}
          className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground"
        >
          <option value="">All severities</option>
          {ALL_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Show-handled toggle */}
      <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showHandled}
          onChange={(e) => setShowHandled(e.target.checked)}
          className="w-3.5 h-3.5"
        />
        Also show handled / resolved
      </label>

      {filtersActive && (
        <div className="flex items-center justify-between gap-2 -mt-1">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3 h-3" />
            Showing{" "}
            <span className="font-bold text-edu-navy">{filtered.length}</span>{" "}
            of {incidents.length}
            {filterChild && roster.find((r) => r.id === filterChild) && (
              <span className="px-1.5 py-0.5 rounded bg-secondary text-edu-navy font-semibold">
                {roster.find((r) => r.id === filterChild)?.name.split(" ")[0]}
              </span>
            )}
            {filterType && (
              <span className="px-1.5 py-0.5 rounded bg-secondary text-edu-navy font-semibold">
                {INCIDENT_TYPE_EMOJI[filterType]} {INCIDENT_TYPE_LABEL[filterType]}
              </span>
            )}
            {filterSeverity && (
              <span className="px-1.5 py-0.5 rounded bg-secondary text-edu-navy font-semibold">
                {SEVERITY_LABEL[filterSeverity]}
              </span>
            )}
            {showHandled && (
              <span className="px-1.5 py-0.5 rounded bg-secondary text-edu-navy font-semibold">
                + handled
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-bold text-edu-blue hover:underline shrink-0"
          >
            Clear filters
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-3xl mb-2">🛡️</div>
            <p className="text-sm font-bold text-edu-navy">
              {filtersActive
                ? "No matches — clear filters to see all"
                : "No incidents recorded"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filtersActive
                ? "Your saved incident might be hidden by an active filter."
                : "A clean log is good news. Tap + if you need to record something."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 h-9 px-4 rounded-xl bg-edu-navy text-white text-xs font-bold"
              >
                Clear filters
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul
          className={cn(
            isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
          )}
        >
          {filtered.map((inc, i) => (
            <li key={inc.id}>
              <IncidentCard
                incident={inc}
                pulse={justSavedAt !== null && i === 0}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Composer dialog */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => !saving && setDialog(false)}
        >
          <div
            className={cn(
              "w-full bg-white pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto animate-slide-up",
              isDesktop
                ? "max-w-lg rounded-3xl shadow-2xl"
                : "max-w-md rounded-t-3xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  New incident
                </p>
                <p className="text-lg font-black text-edu-navy">
                  Log incident
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
                <DialogLabel>Child</DialogLabel>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold"
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
                <DialogLabel>Type</DialogLabel>
                <div className="grid grid-cols-5 gap-1.5">
                  {ALL_INCIDENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "h-16 rounded-xl border-2 text-[10px] font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1",
                        type === t
                          ? "border-edu-navy bg-edu-light-blue/30 text-edu-navy"
                          : "border-border text-foreground bg-white"
                      )}
                    >
                      <div className="text-base leading-none">
                        {INCIDENT_TYPE_EMOJI[t]}
                      </div>
                      <div className="leading-tight px-1">
                        {INCIDENT_TYPE_LABEL[t]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <DialogLabel>Severity</DialogLabel>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_SEVERITIES.map((s) => {
                    const c = SEVERITY_COLOR[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(s)}
                        className={cn(
                          "h-12 rounded-xl border-2 text-xs font-bold transition active:scale-95"
                        )}
                        style={
                          severity === s
                            ? {
                                background: c.bg,
                                color: c.fg,
                                borderColor: c.bar,
                              }
                            : {
                                background: "#fff",
                                color: "#475569",
                                borderColor: "#E2E8F0",
                              }
                        }
                      >
                        {SEVERITY_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <DialogLabel>Title</DialogLabel>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={199}
                  placeholder="e.g. Bumped head on shelf"
                />
              </div>

              <div>
                <DialogLabel>What happened</DialogLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={3999}
                  placeholder="Where, when, who was around, how the child responded."
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
                />
              </div>

              <div>
                <DialogLabel>Action taken (optional)</DialogLabel>
                <Input
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="First aid, comforted, isolated from source, etc."
                />
              </div>

              <label
                className="flex items-start gap-2 cursor-pointer p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50"
              >
                <input
                  type="checkbox"
                  checked={parentNotified}
                  onChange={(e) => setParentNotified(e.target.checked)}
                  className="mt-0.5 w-4 h-4"
                />
                <span className="text-xs text-foreground/90 leading-relaxed">
                  <strong>Parent has been notified</strong> about this incident
                  (phone, WhatsApp, or in person). Timestamp gets recorded.
                </span>
              </label>
            </div>

            <div className="px-5 mt-4 pb-5">
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="w-full h-12 rounded-xl bg-edu-red text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                Log incident
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Incidents are append-only and visible to your principal.
                Cannot be deleted after submission.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={cn("text-2xl font-black", accent)}>{value}</p>
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-0.5">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

function DialogLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
      {children}
    </label>
  );
}

function IncidentCard({
  incident,
  pulse,
}: {
  incident: Incident;
  pulse: boolean;
}) {
  const c = SEVERITY_COLOR[incident.severity];
  return (
    <Card
      className={cn(
        pulse && "ring-2 ring-edu-green ring-offset-2 animate-pulse"
      )}
      style={{ borderLeft: `4px solid ${c.bar}` }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span
                className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: c.bg, color: c.fg }}
              >
                {SEVERITY_LABEL[incident.severity]}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-edu-navy border border-border inline-flex items-center gap-1">
                {INCIDENT_TYPE_EMOJI[incident.type]}{" "}
                {INCIDENT_TYPE_LABEL[incident.type]}
              </span>
              {incident.handled ? (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-edu-light-green text-edu-green border border-edu-green/30 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Handled
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-edu-light-orange text-edu-orange border border-edu-orange/30 inline-flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> Pending
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-edu-navy">{incident.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {incident.studentName} ·{" "}
              {format(new Date(incident.createdAt), "d MMM · h:mm a")}
            </p>
          </div>
        </div>
        <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {incident.description}
        </p>
        {incident.actionTaken && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-bold text-edu-navy">Action:</span>{" "}
            {incident.actionTaken}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
          <span className="text-[10px] text-muted-foreground">
            — {incident.createdByName || "Teacher"}
          </span>
          {incident.parentNotified ? (
            <span className="text-[10px] font-semibold text-edu-green inline-flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Parent notified
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-edu-orange inline-flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Parent not notified
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

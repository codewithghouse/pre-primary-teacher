import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Sparkles, X, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  usePPMilestones,
  type Domain,
  type RubricLevel,
  DOMAIN_LABEL,
  DOMAIN_EMOJI,
  DOMAIN_COLOR,
  LEVEL_LABEL,
  LEVEL_COLOR,
  ALL_DOMAINS,
  ALL_LEVELS,
} from "@/hooks/usePPMilestones";

export default function Milestones() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { milestones, loading: msLoading, addMilestone } = usePPMilestones(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [filterChild, setFilterChild] = useState<string>("");
  const [filterDomain, setFilterDomain] = useState<Domain | "">("");
  const [dialog, setDialog] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [domain, setDomain] = useState<Domain>("cognitive");
  const [level, setLevel] = useState<RubricLevel>("developing");
  const [observation, setObservation] = useState("");
  const [evidence, setEvidence] = useState("");
  const [saving, setSaving] = useState(false);

  const loading = classLoading || msLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return milestones.filter((m) => {
      if (filterChild && m.studentId !== filterChild) return false;
      if (filterDomain && m.domain !== filterDomain) return false;
      if (q) {
        const hay = `${m.studentName} ${m.observation} ${m.evidence || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [milestones, search, filterChild, filterDomain]);

  const byDomain = useMemo(() => {
    const map: Record<Domain, number> = {
      physical: 0,
      cognitive: 0,
      language: 0,
      socio_emotional: 0,
      creative: 0,
    };
    for (const m of milestones) {
      map[m.domain]++;
    }
    return map;
  }, [milestones]);

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

  if (loading && milestones.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading milestones…</p>
      </div>
    );
  }

  const openAdd = () => {
    setStudentId("");
    setDomain("cognitive");
    setLevel("developing");
    setObservation("");
    setEvidence("");
    setDialog(true);
  };

  const submit = async () => {
    const child = roster.find((c) => c.id === studentId);
    if (!child) {
      toast.error("Pick a child");
      return;
    }
    if (observation.trim().length < 5) {
      toast.error("Observation too short");
      return;
    }
    setSaving(true);
    try {
      await addMilestone({
        studentId: child.id,
        studentName: child.name,
        domain,
        level,
        observation,
        evidence: evidence.trim() || undefined,
      });
      toast.success(
        `${DOMAIN_EMOJI[domain]} ${DOMAIN_LABEL[domain]} milestone saved for ${child.name.split(" ")[0]}`
      );
      setDialog(false);
    } catch (e) {
      console.error("[Milestones] addMilestone:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not save milestone: ${msg.slice(0, 120)}`);
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
            Milestones &amp; Observations 🌱
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            NEP 2020 Foundational Stage · 5 domains
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="h-10 px-4 rounded-xl bg-edu-navy text-white font-bold text-sm flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-4 h-4" /> {isDesktop && "New observation"}
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-edu-blue to-edu-navy text-white p-4 shadow-md">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
          <Sparkles className="w-3 h-3" /> Term snapshot
        </div>
        <p className="text-3xl font-black mt-1">{milestones.length}</p>
        <p className="text-[11px] text-white/70 mt-0.5">total observations recorded</p>
        <div className={cn("grid gap-1.5 mt-3", isDesktop ? "grid-cols-5" : "grid-cols-5")}>
          {ALL_DOMAINS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() =>
                setFilterDomain(filterDomain === d ? "" : d)
              }
              className={cn(
                "rounded-xl px-2 py-2 text-[10px] font-bold border-2 transition active:scale-95",
                filterDomain === d
                  ? "bg-white text-edu-navy border-white"
                  : "bg-white/10 text-white border-white/20"
              )}
            >
              <div className="text-base leading-none">{DOMAIN_EMOJI[d]}</div>
              <div className="mt-1">{byDomain[d]}</div>
            </button>
          ))}
        </div>
      </div>

      <div className={isDesktop ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-2"}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search milestones…"
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
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-3xl mb-2">🌱</div>
            <p className="text-sm font-bold text-edu-navy">No milestones yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap + to record an observation against any of the 5 NEP 2020 domains.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul
          className={cn(
            isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
          )}
        >
          {filtered.map((m) => (
            <li key={m.id}>
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/child/${m.studentId}`}
                        className="text-sm font-bold text-edu-navy truncate block hover:underline"
                      >
                        {m.studentName}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(m.recordedAt), "d MMM · h:mm a")} ·{" "}
                        {m.term}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
                        DOMAIN_COLOR[m.domain]
                      )}
                    >
                      {DOMAIN_EMOJI[m.domain]} {DOMAIN_LABEL[m.domain]}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {m.observation}
                  </p>
                  {m.evidence && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Evidence: {m.evidence}
                    </p>
                  )}
                  <div className={cn("text-[11px] font-bold", LEVEL_COLOR[m.level])}>
                    Level: {LEVEL_LABEL[m.level]}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
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
                  New observation
                </p>
                <p className="text-lg font-black text-edu-navy">
                  Milestone entry
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
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Domain (NEP 2020 5-domain)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {ALL_DOMAINS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDomain(d)}
                      className={cn(
                        "h-16 rounded-xl border-2 text-[10px] font-bold transition active:scale-95",
                        domain === d
                          ? DOMAIN_COLOR[d]
                          : "border-border text-foreground bg-white"
                      )}
                    >
                      <div className="text-base leading-none">
                        {DOMAIN_EMOJI[d]}
                      </div>
                      <div className="mt-1 leading-tight px-1">
                        {DOMAIN_LABEL[d]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Rubric level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={cn(
                        "h-12 rounded-xl border-2 text-xs font-bold transition active:scale-95",
                        level === l
                          ? "border-edu-navy bg-edu-light-blue/30 text-edu-navy"
                          : "border-border text-foreground bg-white"
                      )}
                    >
                      {LEVEL_LABEL[l]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Observation
                </label>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={3}
                  placeholder="What did the child do? Specific, observable behavior."
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                  Evidence (optional)
                </label>
                <Input
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="e.g. drew first recognisable circle / counted 1-10"
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
                Save observation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Moon,
  Utensils,
  Undo2,
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
  usePPMealsNaps,
  type MealType,
  type Portion,
  type NapEntry,
  type MealEntry,
  MEAL_TYPE_LABEL,
  MEAL_TYPE_EMOJI,
  PORTION_LABEL,
  PORTION_PERCENT,
} from "@/hooks/usePPMealsNaps";

const MEAL_TYPES: MealType[] = ["breakfast", "snack", "lunch", "tea_snack"];
const PORTIONS: Portion[] = ["none", "some", "most", "all"];

const PORTION_COLOR: Record<Portion, string> = {
  none: "bg-edu-light-red text-edu-red border-edu-red/30",
  some: "bg-edu-light-yellow text-edu-yellow border-edu-yellow/40",
  most: "bg-edu-light-blue text-edu-blue border-edu-blue/30",
  all: "bg-edu-light-green text-edu-green border-edu-green/30",
};

function detectAllergens(meal: MealType, allergies: string[] = []): string[] {
  if (!allergies.length) return [];
  return allergies.filter((a) => a && a.trim().length > 0);
}

interface ChildSummary {
  child: RosterChild;
  meals: MealEntry[];
  nap: NapEntry | null;
  lastMeal: MealEntry | null;
}

export default function MealsNap() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const { data, loading, addMeal, startNap, endNap, undoLastMeal } =
    usePPMealsNaps(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<
    | { mode: "meal"; child: RosterChild }
    | { mode: "nap"; child: RosterChild; existing: NapEntry | null }
    | null
  >(null);
  const [mealType, setMealType] = useState<MealType>("snack");
  const [portion, setPortion] = useState<Portion>("most");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const allLoading = classLoading || rosterLoading || loading;

  const summaries: ChildSummary[] = useMemo(() => {
    const meals = data?.meals || [];
    const naps = data?.naps || [];
    return roster.map((c) => {
      const childMeals = meals
        .filter((m) => m.studentId === c.id)
        .slice()
        .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
      const openNap = naps.find((n) => n.studentId === c.id && !n.endTime) || null;
      const recentNap = openNap ||
        naps
          .filter((n) => n.studentId === c.id)
          .slice()
          .sort((a, b) =>
            a.recordedAt < b.recordedAt ? 1 : -1
          )[0] || null;
      return {
        child: c,
        meals: childMeals,
        nap: recentNap,
        lastMeal: childMeals[childMeals.length - 1] || null,
      };
    });
  }, [data?.meals, data?.naps, roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.child.name.toLowerCase().includes(q));
  }, [summaries, search]);

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

  if (allLoading && roster.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading…</p>
      </div>
    );
  }

  const stats = {
    mealsLogged: data?.meals.length || 0,
    napsLogged: data?.naps.length || 0,
    refused: (data?.meals || []).filter((m) => m.portion === "none").length,
    napping:
      (data?.naps || []).filter((n) => !n.endTime).length,
  };

  const openMeal = (child: RosterChild) => {
    setMealType("snack");
    setPortion("most");
    setNote("");
    setSheet({ mode: "meal", child });
  };
  const handleNapToggle = async (child: RosterChild, existing: NapEntry | null) => {
    if (existing && !existing.endTime) {
      setBusy(true);
      try {
        await endNap(existing.id);
        toast.success(`Nap ended for ${child.name.split(" ")[0]}`);
      } catch (e) {
        console.error("[MealsNap] endNap:", e);
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Could not end nap: ${msg.slice(0, 120)}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await startNap({ studentId: child.id, studentName: child.name });
      toast.success(`Nap started for ${child.name.split(" ")[0]} 😴`);
    } catch (e) {
      console.error("[MealsNap] startNap:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not start nap: ${msg.slice(0, 120)}`);
    } finally {
      setBusy(false);
    }
  };

  const submitMeal = async () => {
    if (sheet?.mode !== "meal") return;
    const child = sheet.child;
    setBusy(true);
    try {
      const allergens = detectAllergens(mealType, child.allergies);
      await addMeal({
        studentId: child.id,
        studentName: child.name,
        mealType,
        portion,
        allergensFlagged: allergens.length ? allergens : undefined,
        note: note.trim() || undefined,
      });
      if (allergens.length) {
        toast.warning(
          `${child.name.split(" ")[0]}: ${allergens.join(", ")} flagged`
        );
      } else {
        toast.success(
          `${MEAL_TYPE_EMOJI[mealType]} ${MEAL_TYPE_LABEL[mealType]} · ${PORTION_LABEL[portion]} logged`
        );
      }
      setSheet(null);
    } catch (e) {
      console.error("[MealsNap] addMeal:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not save meal: ${msg.slice(0, 120)}`);
    } finally {
      setBusy(false);
    }
  };

  const header = (
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
          Meals &amp; Nap 🍱
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
      <div className="grid grid-cols-4 gap-3 mt-2">
        <Stat label="Meals" value={stats.mealsLogged} />
        <Stat label="Refused" value={stats.refused} warn={stats.refused > 0} />
        <Stat label="Naps" value={stats.napsLogged} />
        <Stat label="Napping" value={stats.napping} live={stats.napping > 0} />
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

  return (
    <div
      className={cn(
        "py-4 space-y-4 animate-fade-in",
        isDesktop ? "px-6 lg:px-10 max-w-7xl mx-auto" : "px-4"
      )}
    >
      {header}
      <div className={isDesktop ? "grid grid-cols-3 gap-4" : "space-y-4"}>
        <div className={isDesktop ? "col-span-2" : ""}>{statsBanner}</div>
        <div>{searchBar}</div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-xs text-muted-foreground">
            No children match.
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            isDesktop
              ? "grid grid-cols-2 xl:grid-cols-3 gap-3"
              : "space-y-2"
          )}
        >
          {filtered.map((s) => (
            <ChildCard
              key={s.child.id}
              summary={s}
              busy={busy}
              onMeal={() => openMeal(s.child)}
              onNapToggle={() => handleNapToggle(s.child, s.nap)}
              onUndoMeal={() => {
                undoLastMeal(s.child.id);
              }}
            />
          ))}
        </div>
      )}

      {sheet?.mode === "meal" && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => !busy && setSheet(null)}
        >
          <div
            className={cn(
              "w-full bg-white pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto animate-slide-up",
              isDesktop
                ? "max-w-md rounded-3xl shadow-2xl"
                : "max-w-md rounded-t-3xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2 flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  Log meal
                </p>
                <p className="text-lg font-black text-edu-navy truncate">
                  {sheet.child.name}
                </p>
                {sheet.child.allergies && sheet.child.allergies.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-edu-red text-[11px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    Allergies: {sheet.child.allergies.join(", ")}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSheet(null)}
                className="w-8 h-8 rounded-full hover:bg-secondary/50 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 mt-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Meal type
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    className={cn(
                      "h-14 rounded-2xl border-2 text-xs font-bold transition active:scale-95",
                      mealType === t
                        ? "border-edu-blue bg-edu-light-blue text-edu-blue"
                        : "border-border text-foreground bg-white"
                    )}
                  >
                    <div className="text-lg leading-none">
                      {MEAL_TYPE_EMOJI[t]}
                    </div>
                    <div className="mt-0.5">{MEAL_TYPE_LABEL[t]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 mt-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Portion eaten
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PORTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPortion(p)}
                    className={cn(
                      "h-14 rounded-2xl border-2 text-xs font-bold transition active:scale-95",
                      portion === p
                        ? PORTION_COLOR[p]
                        : "border-border text-foreground bg-white"
                    )}
                  >
                    <div className="text-base font-black leading-none">
                      {PORTION_PERCENT[p]}%
                    </div>
                    <div className="mt-0.5">{PORTION_LABEL[p]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 mt-4 pb-5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5 block">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to share with parent?"
                rows={2}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edu-blue/30"
              />
              <button
                type="button"
                disabled={busy}
                onClick={submitMeal}
                className="mt-3 w-full h-12 rounded-xl bg-edu-navy text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save meal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChildCard({
  summary,
  busy,
  onMeal,
  onNapToggle,
  onUndoMeal,
}: {
  summary: ChildSummary;
  busy: boolean;
  onMeal: () => void;
  onNapToggle: () => void;
  onUndoMeal: () => void;
}) {
  const { child, meals, nap, lastMeal } = summary;
  const napping = !!nap && !nap.endTime;

  return (
    <Card className={cn(napping && "border-edu-pink/40 bg-edu-pink/10")}>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar name={child.name} photoURL={child.photoURL} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-edu-navy truncate">
              {child.name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {meals.length} meals
              {lastMeal && ` · last ${MEAL_TYPE_EMOJI[lastMeal.mealType]} ${lastMeal.time}`}
              {nap && nap.endTime && ` · nap ${nap.startTime}-${nap.endTime}`}
              {napping && ` · 😴 napping since ${nap?.startTime}`}
            </p>
            {child.allergies && child.allergies.length > 0 && (
              <p className="text-[10px] text-edu-red font-bold mt-0.5 truncate">
                <AlertTriangle className="w-2.5 h-2.5 inline mb-0.5" /> Allergies: {child.allergies.join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMeal}
            className="h-10 rounded-lg bg-edu-light-blue text-edu-blue border-2 border-edu-blue/30 font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
          >
            <Utensils className="w-3.5 h-3.5" /> Log meal
          </button>
          <button
            type="button"
            onClick={onNapToggle}
            disabled={busy}
            className={cn(
              "h-10 rounded-lg border-2 font-bold text-xs flex items-center justify-center gap-1 active:scale-95",
              napping
                ? "bg-edu-pink/20 text-edu-pink border-edu-pink/40"
                : "bg-edu-light-yellow text-edu-yellow border-edu-yellow/40"
            )}
          >
            <Moon className="w-3.5 h-3.5" />
            {napping ? "End nap" : "Start nap"}
          </button>
        </div>

        {lastMeal && (
          <button
            type="button"
            onClick={onUndoMeal}
            className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 hover:text-edu-red"
          >
            <Undo2 className="w-3 h-3" /> Undo last meal
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  warn,
  live,
}: {
  label: string;
  value: number;
  warn?: boolean;
  live?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-2xl font-black leading-none",
          warn && "text-edu-yellow",
          live && "text-edu-pink"
        )}
      >
        {value}
        {live && <span className="w-1.5 h-1.5 bg-edu-pink rounded-full inline-block ml-1 animate-pulse" />}
      </p>
      <p className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

function Avatar({ name, photoURL }: { name: string; photoURL?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className="w-10 h-10 rounded-xl object-cover"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-edu-light-blue text-edu-blue flex items-center justify-center font-black text-sm">
      {initials}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  Moon,
  Utensils,
  Undo2,
  X,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
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

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · MEALS & NAP
   Storybook-sherbet meals + naps tracker. CartoonAvatar in every row,
   sherbet portion/meal-type tile pickers, pink open-nap pulse.
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

const MEAL_TYPES: MealType[] = ["breakfast", "snack", "lunch", "tea_snack"];
const PORTIONS: Portion[] = ["none", "some", "most", "all"];

const PORTION_TONE: Record<Portion, { tone: string; surface: string }> = {
  none: {
    tone: RED,
    surface: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
  },
  some: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
  },
  most: {
    tone: SKY,
    surface: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
  },
  all: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
  },
};

const MEAL_TONE: Record<MealType, { tone: string; surface: string }> = {
  breakfast: {
    tone: PEACH,
    surface: "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)",
  },
  snack: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
  },
  lunch: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
  },
  tea_snack: {
    tone: BLUSH,
    surface: "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)",
  },
};

function detectAllergens(_meal: MealType, allergies: string[] = []): string[] {
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
      const openNap =
        naps.find((n) => n.studentId === c.id && !n.endTime) || null;
      const recentNap =
        openNap ||
        naps
          .filter((n) => n.studentId === c.id)
          .slice()
          .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0] ||
        null;
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
  if (allLoading && roster.length === 0)
    return <CenteredLoader label="Loading meals & naps…" />;

  const stats = {
    mealsLogged: data?.meals.length || 0,
    napsLogged: data?.naps.length || 0,
    refused: (data?.meals || []).filter((m) => m.portion === "none").length,
    napping: (data?.naps || []).filter((n) => !n.endTime).length,
  };

  const openMeal = (child: RosterChild) => {
    setMealType("snack");
    setPortion("most");
    setNote("");
    setSheet({ mode: "meal", child });
  };

  const handleNapToggle = async (
    child: RosterChild,
    existing: NapEntry | null
  ) => {
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

  const cardCols = isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr";

  return (
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
            "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 55%, #FFFFFF 100%)",
          boxShadow: PILLOW,
        }}
      >
        <DotScribbles color={BUTTER} dense />
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
              background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: `0 8px 18px ${BUTTER}55`,
              transform: "rotate(-8deg)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            🍱
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: BUTTER,
                opacity: 0.9,
              }}
            >
              Tum-tum & sleepy
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
              Meals &amp; Nap{" "}
              <span
                aria-hidden
                style={{ display: "inline-block", transform: "rotate(6deg)" }}
              >
                😴
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
              {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} · Tap to
              log a meal or toggle nap
            </p>
          </div>
        </div>
      </div>

      {/* 4-stat strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <CounterCard
          label="Meals"
          value={stats.mealsLogged}
          emoji="🥣"
          tone={BUTTER}
          surface="linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
        />
        <CounterCard
          label="Refused"
          value={stats.refused}
          emoji="🚫"
          tone={stats.refused > 0 ? RED : "#94A3B8"}
          surface={
            stats.refused > 0
              ? "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
              : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
          }
        />
        <CounterCard
          label="Naps"
          value={stats.napsLogged}
          emoji="🛏️"
          tone={LAV}
          surface="linear-gradient(135deg, #EDE2FF 0%, #F8F3FF 100%)"
        />
        <CounterCard
          label="Napping"
          value={stats.napping}
          emoji="😴"
          tone={stats.napping > 0 ? BLUSH : "#94A3B8"}
          surface={
            stats.napping > 0
              ? "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
              : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
          }
          pulse={stats.napping > 0}
        />
      </div>

      {/* Search */}
      <SearchPillow value={search} onChange={setSearch} />

      {/* Roster */}
      {filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No children match"
          subtitle={`Nothing matches "${search}".`}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cardCols,
            gap: 12,
          }}
        >
          {filtered.map((s) => (
            <ChildCard
              key={s.child.id}
              summary={s}
              busy={busy}
              onMeal={() => openMeal(s.child)}
              onNapToggle={() => handleNapToggle(s.child, s.nap)}
              onUndoMeal={() => undoLastMeal(s.child.id)}
            />
          ))}
        </div>
      )}

      {/* Meal composer sheet */}
      {sheet?.mode === "meal" && (
        <MealSheet
          isDesktop={isDesktop}
          child={sheet.child}
          mealType={mealType}
          setMealType={setMealType}
          portion={portion}
          setPortion={setPortion}
          note={note}
          setNote={setNote}
          busy={busy}
          onSubmit={submitMeal}
          onClose={() => !busy && setSheet(null)}
        />
      )}
    </div>
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
  pulse,
}: {
  label: string;
  value: number;
  emoji: string;
  tone: string;
  surface: string;
  pulse?: boolean;
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
        animation: pulse ? "pulse 2s ease-in-out infinite" : undefined,
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
        placeholder="Search a child…"
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
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
        {emoji}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</p>
      <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{subtitle}</p>
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
  const hasAllergies = (child.allergies?.length || 0) > 0;

  const surface = napping
    ? "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
    : hasAllergies
    ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
    : "linear-gradient(135deg, #FFF1E0 0%, #FFFAF1 100%)";
  const scribble = napping ? BLUSH : hasAllergies ? BUTTER : PEACH;
  const ring = napping ? BLUSH : hasAllergies ? BUTTER : PEACH;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        background: surface,
        boxShadow: PILLOW,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: napping ? "pulse 3s ease-in-out infinite" : undefined,
      }}
    >
      <DotScribbles color={scribble} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CartoonAvatar
            name={child.name}
            size={48}
            ringColor={ring}
            ringWidth={3}
          />
          {napping && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: BLUSH,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 10px ${BLUSH}66`,
                border: "2px solid #fff",
                transform: "rotate(8deg)",
                fontSize: 11,
              }}
            >
              😴
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {child.name}
          </p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meals.length} meals
            {lastMeal &&
              ` · last ${MEAL_TYPE_EMOJI[lastMeal.mealType]} ${lastMeal.time}`}
            {nap && nap.endTime && ` · nap ${nap.startTime}-${nap.endTime}`}
            {napping && ` · napping since ${nap?.startTime}`}
          </p>
          {hasAllergies && (
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#92400E",
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <AlertTriangle size={9} strokeWidth={2.6} />
              {child.allergies!.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onMeal}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "9px 12px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${PEACH}, #EA580C)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            boxShadow: `0 8px 18px -6px ${PEACH}66`,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          <Utensils size={13} strokeWidth={2.6} />
          Log meal
        </button>
        <button
          type="button"
          onClick={onNapToggle}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "9px 12px",
            borderRadius: 14,
            background: napping
              ? `linear-gradient(135deg, ${BLUSH}, #DB2777)`
              : `linear-gradient(135deg, ${LAV}, #7C3AED)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            border: "none",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
            boxShadow: napping
              ? `0 8px 18px -6px ${BLUSH}66`
              : `0 8px 18px -6px ${LAV}55`,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          <Moon size={13} strokeWidth={2.6} />
          {napping ? "End nap" : "Start nap"}
        </button>
      </div>

      {lastMeal && (
        <button
          type="button"
          onClick={onUndoMeal}
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 11,
            fontWeight: 700,
            color: "#64748B",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            alignSelf: "flex-start",
            padding: 0,
          }}
          className="hover:text-edu-red"
        >
          <Undo2 size={11} strokeWidth={2.4} />
          Undo last meal
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════ Meal composer ═══════════════════════ */

function MealSheet({
  isDesktop,
  child,
  mealType,
  setMealType,
  portion,
  setPortion,
  note,
  setNote,
  busy,
  onSubmit,
  onClose,
}: {
  isDesktop: boolean;
  child: RosterChild;
  mealType: MealType;
  setMealType: (v: MealType) => void;
  portion: Portion;
  setPortion: (v: Portion) => void;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
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
          maxWidth: isDesktop ? 520 : 480,
          maxHeight: isDesktop ? "92vh" : "94vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #FFF7E5 0%, #FFFFFF 28%, #FFFFFF 100%)",
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
              "linear-gradient(180deg, rgba(255,247,229,0.95) 0%, rgba(255,255,255,0.85) 100%)",
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
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flex: 1,
                minWidth: 0,
              }}
            >
              <CartoonAvatar
                name={child.name}
                size={48}
                ringColor={BUTTER}
                ringWidth={3}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: BUTTER,
                    opacity: 0.85,
                  }}
                >
                  Log meal
                </p>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: "-0.3px",
                    color: NAVY,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {child.name}{" "}
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      transform: "rotate(-6deg)",
                      fontSize: 15,
                    }}
                  >
                    🥄
                  </span>
                </h2>
                {child.allergies && child.allergies.length > 0 && (
                  <p
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      color: RED,
                    }}
                  >
                    <AlertTriangle size={11} strokeWidth={2.6} />
                    Allergies: {child.allergies.join(", ")}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
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
                cursor: busy ? "default" : "pointer",
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
          {/* Meal type tiles */}
          <div>
            <FieldLabel emoji="🍽️">Meal type</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {MEAL_TYPES.map((t) => {
                const mt = MEAL_TONE[t];
                const selected = mealType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "12px 10px",
                      borderRadius: 16,
                      background: selected ? mt.surface : "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${mt.tone}, ${PILLOW}`
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
                        transform: selected ? "rotate(-6deg)" : "none",
                        transition: "transform 200ms ease",
                      }}
                      aria-hidden
                    >
                      {MEAL_TYPE_EMOJI[t]}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: selected ? mt.tone : "#475569",
                      }}
                    >
                      {MEAL_TYPE_LABEL[t]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Portion tiles */}
          <div>
            <FieldLabel emoji="🥄">Portion eaten</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {PORTIONS.map((p) => {
                const pt = PORTION_TONE[p];
                const selected = portion === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPortion(p)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "10px 4px",
                      borderRadius: 14,
                      background: selected
                        ? `linear-gradient(135deg, ${pt.tone}, ${pt.tone}cc)`
                        : "#fff",
                      color: selected ? "#fff" : pt.tone,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `0 8px 18px -6px ${pt.tone}66`
                        : PILLOW,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-95"
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        letterSpacing: "-0.4px",
                      }}
                    >
                      {PORTION_PERCENT[p]}%
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {PORTION_LABEL[p]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <FieldLabel emoji="📝">Note (optional)</FieldLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything to share with parent?"
              rows={2}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 16,
                background: "#fff",
                border: "none",
                fontSize: 12,
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

          {/* Submit */}
          <button
            type="button"
            disabled={busy}
            onClick={onSubmit}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 18,
              background: busy
                ? "#CBD5E1"
                : `linear-gradient(135deg, ${PEACH}, #EA580C)`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "-0.1px",
              border: "none",
              cursor: busy ? "default" : "pointer",
              boxShadow: busy ? "none" : `0 12px 28px -8px ${PEACH}88`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Utensils size={16} strokeWidth={2.4} />
            )}
            Save meal
          </button>
        </div>
      </div>
    </div>
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


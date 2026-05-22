/**
 * SafetyDashboard.tsx — Class-wide safety reference for the pre-primary
 * teacher. Read-only consolidated view of every child's allergens,
 * medical notes, blood group, comfort cue, dietary restrictions, and
 * emergency contacts.
 *
 * Used for:
 *   - Daily situational awareness (sub-teacher days, fire drills)
 *   - Pre-trip preparation (allergens roll-up)
 *   - Quick reference during incidents
 *   - Printing a hard copy for picnics
 *
 * Desktop layout is print-friendly — grid of cards with high-contrast
 * red flags at the top so a substitute teacher can scan it fast.
 */
import { useMemo, useState } from "react";
import {
  ShieldAlert,
  Heart,
  Phone,
  Droplet,
  Utensils,
  Search,
  AlertTriangle,
  Sparkles,
  Mail,
  Printer,
  Users as UsersIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SafetyDashboard() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "alerts" | "allergens">("all");

  const summary = useMemo(() => {
    const allergenSet = new Set<string>();
    let withAllergies = 0;
    let withMedical = 0;
    let withDiet = 0;
    let withPickupOnFile = 0;
    roster.forEach((c) => {
      const allergies = c.allergies || [];
      if (allergies.length > 0) {
        withAllergies++;
        allergies.forEach((a) => allergenSet.add(a.toLowerCase()));
      }
      if (c.medical) withMedical++;
      if (c.diet) withDiet++;
      if ((c.authorizedPickup?.length || 0) > 0) withPickupOnFile++;
    });
    return {
      withAllergies,
      withMedical,
      withDiet,
      withPickupOnFile,
      allergenList: Array.from(allergenSet).sort(),
    };
  }, [roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((c) => {
      const hasAlerts =
        (c.allergies && c.allergies.length > 0) || !!c.medical;
      if (filter === "alerts" && !hasAlerts) return false;
      if (filter === "allergens" && (!c.allergies || c.allergies.length === 0))
        return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roster, search, filter]);

  // Priority sort — children with alerts surface first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aAlerts =
        (a.allergies?.length || 0) > 0 ? 2 : !!a.medical ? 1 : 0;
      const bAlerts =
        (b.allergies?.length || 0) > 0 ? 2 : !!b.medical ? 1 : 0;
      if (aAlerts !== bAlerts) return bAlerts - aAlerts;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [filtered]);

  if (classLoading || rosterLoading) {
    return (
      <div className="px-4 py-12 text-center text-xs text-muted-foreground">
        Loading roster…
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
    <div
      className={cn(
        "py-4 space-y-4 animate-fade-in print:bg-white print:py-2",
        isDesktop ? "px-6 lg:px-10 max-w-7xl mx-auto" : "px-4"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "rounded-xl bg-edu-light-red text-edu-red flex items-center justify-center",
              isDesktop ? "w-10 h-10" : "w-9 h-9"
            )}
          >
            <ShieldAlert className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
          </div>
          <div>
            <h1
              className={cn(
                "font-black text-edu-navy leading-none",
                isDesktop ? "text-2xl" : "text-xl"
              )}
            >
              Safety Dashboard
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
              <UsersIcon className="w-3 h-3" />
              {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 px-4 rounded-xl bg-secondary text-edu-navy font-bold text-sm flex items-center gap-1.5 hover:bg-secondary/70 print:hidden"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Stats banner */}
      <div className="rounded-2xl bg-gradient-to-br from-edu-red to-edu-navy text-white p-4 shadow-md print:hidden">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
          <Sparkles className="w-3 h-3" /> Safety Snapshot
        </div>
        <div className="grid grid-cols-4 gap-3 mt-2">
          <Stat label="Allergies" value={summary.withAllergies} total={roster.length} />
          <Stat label="Medical" value={summary.withMedical} total={roster.length} />
          <Stat label="Dietary" value={summary.withDiet} total={roster.length} />
          <Stat label="Pickup OK" value={summary.withPickupOnFile} total={roster.length} />
        </div>
      </div>

      {/* Allergen roll-up — critical for picnic / shared snack days */}
      {summary.allergenList.length > 0 && (
        <Card className="border-edu-red/40 bg-edu-light-red/15">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-edu-red" />
              <p className="text-[10px] uppercase tracking-widest font-black text-edu-red">
                Class-wide allergens · {summary.allergenList.length} flagged
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summary.allergenList.map((a) => (
                <span
                  key={a}
                  className="text-xs font-bold bg-edu-red/15 text-edu-red px-2 py-1 rounded-full capitalize"
                >
                  ⚠️ {a}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              Check this list before any shared snack, picnic lunch, or sweet
              treats. Specific child-allergen mapping below.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters + search */}
      <div className="flex items-center gap-2 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search a child…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        <FilterPill
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={roster.length}
        />
        <FilterPill
          active={filter === "alerts"}
          onClick={() => setFilter("alerts")}
          label="With alerts"
          count={summary.withAllergies + summary.withMedical}
          tone="red"
        />
        <FilterPill
          active={filter === "allergens"}
          onClick={() => setFilter("allergens")}
          label="Allergies"
          count={summary.withAllergies}
          tone="orange"
        />
      </div>

      {/* Children cards */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No children match.
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            "gap-3 print:gap-2",
            isDesktop
              ? "grid grid-cols-2 xl:grid-cols-3 gap-3 print:grid-cols-2"
              : "space-y-3"
          )}
        >
          {sorted.map((child) => (
            <ChildSafetyCard key={child.id} child={child} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-center text-muted-foreground pt-2 print:pt-4">
        Edullent · Pre-Primary · printed {format(new Date(), "d MMM yyyy")}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div>
      <p className="text-2xl font-black leading-none">
        {value}
        <span className="text-base text-white/60">/{total}</span>
      </p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-white/70 mt-1">
        {label}
      </p>
    </div>
  );
}

function FilterPill({
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
  tone?: "red" | "orange";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition",
        active
          ? "bg-edu-navy text-white shadow-sm"
          : "bg-white text-muted-foreground border border-border hover:border-edu-navy/40"
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none",
            active
              ? "bg-white/20 text-white"
              : tone === "red"
              ? "bg-edu-light-red text-edu-red"
              : tone === "orange"
              ? "bg-edu-light-orange text-edu-orange"
              : "bg-edu-light-blue text-edu-blue"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ChildSafetyCard({ child }: { child: RosterChild }) {
  const hasAllergies = (child.allergies?.length || 0) > 0;
  const hasMedical = !!child.medical;
  const flagged = hasAllergies || hasMedical;
  const initials = child.name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card
      className={cn(
        "border-2 transition",
        hasAllergies
          ? "border-edu-red/50 bg-edu-light-red/15"
          : hasMedical
          ? "border-edu-orange/50 bg-edu-light-orange/15"
          : "border-border"
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Child header */}
        <div className="flex items-center gap-3">
          {child.photoURL ? (
            <img
              src={child.photoURL}
              alt={child.name}
              className="w-12 h-12 rounded-xl object-cover"
            />
          ) : (
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm",
                flagged
                  ? "bg-edu-red text-white"
                  : "bg-edu-light-blue text-edu-blue"
              )}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-black text-edu-navy text-sm truncate">
              {child.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Roll {child.rollNo}
              {child.bloodGroup && (
                <span className="ml-1 font-bold text-edu-red">
                  · {child.bloodGroup}
                </span>
              )}
            </p>
          </div>
          {flagged && (
            <span className="text-[10px] font-black text-edu-red bg-edu-red/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
              {hasAllergies ? "Alert" : "Watch"}
            </span>
          )}
        </div>

        {/* Allergies */}
        {hasAllergies && (
          <SafetyRow
            icon={<ShieldAlert className="w-3.5 h-3.5 text-edu-red" />}
            label="Allergies"
            tone="red"
          >
            {child.allergies!.map((a) => (
              <span
                key={a}
                className="text-[11px] font-bold bg-edu-red/15 text-edu-red px-2 py-0.5 rounded-full capitalize"
              >
                ⚠️ {a}
              </span>
            ))}
          </SafetyRow>
        )}

        {/* Medical */}
        {hasMedical && (
          <SafetyRow
            icon={<Heart className="w-3.5 h-3.5 text-edu-pink" />}
            label="Medical"
            tone="orange"
          >
            <p className="text-xs text-foreground/90 leading-relaxed">
              {child.medical}
            </p>
          </SafetyRow>
        )}

        {/* Diet */}
        {child.diet && (
          <SafetyRow
            icon={<Utensils className="w-3.5 h-3.5 text-edu-orange" />}
            label="Diet"
          >
            <p className="text-xs text-foreground/90">{child.diet}</p>
          </SafetyRow>
        )}

        {/* Comfort cue */}
        {child.comfortCue && (
          <SafetyRow
            icon={<Heart className="w-3.5 h-3.5 text-edu-blue" />}
            label="Comfort cue"
          >
            <p className="text-xs italic text-foreground/85">"{child.comfortCue}"</p>
          </SafetyRow>
        )}

        {/* Emergency contacts */}
        {(child.parentName || child.parentPhone) && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-3 h-3 text-edu-navy" />
              <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">
                Emergency contact
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="font-bold">{child.parentName || "Parent"}</span>
              {child.parentPhone && (
                <a
                  href={`tel:${child.parentPhone}`}
                  className="font-semibold text-edu-blue hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  {child.parentPhone}
                </a>
              )}
              {child.parentEmail && (
                <a
                  href={`mailto:${child.parentEmail}`}
                  className="font-semibold text-muted-foreground hover:text-edu-blue flex items-center gap-1 truncate"
                  title={child.parentEmail}
                >
                  <Mail className="w-3 h-3" />
                  Email
                </a>
              )}
            </div>
          </div>
        )}

        {/* Empty state for low-risk children */}
        {!flagged && !child.diet && !child.comfortCue && (
          <p className="text-[10px] text-center text-muted-foreground italic py-1">
            No safety notes on file
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SafetyRow({
  icon,
  label,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "red" | "orange";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p
          className={cn(
            "text-[9px] uppercase tracking-widest font-black",
            tone === "red"
              ? "text-edu-red"
              : tone === "orange"
              ? "text-edu-orange"
              : "text-muted-foreground"
          )}
        >
          {label}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

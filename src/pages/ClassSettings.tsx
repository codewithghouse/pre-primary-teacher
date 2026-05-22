/**
 * ClassSettings.tsx — Per-class configuration for the pre-primary teacher.
 *
 * Persists to `pp_class_settings/{classId}` doc. Touch-points (V1.1):
 *   - diaperEnabled / napEnabled / mealsEnabled / photosEnabled toggle which
 *     features appear on Home page tiles
 *   - themeOfWeek shows on Home banner + parent's Today page
 *   - classAllergens augments per-student allergens for the meals allergen-
 *     flash check
 *   - arrival/dismissal times drive default attendance/pickup expectations
 *
 * Each toggle is independent — saving one doesn't reset others.
 */
import { useEffect, useState } from "react";
import {
  Settings,
  Loader2,
  Sparkles,
  Droplet,
  Moon,
  Utensils,
  Camera,
  Clock,
  Save,
  AlertTriangle,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  usePPClassSettings,
  type ClassSettings as Settings_,
  type DayMode,
} from "@/hooks/usePPClassSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function ClassSettings() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { settings, loading: settingsLoading, save } = usePPClassSettings(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [form, setForm] = useState<Settings_ | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [allergenInput, setAllergenInput] = useState("");

  // Sync local form with hook data on first arrival/change
  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (classLoading || settingsLoading || !form) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading settings…</p>
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

  const saveField = async (key: keyof Settings_, value: unknown) => {
    setSavingKey(key);
    setForm({ ...form, [key]: value });
    try {
      await save({ [key]: value } as Partial<Settings_>);
      toast.success(`${labelFor(key)} updated ✓`, { duration: 1500 });
    } catch (err) {
      console.error("[ClassSettings] save:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save: ${msg.slice(0, 150)}`);
      // Revert
      setForm(settings || form);
    } finally {
      setSavingKey(null);
    }
  };

  const addAllergen = async () => {
    const a = allergenInput.trim().toLowerCase();
    if (!a) return;
    if (form.classAllergens.includes(a)) {
      toast.error("Already in list");
      return;
    }
    const next = [...form.classAllergens, a];
    setAllergenInput("");
    await saveField("classAllergens", next);
  };

  const removeAllergen = async (a: string) => {
    await saveField(
      "classAllergens",
      form.classAllergens.filter((x) => x !== a)
    );
  };

  return (
    <div
      className={cn(
        "py-4 space-y-4 animate-fade-in",
        isDesktop ? "px-6 lg:px-10 max-w-4xl mx-auto" : "px-4"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div
          className={cn(
            "rounded-xl bg-edu-light-blue text-edu-blue flex items-center justify-center",
            isDesktop ? "w-10 h-10" : "w-9 h-9"
          )}
        >
          <Settings className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
        </div>
        <div>
          <h1
            className={cn(
              "font-black text-edu-navy leading-none",
              isDesktop ? "text-2xl" : "text-xl"
            )}
          >
            Class Settings
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
            <Users className="w-3 h-3" />
            {primaryClass.name}
          </p>
        </div>
      </div>

      {/* Theme of the week */}
      <Section
        icon={<Sparkles className="w-4 h-4 text-edu-pink" />}
        title="Theme of the Week"
        description="Shows on Home banner + parent's Today page"
      >
        <div className="flex gap-2">
          <Input
            value={form.themeOfWeek || ""}
            onChange={(e) =>
              setForm({ ...form, themeOfWeek: e.target.value })
            }
            placeholder="e.g. Animals & their homes 🐘"
            maxLength={80}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => saveField("themeOfWeek", form.themeOfWeek || "")}
            disabled={savingKey === "themeOfWeek"}
            className="h-10 px-4 rounded-xl bg-edu-navy text-white font-bold text-sm flex items-center gap-1 active:scale-95 disabled:opacity-50"
          >
            {savingKey === "themeOfWeek" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
        {form.themeUpdatedAt && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Last updated{" "}
            {format(new Date(form.themeUpdatedAt), "d MMM, h:mm a")}
          </p>
        )}
      </Section>

      {/* Feature toggles */}
      <Section
        icon={<Sparkles className="w-4 h-4 text-edu-blue" />}
        title="Features"
        description="Toggle which Care & Routine tiles appear on Home. Useful for older classes that don't need diaper tracking."
      >
        <div className="space-y-2">
          <ToggleRow
            icon={<Droplet className="w-4 h-4 text-edu-blue" />}
            label="Diaper / Washroom log"
            sub="Show /diaper page + Home tile"
            value={form.diaperEnabled}
            onChange={(v) => saveField("diaperEnabled", v)}
            saving={savingKey === "diaperEnabled"}
          />
          <ToggleRow
            icon={<Moon className="w-4 h-4 text-edu-yellow" />}
            label="Nap tracking"
            sub="Show nap controls on Meals & Nap page"
            value={form.napEnabled}
            onChange={(v) => saveField("napEnabled", v)}
            saving={savingKey === "napEnabled"}
          />
          <ToggleRow
            icon={<Utensils className="w-4 h-4 text-edu-orange" />}
            label="Meals tracking"
            sub="Show meals controls + allergen flash"
            value={form.mealsEnabled}
            onChange={(v) => saveField("mealsEnabled", v)}
            saving={savingKey === "mealsEnabled"}
          />
          <ToggleRow
            icon={<Camera className="w-4 h-4 text-edu-pink" />}
            label="Photo Studio"
            sub="Show /photos page in sidebar"
            value={form.photosEnabled}
            onChange={(v) => saveField("photosEnabled", v)}
            saving={savingKey === "photosEnabled"}
          />
        </div>
      </Section>

      {/* Day mode + timings */}
      <Section
        icon={<Clock className="w-4 h-4 text-edu-green" />}
        title="Daily Schedule"
        description="Drives attendance + pickup expectations"
      >
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
              Day mode
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "half", label: "Half day", emoji: "🌅" },
                  { key: "full", label: "Full day", emoji: "🌞" },
                  { key: "extended", label: "Extended", emoji: "🌙" },
                ] as { key: DayMode; label: string; emoji: string }[]
              ).map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => saveField("dayMode", d.key)}
                  disabled={savingKey === "dayMode"}
                  className={cn(
                    "rounded-xl border-2 p-2 text-center transition active:scale-95",
                    form.dayMode === d.key
                      ? "border-edu-navy bg-edu-navy/5"
                      : "border-border hover:border-foreground/30"
                  )}
                >
                  <div className="text-lg leading-none">{d.emoji}</div>
                  <div className="text-[10px] font-bold mt-0.5 text-muted-foreground uppercase tracking-wider">
                    {d.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                Arrival time
              </p>
              <Input
                type="time"
                value={form.arrivalTime || ""}
                onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                onBlur={() => saveField("arrivalTime", form.arrivalTime)}
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                Dismissal time
              </p>
              <Input
                type="time"
                value={form.dismissalTime || ""}
                onChange={(e) =>
                  setForm({ ...form, dismissalTime: e.target.value })
                }
                onBlur={() => saveField("dismissalTime", form.dismissalTime)}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Class allergens */}
      <Section
        icon={<AlertTriangle className="w-4 h-4 text-edu-red" />}
        title="Class-wide Allergens"
        description="Trigger allergen flash on meals page even if no specific child has them flagged on their record. Useful for picnic day caution."
      >
        <div className="flex gap-2 mb-3">
          <Input
            value={allergenInput}
            onChange={(e) => setAllergenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAllergen()}
            placeholder="e.g. peanuts, gluten, shellfish"
            maxLength={40}
            className="flex-1"
          />
          <button
            type="button"
            onClick={addAllergen}
            disabled={!allergenInput.trim() || savingKey === "classAllergens"}
            className="h-10 px-4 rounded-xl bg-edu-red text-white font-bold text-sm flex items-center gap-1 active:scale-95 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {form.classAllergens.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No class-wide allergens set. Per-child allergens still trigger.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {form.classAllergens.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => removeAllergen(a)}
                className="text-xs font-bold bg-edu-red/15 text-edu-red px-2 py-1 rounded-full capitalize flex items-center gap-1 hover:bg-edu-red/25"
                title="Tap to remove"
              >
                ⚠️ {a}
                <span className="text-edu-red/60">×</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <p className="text-[10px] text-center text-muted-foreground pt-2">
        Settings auto-save on change. Last updated by{" "}
        {form.updatedByName || "you"}.
      </p>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <h2 className="text-sm font-black text-edu-navy">{title}</h2>
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
  saving,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
  saving?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition",
        value
          ? "border-edu-green/30 bg-edu-light-green/30"
          : "border-border bg-secondary/30"
      )}
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-edu-navy">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 cursor-pointer"
        />
      )}
    </label>
  );
}

function labelFor(key: keyof Settings_): string {
  const map: Partial<Record<keyof Settings_, string>> = {
    themeOfWeek: "Theme",
    diaperEnabled: "Diaper feature",
    napEnabled: "Nap feature",
    mealsEnabled: "Meals feature",
    photosEnabled: "Photos feature",
    dayMode: "Day mode",
    arrivalTime: "Arrival time",
    dismissalTime: "Dismissal time",
    classAllergens: "Allergens list",
  };
  return map[key] || String(key);
}

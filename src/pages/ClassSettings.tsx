/**
 * ClassSettings.tsx — Per-class configuration. Cartoonified 2026-05-25.
 *
 * Persists to pp_class_settings/{classId}. Each toggle auto-saves on change.
 * Sections: Theme of Week / Feature toggles / Day mode + times / Class allergens.
 */
import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  X,
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

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · CLASS SETTINGS
   Storybook-sherbet auto-save form. Sherbet sections per feature group,
   tile pickers for DayMode, mint toggle rows for features.
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

export default function ClassSettings() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { settings, loading: settingsLoading, save } = usePPClassSettings(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [form, setForm] = useState<Settings_ | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [allergenInput, setAllergenInput] = useState("");

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (classLoading || settingsLoading || !form) {
    return <CenteredLoader label="Loading settings…" />;
  }

  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
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

  const dayModes: { key: DayMode; label: string; emoji: string; tone: string }[] = [
    { key: "half", label: "Half day", emoji: "🌅", tone: PEACH },
    { key: "full", label: "Full day", emoji: "🌞", tone: BUTTER },
    { key: "extended", label: "Extended", emoji: "🌙", tone: LAV },
  ];

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: isDesktop ? "24px 28px 80px" : "16px 16px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 880,
        margin: "0 auto",
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
            "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 55%, #FFFFFF 100%)",
          boxShadow: PILLOW,
        }}
      >
        <DotScribbles color={MINT} dense />
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
              background: `linear-gradient(135deg, ${MINT}, #059669)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: `0 8px 18px ${MINT}55`,
              transform: "rotate(-8deg)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            ⚙️
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: MINT,
                opacity: 0.9,
              }}
            >
              Class config
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
              Class Settings{" "}
              <span
                aria-hidden
                style={{ display: "inline-block", transform: "rotate(6deg)" }}
              >
                🛠️
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
              {primaryClass.name} · Auto-saves on change
            </p>
          </div>
        </div>
      </div>

      {/* Theme of the Week */}
      <Section
        emoji="✨"
        tone={BLUSH}
        surface="linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
        title="Theme of the Week"
        description="Shows on Home banner + parent's Today page"
      >
        <div style={{ display: "flex", gap: 8 }}>
          <PillowInput
            value={form.themeOfWeek || ""}
            onChange={(v) => setForm({ ...form, themeOfWeek: v })}
            placeholder="e.g. Animals & their homes 🐘"
            maxLength={80}
          />
          <button
            type="button"
            onClick={() => saveField("themeOfWeek", form.themeOfWeek || "")}
            disabled={savingKey === "themeOfWeek"}
            style={{
              padding: "12px 18px",
              borderRadius: 16,
              background:
                savingKey === "themeOfWeek"
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: savingKey === "themeOfWeek" ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow:
                savingKey === "themeOfWeek"
                  ? "none"
                  : `0 8px 18px -6px ${BLUSH}66`,
              flexShrink: 0,
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            {savingKey === "themeOfWeek" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} strokeWidth={2.6} />
            )}
            Save
          </button>
        </div>
        {form.themeUpdatedAt && (
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#94A3B8",
              marginTop: 6,
            }}
          >
            Last updated {format(new Date(form.themeUpdatedAt), "d MMM, h:mm a")}
          </p>
        )}
      </Section>

      {/* Feature toggles */}
      <Section
        emoji="🎨"
        tone={SKY}
        surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
        title="Features"
        description="Toggle which Care & Routine tiles appear on Home. Useful for older classes that don't need diaper tracking."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ToggleRow
            emoji="💧"
            tone={SKY}
            label="Diaper / Washroom log"
            sub="Show /diaper page + Home tile"
            value={form.diaperEnabled}
            onChange={(v) => saveField("diaperEnabled", v)}
            saving={savingKey === "diaperEnabled"}
          />
          <ToggleRow
            emoji="😴"
            tone={LAV}
            label="Nap tracking"
            sub="Show nap controls on Meals & Nap page"
            value={form.napEnabled}
            onChange={(v) => saveField("napEnabled", v)}
            saving={savingKey === "napEnabled"}
          />
          <ToggleRow
            emoji="🍱"
            tone={BUTTER}
            label="Meals tracking"
            sub="Show meals controls + allergen flash"
            value={form.mealsEnabled}
            onChange={(v) => saveField("mealsEnabled", v)}
            saving={savingKey === "mealsEnabled"}
          />
          <ToggleRow
            emoji="📸"
            tone={BLUSH}
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
        emoji="🕐"
        tone={MINT}
        surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
        title="Daily Schedule"
        description="Drives attendance + pickup expectations"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Day mode tiles */}
          <div>
            <FieldLabel emoji="📅">Day mode</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {dayModes.map((d) => {
                const selected = form.dayMode === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => saveField("dayMode", d.key)}
                    disabled={savingKey === "dayMode"}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "12px 6px",
                      borderRadius: 16,
                      background: selected
                        ? `linear-gradient(135deg, ${d.tone}1f, ${d.tone}0f)`
                        : "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${d.tone}, ${PILLOW}`
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
                      {d.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: selected ? d.tone : "#475569",
                      }}
                    >
                      {d.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Times */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <FieldLabel emoji="🌅">Arrival time</FieldLabel>
              <PillowInput
                type="time"
                value={form.arrivalTime || ""}
                onChange={(v) => setForm({ ...form, arrivalTime: v })}
                onBlur={() => saveField("arrivalTime", form.arrivalTime)}
              />
            </div>
            <div>
              <FieldLabel emoji="🌙">Dismissal time</FieldLabel>
              <PillowInput
                type="time"
                value={form.dismissalTime || ""}
                onChange={(v) => setForm({ ...form, dismissalTime: v })}
                onBlur={() => saveField("dismissalTime", form.dismissalTime)}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Class allergens */}
      <Section
        emoji="🛟"
        tone={RED}
        surface="linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
        title="Class-wide Allergens"
        description="Trigger allergen flash on meals page even if no specific child has them flagged. Useful for picnic day caution."
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <PillowInput
            value={allergenInput}
            onChange={setAllergenInput}
            onKeyDown={(e) => e.key === "Enter" && addAllergen()}
            placeholder="e.g. peanuts, gluten, shellfish"
            maxLength={40}
          />
          <button
            type="button"
            onClick={addAllergen}
            disabled={!allergenInput.trim() || savingKey === "classAllergens"}
            style={{
              padding: "12px 18px",
              borderRadius: 16,
              background:
                !allergenInput.trim() || savingKey === "classAllergens"
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${RED}, #DC2626)`,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor:
                !allergenInput.trim() || savingKey === "classAllergens"
                  ? "default"
                  : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow:
                !allergenInput.trim() || savingKey === "classAllergens"
                  ? "none"
                  : `0 8px 18px -6px ${RED}66`,
              flexShrink: 0,
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            Add
          </button>
        </div>
        {form.classAllergens.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: "#64748B",
              fontStyle: "italic",
              padding: "8px 0",
            }}
          >
            No class-wide allergens set. Per-child allergens still trigger.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {form.classAllergens.map((a, idx) => (
              <button
                key={a}
                type="button"
                onClick={() => removeAllergen(a)}
                title="Tap to remove"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 800,
                  color: RED,
                  background: "#fff",
                  padding: "5px 10px 5px 12px",
                  borderRadius: 999,
                  textTransform: "capitalize",
                  boxShadow: `inset 0 0 0 1px ${RED}33, 0 2px 6px rgba(239,68,68,0.10)`,
                  transform: `rotate(${idx % 2 === 0 ? "-1.5deg" : "1.5deg"})`,
                  border: "none",
                  cursor: "pointer",
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                ⚠️ {a}
                <X size={11} strokeWidth={2.6} color={RED} style={{ opacity: 0.7 }} />
              </button>
            ))}
          </div>
        )}
      </Section>

      <p
        style={{
          fontSize: 10,
          textAlign: "center",
          color: "#94A3B8",
          fontWeight: 600,
          paddingTop: 8,
        }}
      >
        💾 Settings auto-save on change. Last updated by{" "}
        {form.updatedByName || "you"}.
      </p>
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

function Section({
  emoji,
  tone,
  surface,
  title,
  description,
  children,
}: {
  emoji: string;
  tone: string;
  surface: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 16,
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 18,
              transform: "rotate(-6deg)",
              display: "inline-block",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
            }}
            aria-hidden
          >
            {emoji}
          </span>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: tone,
              letterSpacing: "-0.2px",
            }}
          >
            {title}
          </h2>
        </div>
        {description && (
          <p
            style={{
              fontSize: 11,
              color: "#64748B",
              lineHeight: 1.55,
              marginBottom: 12,
            }}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  emoji,
  tone,
  label,
  sub,
  value,
  onChange,
  saving,
}: {
  emoji: string;
  tone: string;
  label: string;
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
  saving?: boolean;
}) {
  return (
    <label
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 16,
        background: value
          ? `linear-gradient(135deg, ${MINT}1f, ${MINT}0f)`
          : "#fff",
        boxShadow: value
          ? `inset 0 0 0 2px ${MINT}, 0 4px 10px ${MINT}1f`
          : "inset 0 0 0 1px #E2E8F0",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: value
            ? `linear-gradient(135deg, ${tone}, ${tone}cc)`
            : `${tone}1f`,
          color: value ? "#fff" : tone,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          boxShadow: value ? `0 6px 14px ${tone}44` : "none",
          transform: value ? "rotate(-6deg)" : "none",
          transition: "transform 200ms ease",
          flexShrink: 0,
        }}
      >
        {emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NAVY,
            letterSpacing: "-0.2px",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#64748B",
            marginTop: 2,
          }}
        >
          {sub}
        </p>
      </div>
      {saving ? (
        <Loader2 size={16} className="animate-spin" color="#94A3B8" />
      ) : (
        <SherbetToggle checked={value} onChange={onChange} tone={MINT} />
      )}
    </label>
  );
}

function SherbetToggle({
  checked,
  onChange,
  tone,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        background: checked
          ? `linear-gradient(135deg, ${tone}, #059669)`
          : "#CBD5E1",
        border: "none",
        cursor: "pointer",
        position: "relative",
        boxShadow: checked
          ? `inset 0 1px 2px rgba(15,23,42,0.06), 0 4px 10px ${tone}44`
          : "inset 0 1px 2px rgba(15,23,42,0.12)",
        transition: "background 200ms ease",
        flexShrink: 0,
      }}
      aria-checked={checked}
      role="switch"
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 2px 4px rgba(15,23,42,0.18)",
          transition: "left 200ms cubic-bezier(.34,1.56,.64,1)",
        }}
      />
    </button>
  );
}

function PillowInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  maxLength,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      maxLength={maxLength}
      type={type}
      style={{
        flex: 1,
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

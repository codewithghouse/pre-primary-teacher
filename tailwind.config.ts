import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        edu: {
          navy: "#1e3272",
          "navy-light": "#2d4393",
          blue: "#0055FF",
          green: "#10B981",
          yellow: "#F59E0B",
          red: "#EF4444",
          orange: "#F97316",
          pink: "#EC4899",
          "light-blue": "#DBEAFE",
          "light-green": "#D1FAE5",
          "light-yellow": "#FEF3C7",
          "light-red": "#FEE2E2",
          "light-orange": "#FED7AA",
        },
        // Mood colors for arrival check-in
        mood: {
          happy: "#10B981",
          ok: "#3B82F6",
          crying: "#F59E0B",
          sleepy: "#A855F7",
          unwell: "#EF4444",
        },
        // Rubric colors for milestones (NEP 2020)
        rubric: {
          beginning: "#EF4444",
          developing: "#F59E0B",
          achieving: "#10B981",
          excelling: "#F59E0B",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "mood-bob": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-3px) rotate(-2deg)" },
        },
        "mood-pop": {
          "0%": { transform: "scale(0.6) rotate(-12deg)" },
          "55%": { transform: "scale(1.25) rotate(8deg)" },
          "100%": { transform: "scale(1) rotate(0deg)" },
        },
        "mood-wiggle": {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "25%": { transform: "rotate(-8deg) scale(1.08)" },
          "75%": { transform: "rotate(8deg) scale(1.08)" },
        },
        "mood-glow": {
          "0%, 100%": { boxShadow: "0 6px 16px var(--mood-glow, rgba(0,0,0,0.2))" },
          "50%": { boxShadow: "0 10px 28px var(--mood-glow, rgba(0,0,0,0.35))" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "mood-bob": "mood-bob 2.4s ease-in-out infinite",
        "mood-pop": "mood-pop 420ms cubic-bezier(.34,1.56,.64,1)",
        "mood-wiggle": "mood-wiggle 600ms ease-in-out",
        "mood-glow": "mood-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

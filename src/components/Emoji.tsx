import { useMemo } from "react";

/* Google's Noto Animated Emoji — actually animated (tears fall on 😭, eyes
   blink on 😴, etc.), same family Google/WhatsApp use. Served as animated
   WebP from Google Fonts' static CDN. Renders the same on every OS.
   Fallback to static Twemoji SVG if the animated source fails. */
const NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest";
const TWEMOJI = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

function codePointFor(emoji: string): string {
  const cps: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    if (cp === 0xfe0f) continue;
    cps.push(cp.toString(16));
  }
  return cps.join("_");
}

function twemojiCp(emoji: string): string {
  const cps: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    if (cp === 0xfe0f) continue;
    cps.push(cp.toString(16));
  }
  return cps.join("-");
}

interface EmojiProps {
  emoji: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  /** Set false to render static Twemoji SVG instead of the animated WebP. */
  animated?: boolean;
}

export function Emoji({
  emoji,
  size = 22,
  style,
  className,
  title,
  animated = true,
}: EmojiProps) {
  const notoUrl = useMemo(
    () => `${NOTO}/${codePointFor(emoji)}/512.webp`,
    [emoji]
  );
  const twUrl = useMemo(() => `${TWEMOJI}/${twemojiCp(emoji)}.svg`, [emoji]);

  return (
    <img
      src={animated ? notoUrl : twUrl}
      alt={emoji}
      title={title ?? emoji}
      width={size}
      height={size}
      draggable={false}
      onError={(e) => {
        // If animated WebP isn't available for this emoji, fall back to static Twemoji.
        const img = e.currentTarget;
        if (img.src !== twUrl) img.src = twUrl;
      }}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        userSelect: "none",
        ...style,
      }}
      className={className}
    />
  );
}

import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { c, font, VO_DELAY } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Rise-and-fade entrance starting at `at` seconds. */
export const Enter: React.FC<{ at?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at = 0, y = 40, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at * fps, fps, config: { damping: 200 } });
  return <div style={{ opacity: p, translate: `0px ${(1 - p) * y}px`, ...style }}>{children}</div>;
};

/** Navy stage with the app's ambient grid and glows. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${c.bg} 0%, ${c.deep} 70%)`, fontFamily: font, color: c.text }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${c.line} 1px, transparent 1px), linear-gradient(90deg, ${c.line} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          opacity: 0.25,
          maskImage: "radial-gradient(70% 60% at 50% 40%, black, transparent)",
        }}
      />
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", left: -200 + Math.sin(frame / 90) * 40, top: -300, background: c.azure, filter: "blur(220px)", opacity: 0.28 }} />
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", right: -150, bottom: -250 + Math.cos(frame / 80) * 40, background: c.coral, filter: "blur(240px)", opacity: 0.16 }} />
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Subtitles: the narration split into sentences, each shown for its share of the voiceover. */
export const Captions: React.FC<{ text: string; voSec: number }> = ({ text, voSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const parts = text.split(/(?<=[.?!…:])\s+/).filter(Boolean);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const t = frame / fps - VO_DELAY;
  let acc = 0;
  let current = "";
  for (const p of parts) {
    const start = (acc / total) * voSec;
    acc += p.length;
    const end = (acc / total) * voSec;
    if (t >= start && t < end + 0.25) current = p;
  }
  if (!current) return null;
  return (
    <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ background: "rgba(7,22,41,0.78)", border: `1px solid ${c.line}`, borderRadius: 16, padding: "14px 28px", fontSize: 34, fontWeight: 500, maxWidth: 1500, textAlign: "center", lineHeight: 1.3 }}>
        {current}
      </div>
    </div>
  );
};

/** The app's fuel gauge. `level` 0 = E, 1 = F. */
export const Gauge: React.FC<{ level: number; label: string; size?: number; empty?: boolean }> = ({ level, label, size = 520, empty }) => {
  const angle = -90 + level * 180;
  const ticks = Array.from({ length: 9 }, (_, i) => -90 + i * 22.5);
  return (
    <div style={{ width: size, textAlign: "center" }}>
      <svg viewBox="0 0 220 128" style={{ width: size }}>
        <path d="M 20 112 A 90 90 0 0 1 200 112" fill="none" stroke={c.line} strokeWidth={10} strokeLinecap="round" />
        <path d="M 20 112 A 90 90 0 0 1 38 58" fill="none" stroke={c.empty} strokeWidth={10} strokeLinecap="round" />
        {ticks.map((t) => (
          <line key={t} x1="110" y1="30" x2="110" y2={t % 45 === 0 ? 42 : 37} transform={`rotate(${t} 110 112)`} stroke={c.dim} strokeWidth={2} />
        ))}
        <text x="10" y="126" fill={c.muted} fontSize={13} fontWeight={600}>E</text>
        <text x="200" y="126" fill={c.muted} fontSize={13} fontWeight={600}>F</text>
        <g style={{ transformOrigin: "110px 112px", rotate: `${angle}deg` }}>
          <line x1="110" y1="112" x2="110" y2="38" stroke={c.coral} strokeWidth={4} strokeLinecap="round" />
        </g>
        <circle cx="110" cy="112" r="7" fill={c.text} />
      </svg>
      <div style={{ fontSize: size / 13, fontWeight: 500, color: empty ? c.coral : c.text, marginTop: 8 }}>{label}</div>
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: "rgba(11,31,58,0.72)", border: `1px solid ${c.line}`, borderRadius: 32, padding: 40, boxShadow: "0 40px 120px rgba(0,0,0,0.45)", backdropFilter: "blur(20px)", ...style }}>
    {children}
  </div>
);

export const Pill: React.FC<{ children: React.ReactNode; active?: boolean; style?: React.CSSProperties }> = ({ children, active, style }) => (
  <div style={{ padding: "14px 26px", borderRadius: 999, fontSize: 28, fontWeight: 500, background: active ? c.coral : c.glass, color: active ? c.bg : c.text, border: `1px solid ${active ? c.coral : c.line}`, ...style }}>
    {children}
  </div>
);

/** Types `text` from `at` seconds at `cps` characters per second. */
export const useTyped = (text: string, at: number, cps = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.floor(interpolate(frame, [at * fps, (at + text.length / cps) * fps], [0, text.length], clamp));
  return text.slice(0, n);
};

export const ease = (frame: number, from: number, to: number, out: [number, number]) =>
  interpolate(frame, [from, to], out, { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });

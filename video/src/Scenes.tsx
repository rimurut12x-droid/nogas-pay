import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { c } from "./theme";
import { Card, Enter, Gauge, Pill, ease, useTyped } from "./ui";

const center: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 48, paddingBottom: 120 };

/* 1. Hook: a wallet with USDT and no gas. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pressed = frame > 4.6 * fps;
  const shake = pressed && frame < 5.4 * fps ? Math.sin(frame * 2.2) * 14 : 0;
  return (
    <AbsoluteFill style={center}>
      <Enter>
        <Card style={{ width: 760, translate: `${shake}px 0px` }}>
          <div style={{ fontSize: 28, color: c.muted }}>My wallet · X Layer</div>
          <Row k="USDT" v="20.00" />
          <Row k="OKB" v="0.0000" warn />
          <div style={{ marginTop: 32, padding: "22px 0", borderRadius: 999, textAlign: "center", fontSize: 32, fontWeight: 600, background: pressed ? c.glass : c.azure, color: c.text }}>
            Send USDT
          </div>
        </Card>
      </Enter>
      <Enter at={5}>
        <div style={{ background: "rgba(179,49,58,0.18)", border: `1px solid ${c.empty}`, color: c.coral, borderRadius: 20, padding: "20px 34px", fontSize: 36, fontWeight: 500 }}>
          Insufficient OKB for gas fee
        </div>
      </Enter>
    </AbsoluteFill>
  );
};

const Row: React.FC<{ k: string; v: string; warn?: boolean }> = ({ k, v, warn }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 52, fontWeight: 500, marginTop: 24 }}>
    <span>{k}</span>
    <span style={{ color: warn ? c.coral : c.text }}>{v}</span>
  </div>
);

/* 2. The detour everyone takes today. */
export const Detour: React.FC = () => {
  const steps = ["Buy OKB on an exchange", "Withdraw to X Layer", "Wait", "Pay more than you send"];
  return (
    <AbsoluteFill style={center}>
      <Enter>
        <div style={{ fontSize: 84, fontWeight: 600, letterSpacing: -2 }}>To send $20, first…</div>
      </Enter>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        {steps.map((s, i) => (
          <Enter key={s} at={0.8 + i * 1.6}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <Card style={{ padding: "28px 32px", fontSize: 32, fontWeight: 500, width: 330, textAlign: "center", color: i === 3 ? c.coral : c.text }}>{s}</Card>
              {i < 3 && <div style={{ fontSize: 40, color: c.dim }}>›</div>}
            </div>
          </Enter>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* 3. Product intro with the empty gauge. */
export const Intro: React.FC = () => (
  <AbsoluteFill style={center}>
    <Enter>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Logo size={96} />
        <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: -4 }}>NoGas Pay</div>
      </div>
    </Enter>
    <Enter at={0.8}>
      <div style={{ fontSize: 44, color: c.muted }}>Send stablecoins on X Layer with an empty gas tank.</div>
    </Enter>
    <Enter at={4}>
      <Gauge level={0} label="Empty tank" empty size={440} />
    </Enter>
  </AbsoluteFill>
);

export const Logo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <rect width="48" height="48" rx="14" fill={c.coral} />
    <path d="M14 33 V15 L34 33 V15" fill="none" stroke={c.bg} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* 4. The send flow in the app. */
export const SendFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokenIdx = frame < 1.2 * fps ? 0 : frame < 2.2 * fps ? 2 : 1; // walks USDT, USDG, settles on USDC
  const amount = useTyped("1", 3.2, 6);
  const to = useTyped("0x4f2A…c19E", 4.4, 14);
  const signing = frame > 7 * fps && frame < 10.5 * fps;
  const sent = frame >= 10.5 * fps;
  return (
    <AbsoluteFill style={{ ...center, flexDirection: "row", gap: 80, paddingBottom: 230 }}>
      <Enter>
        <Card style={{ width: 820, padding: 34 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <Pill active>Send</Pill>
            <Pill>Fill up</Pill>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
            {["USDT0", "USDC", "USDG"].map((t, i) => (
              <Pill key={t} style={{ flex: 1, textAlign: "center", border: `2px solid ${i === tokenIdx ? c.azure : c.line}` }}>{t}</Pill>
            ))}
          </div>
          <div style={{ marginTop: 30, fontSize: 24, color: c.muted }}>You send</div>
          <div style={{ fontSize: 80, fontWeight: 500, letterSpacing: -3, minHeight: 96 }}>{amount || "0"}<span style={{ fontSize: 40, color: c.muted }}> USDC</span></div>
          <div style={{ marginTop: 10, fontSize: 24, color: c.muted }}>To</div>
          <div style={{ fontSize: 34, padding: "16px 22px", borderRadius: 16, background: c.glass, border: `1px solid ${c.line}`, minHeight: 42 }}>{to}</div>
          <div style={{ marginTop: 26, display: "grid", gap: 10, fontSize: 28 }}>
            <Line k="Fee" v={<span style={{ color: c.ok }}>Free, your first send</span>} />
            <Line k="Gas you pay" v="0 OKB" />
          </div>
          <div style={{ marginTop: 30, padding: "24px 0", borderRadius: 999, textAlign: "center", fontSize: 34, fontWeight: 600, background: sent ? c.ok : c.coral, color: c.bg }}>
            {sent ? "Sent 1 USDC ✓" : signing ? "NoGas Pay is paying the gas…" : "Sign and send"}
          </div>
        </Card>
      </Enter>
      <div style={{ width: 620, display: "grid", gap: 28 }}>
        {["One signature", "No approval", "No gas", "Fee taken from the token"].map((s, i) => (
          <Enter key={s} at={6.6 + i * 1.1} y={20}>
            <div style={{ fontSize: 48, fontWeight: 500, display: "flex", gap: 20, alignItems: "center" }}>
              <span style={{ color: c.coral }}>●</span>{s}
            </div>
          </Enter>
        ))}
      </div>
      {signing && frame < 9 * fps && (
        <div style={{ position: "absolute", right: 200, top: 140 }}>
          <Enter at={7}>
            <Card style={{ width: 520, padding: 32, fontSize: 28 }}>
              <div style={{ fontWeight: 600, fontSize: 32 }}>Signature request</div>
              <div style={{ color: c.muted, marginTop: 10 }}>ReceiveWithAuthorization · 1 USDC</div>
              <div style={{ marginTop: 24, padding: "16px 0", borderRadius: 999, textAlign: "center", background: c.azure, fontWeight: 600 }}>Sign</div>
            </Card>
          </Enter>
        </div>
      )}
    </AbsoluteFill>
  );
};

const Line: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span style={{ color: c.muted }}>{k}</span>
    <span style={{ fontWeight: 500 }}>{v}</span>
  </div>
);

/* 5. The real mainnet send (no addresses or hash shown). */
export const Proof: React.FC = () => (
  <AbsoluteFill style={center}>
    <Enter>
      <div style={{ fontSize: 30, color: c.ok, fontWeight: 600 }}>● Confirmed on X Layer mainnet</div>
    </Enter>
    <Enter at={0.5}>
      <Card style={{ width: 1400, fontSize: 40 }}>
        <div style={{ display: "grid", gap: 22 }}>
          <Line k="Sender's OKB balance" v={<span style={{ color: c.coral }}>0 OKB</span>} />
          <Line k="Sender → NoGas Pay" v="1.0 USDC" />
          <Line k="NoGas Pay → Recipient" v="1.0 USDC" />
          <Line k="Fee" v={<span style={{ color: c.ok }}>0 (first send)</span>} />
          <Line k="Gas paid by relayer" v="0.0000054 OKB" />
        </div>
      </Card>
    </Enter>
  </AbsoluteFill>
);

/* 6. Fill up: stablecoin becomes OKB, needle swings E → F. */
export const FillUp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const level = ease(frame, 2 * fps, 5 * fps, [0, 0.85]);
  return (
    <AbsoluteFill style={{ ...center, flexDirection: "row", gap: 120 }}>
      <Enter>
        <Card style={{ width: 560, textAlign: "center" }}>
          <div style={{ fontSize: 30, color: c.muted }}>Fill up</div>
          <div style={{ fontSize: 88, fontWeight: 500, marginTop: 10 }}>2 USDC</div>
          <div style={{ fontSize: 44, color: c.dim, margin: "14px 0" }}>↓</div>
          <div style={{ fontSize: 56, fontWeight: 500, color: c.ok }}>OKB in your wallet</div>
        </Card>
      </Enter>
      <Enter at={0.6}>
        <Gauge level={level} label={level > 0.8 ? "Tank filled" : "Filling…"} size={560} />
      </Enter>
    </AbsoluteFill>
  );
};

/* 7. The TapeOut security circuit: 6 inputs, 26 NAND gates, 3 outputs. */
export const Circuit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inputs = ["amount bucket", "amount bucket", "requests today", "requests today", "is fill up", "first time"];
  const outputs = ["allow", "tier", "tier"];
  const lit = Math.floor(ease(frame, 1.5 * fps, 7 * fps, [0, 26]));
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 90, gap: 40 }}>
      <Enter>
        <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: -2 }}>Security circuit on TapeOut</div>
      </Enter>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {inputs.map((s, i) => (
            <Enter key={i} at={0.4 + i * 0.12} y={10}>
              <div style={{ fontSize: 28, color: c.muted, textAlign: "right" }}>{s} ▸</div>
            </Enter>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(13, 74px)", gap: 16 }}>
          {Array.from({ length: 26 }, (_, i) => (
            <div key={i} style={{ height: 74, borderRadius: "10px 37px 37px 10px", border: `2px solid ${i < lit ? c.coral : c.line}`, background: i < lit ? "rgba(255,111,97,0.18)" : c.glass, fontSize: 16, color: c.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
              NAND
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          {outputs.map((s, i) => (
            <Enter key={i} at={7 + i * 0.2} y={10}>
              <div style={{ fontSize: 30, fontWeight: 500, color: i === 0 ? c.ok : c.text }}>▸ {s}</div>
            </Enter>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {["Max $10,000 per send", "10 requests per wallet per day", "Fill up up to $10", "Fee tier: free · $0.02 · $0.10"].map((s, i) => (
          <Enter key={s} at={8.5 + i * 0.9} y={20}>
            <Pill>{s}</Pill>
          </Enter>
        ))}
      </div>
      <Enter at={13}>
        <Card style={{ padding: "22px 36px", fontSize: 26, display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ color: c.coral, fontWeight: 600 }}>Pinned netlist hash</span>
          <span style={{ color: c.muted }}>0x49d19ee7…ec3adab6a</span>
        </Card>
      </Enter>
    </AbsoluteFill>
  );
};

/* 8. Business model and roadmap. */
export const Business: React.FC = () => (
  <AbsoluteFill style={center}>
    <div style={{ display: "flex", gap: 60 }}>
      <Enter>
        <Card style={{ width: 560, textAlign: "center" }}>
          <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: -4, color: c.coral }}>$0.02</div>
          <div style={{ fontSize: 34, color: c.muted }}>fee per send</div>
        </Card>
      </Enter>
      <Enter at={2.2}>
        <Card style={{ width: 560, textAlign: "center" }}>
          <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: -4 }}>&lt;$0.001</div>
          <div style={{ fontSize: 34, color: c.muted }}>gas on X Layer</div>
        </Card>
      </Enter>
    </div>
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <Enter at={6.5}><div style={{ fontSize: 36, color: c.muted }}>Next</div></Enter>
      {["More tokens", "BNB Chain", "API for apps"].map((s, i) => (
        <Enter key={s} at={7 + i * 1.2} y={20}><Pill>{s}</Pill></Enter>
      ))}
    </div>
  </AbsoluteFill>
);

/* 9. Close. */
export const Close: React.FC = () => (
  <AbsoluteFill style={center}>
    <Enter>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Logo size={120} />
        <div style={{ fontSize: 140, fontWeight: 600, letterSpacing: -5 }}>NoGas Pay</div>
      </div>
    </Enter>
    <Enter at={1.2}>
      <div style={{ fontSize: 64, fontWeight: 500 }}>Send stablecoins. <span style={{ color: c.coral }}>Skip the gas.</span></div>
    </Enter>
    <Enter at={3.4}>
      <Pill active style={{ fontSize: 40, padding: "20px 40px" }}>nogas-pay.vercel.app</Pill>
    </Enter>
    <Enter at={4.5}>
      <div style={{ fontSize: 28, color: c.dim }}>Built on X Layer with TapeOut</div>
    </Enter>
  </AbsoluteFill>
);

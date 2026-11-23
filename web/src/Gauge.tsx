/** Fuel gauge for the wallet's OKB. The needle sits on E when the wallet can't pay gas. */
const FULL_OKB = 0.01; // enough for thousands of X Layer transactions

export function Gauge({ okb }: { okb: number | null }) {
  const level = okb === null ? 0 : Math.min(okb / FULL_OKB, 1);
  const angle = -90 + level * 180;
  const empty = okb !== null && okb === 0;
  const label = okb === null ? "Connect a wallet to read your tank" : empty ? "Empty tank" : `${okb.toFixed(5)} OKB`;
  const ticks = Array.from({ length: 9 }, (_, i) => -90 + i * 22.5);

  return (
    <figure className={`gauge${empty ? " gauge--empty" : ""}`} aria-label={`OKB gas tank: ${label}`}>
      <svg viewBox="0 0 220 128" role="img" aria-hidden="true">
        <path d="M 20 112 A 90 90 0 0 1 200 112" className="gauge__arc" />
        <path d="M 20 112 A 90 90 0 0 1 38 58" className="gauge__arc gauge__arc--red" />
        {ticks.map((t) => (
          <line key={t} x1="110" y1="30" x2="110" y2={t % 45 === 0 ? 42 : 37} transform={`rotate(${t} 110 112)`} className="gauge__tick" />
        ))}
        <text x="14" y="126" className="gauge__letter">E</text>
        <text x="196" y="126" className="gauge__letter">F</text>
        <g className="gauge__needle" style={{ transform: `rotate(${angle}deg)` }}>
          <line x1="110" y1="112" x2="110" y2="38" />
        </g>
        <circle cx="110" cy="112" r="7" className="gauge__hub" />
      </svg>
      <figcaption className={okb === null ? "gauge__hint" : undefined}>{label}</figcaption>
    </figure>
  );
}

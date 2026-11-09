import { useEffect, useState } from 'react';

const TONE_MAP = {
  primary: { rgb: '38, 98, 217', text: 'text-primary', dot: 'fill-primary' },
  success: { rgb: '43, 171, 110', text: 'text-green-700', dot: 'fill-green-600' },
  warning: { rgb: '245, 158, 11', text: 'text-amber-700', dot: 'fill-amber-500' },
  danger:  { rgb: '220, 38, 38',  text: 'text-red-700',   dot: 'fill-red-600' },
};

const DOTS = [
  { cx: 14, cy: 14, d: '0.54s' },
  { cx: 38, cy: 14, d: '0.36s' },
  { cx: 62, cy: 14, d: '0.18s' },
  { cx: 86, cy: 14, d: '0s' },
  { cx: 38, cy: 38, d: '0.54s' },
  { cx: 62, cy: 38, d: '0.36s' },
  { cx: 86, cy: 38, d: '0.18s' },
  { cx: 62, cy: 62, d: '0.54s' },
  { cx: 86, cy: 62, d: '0.36s' },
  { cx: 86, cy: 86, d: '0.54s' },
];

export default function StatCardAuditoriaPix({ title, displayValue, suffix, detail1Label, detail1Value, detail2Label, detail2Value, tone = 'primary' }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const t = TONE_MAP[tone] || TONE_MAP.primary;

  return (
    <div
      className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-all"
      style={{
        backgroundImage: `radial-gradient(125% 125% at 100% 0%, rgba(${t.rgb}, 0.18) 0%, rgba(${t.rgb}, 0.06) 35%, rgba(${t.rgb}, 0) 68%)`,
      }}
    >
      <div className="relative flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground leading-snug">{title}</h3>
        <svg className={`w-8 h-8 shrink-0 ${t.dot}`} aria-hidden="true" viewBox="0 0 100 100">
          {DOTS.map((dot, idx) => (
            <circle
              key={idx}
              cx={dot.cx}
              cy={dot.cy}
              r="9"
              style={{
                opacity: revealed ? 1 : 0.25,
                transform: revealed ? 'scale(1)' : 'scale(0.82)',
                transformOrigin: 'center',
                transformBox: 'fill-box',
                transition: `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${dot.d}, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${dot.d}`,
              }}
            />
          ))}
        </svg>
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline leading-none tracking-tight tabular-nums">
          <span className={`text-2xl sm:text-3xl font-bold ${t.text}`}>{displayValue}</span>
          {suffix && <span className="ml-1 text-xs font-semibold text-muted-foreground">{suffix}</span>}
        </div>

        <dl className="flex flex-wrap gap-x-4 gap-y-1 m-0 p-0">
          {detail1Label && (
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground leading-tight">{detail1Label}</dt>
              <dd className="text-xs font-semibold text-foreground tabular-nums leading-tight">{detail1Value}</dd>
            </div>
          )}
          {detail2Label && (
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground leading-tight">{detail2Label}</dt>
              <dd className="text-xs font-semibold text-foreground tabular-nums leading-tight">{detail2Value}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
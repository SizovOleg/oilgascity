// Графики справочного слоя: горизонтальные полосы и «было и стало». Простой SVG без библиотек.
import { InlineHtml, Source } from './Common';

const COLORS = { green: '#1E3329', tape: '#C2410C', lake: '#1F5C7A', ink: '#14242B' };

function Bar({ pct, color }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="100" height="10" fill="#fff" />
      <rect x="0" y="0" width={w} height="10" fill={COLORS[color] || COLORS.green} />
      <path d="M25 0V10M50 0V10M75 0V10" stroke="#C5CCC8" strokeWidth="0.4" />
    </svg>
  );
}

export function BarChart({ value }) {
  const n = value._fig;
  return (
    <figure className="chart" id={value.anchor || (n ? `fig-${n}` : undefined)}>
      {value.anchor && n ? <span id={`fig-${n}`} /> : null}
      <h4>{value.title}</h4>
      <ul className="hb">
        {value.rows.map((r, i) => (
          <li key={i}><span className="lab">{r.label}</span><Bar pct={r.pct} color={r.color} /><b>{r.value}</b></li>
        ))}
      </ul>
      <figcaption className="slate">{n ? <b>Рис. {n}.</b> : null} {value.caption}<Source text={value.source} /></figcaption>
    </figure>
  );
}

const fmt = (v) => String(v).replace('.', ',');

export function PairChart({ value }) {
  const n = value._fig;
  const series = value.series || [];
  const all = series.flatMap((s) => [s.start, s.end]);
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 0);
  const pad = (hi - lo) * 0.08 || 1;
  const top = 20;
  const bottom = 262;
  const y = (v) => bottom - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (bottom - top);
  const x1 = 70;
  const x2 = 230;
  const label = series.map((s) => `${s.label}: с ${fmt(s.start)} до ${fmt(s.end)} ${s.unit || ''}`).join('; ');
  return (
    <figure className="chart" id={value.anchor || (n ? `fig-${n}` : undefined)}>
      {value.anchor && n ? <span id={`fig-${n}`} /> : null}
      <h4>{value.title}</h4>
      <svg className="plot" viewBox="0 0 360 300" role="img" aria-label={`${value.title}. ${label}`}>
        <path d={`M${x1} ${top}V${bottom}M${x2} ${top}V${bottom}`} stroke="#C5CCC8" strokeWidth="1" />
        {lo < 0 && hi > 0 ? (
          <>
            <path d={`M40 ${y(0)}H300`} stroke="#4B5B60" strokeWidth="1" strokeDasharray="4 4" />
            <text x="304" y={y(0) + 4} fontSize="12" fill="#4B5B60">0 {series[0]?.unit || ''}</text>
          </>
        ) : null}
        {series.map((s, i) => {
          const c = COLORS[s.color] || COLORS.ink;
          return (
            <g key={i}>
              <path d={`M${x1} ${y(s.start)}L${x2} ${y(s.end)}`} stroke={c} strokeWidth="3" />
              <circle cx={x1} cy={y(s.start)} r="5" fill="#fff" stroke={c} strokeWidth="2.5" />
              <circle cx={x2} cy={y(s.end)} r="6" fill={c} />
              <text x={x1 - 12} y={y(s.start) + 5} textAnchor="end" fontSize="14" fontWeight="700" fill="#14242B">{fmt(s.start)}</text>
              <text x={x2 + 12} y={y(s.end) + 5} fontSize="14" fontWeight="700" fill="#14242B">{fmt(s.end)}{s.unit ? ` ${s.unit}` : ''}, {s.label}</text>
            </g>
          );
        })}
        <text x={x1} y="286" textAnchor="middle" fontSize="14" fontWeight="700" fill="#14242B">{value.start_label}</text>
        <text x={x2} y="286" textAnchor="middle" fontSize="14" fontWeight="700" fill="#14242B">{value.end_label}</text>
      </svg>
      <figcaption className="slate">{n ? <b>Рис. {n}.</b> : null} {value.caption}<Source text={value.source} /></figcaption>
    </figure>
  );
}

export function PlateValue({ value }) {
  if (!value) return null;
  return <span className="found">{value}</span>;
}

export { InlineHtml };

import { useState } from 'react';
import { Link } from 'react-router-dom';

const COST_PER_SCAN = 0.013;

export interface TimelinePoint {
  date: string;
  scans: number;
  credits: number;
}

function dualLinePath(
  data: TimelinePoint[],
  pad: { left: number; right: number; top: number; bottom: number },
  innerW: number,
  innerH: number,
  key: 'scans' | 'credits',
  max1: number,
  max2: number
): string {
  return data
    .map((d, i) => {
      const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
      const y = pad.top + innerH - (d[key] / (key === 'scans' ? max1 : max2)) * innerH;
      return `${x},${y}`;
    })
    .join(' L ');
}

interface DualLineChartProps {
  timeline: TimelinePoint[];
  period: number;
  onPeriodChange?: (p: number) => void;
}

export default function DualLineChart({ timeline, period, onPeriodChange }: DualLineChartProps) {
  const data = [...timeline].reverse();
  const scansMax = Math.max(...data.map((d) => d.scans), 1);
  const creditsMax = Math.max(...data.map((d) => d.credits), 1);
  const w = 640;
  const h = 200;
  const pad = { top: 24, right: 24, bottom: 32, left: 44 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const pathScans = data.length ? `M ${dualLinePath(data, pad, innerW, innerH, 'scans', scansMax, creditsMax)}` : '';
  const pathCredits = data.length
    ? `M ${data
        .map((d, i) => {
          const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
          const y = pad.top + innerH - (d.credits / creditsMax) * innerH;
          return `${x},${y}`;
        })
        .join(' L ')}`
    : '';

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hover = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div className="brutal-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>Scan e crediti per giorno</h3>
        {onPeriodChange && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[7, 30, 90].map((p) => (
              <button
                key={p}
                type="button"
                className={`brutal-btn ${period === p ? 'primary' : ''}`}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => onPeriodChange(p)}
              >
                {p}d
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <svg viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', height: 'auto' }}>
            <path
              d={pathScans}
              fill="none"
              stroke="var(--black)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ vectorEffect: 'non-scaling-stroke' }}
            />
            <path
              d={pathCredits}
              fill="none"
              stroke="var(--yellow)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ vectorEffect: 'non-scaling-stroke' }}
            />
            {data.map((d, i) => {
              const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
              const yScans = pad.top + innerH - (d.scans / scansMax) * innerH;
              const yCredits = pad.top + innerH - (d.credits / creditsMax) * innerH;
              return (
                <g key={d.date}>
                  <rect
                    x={x - 10}
                    y={pad.top}
                    width={20}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                  <circle cx={x} cy={yScans} r={4} fill="var(--black)" stroke="var(--white)" strokeWidth={2} />
                  <circle cx={x} cy={yCredits} r={4} fill="var(--yellow)" stroke="var(--black)" strokeWidth={2} />
                </g>
              );
            })}
            {data.map((d, i) => (
              <text
                key={d.date}
                x={pad.left + (i / (data.length - 1 || 1)) * innerW}
                y={h - 8}
                textAnchor="middle"
                fontSize="9"
                fill="var(--black)"
                fontFamily="var(--font-mono)"
              >
                {new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
              </text>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: '1rem', marginTop: 6, fontSize: '0.7rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--black)' }} /> Scan
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--yellow)', border: '2px solid var(--black)' }} /> Crediti
            </span>
          </div>
        </div>
        {hover && (
          <div className="brutal-card" style={{ minWidth: 180, padding: '0.5rem 0.75rem' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{new Date(hover.date).toLocaleDateString('it-IT')}</div>
            <div>Scan: <strong>{hover.scans}</strong></div>
            <div>Crediti: <strong>{hover.credits}</strong></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>~${(hover.scans * COST_PER_SCAN).toFixed(2)}</div>
            <Link to="/credits" state={{ highlightDate: hover.date }} style={{ display: 'inline-block', marginTop: 6, fontSize: '0.8rem' }}>
              Dettaglio crediti →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

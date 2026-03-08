import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const COST_PER_SCAN = 0.013;
const TOOLTIP_LEAVE_DELAY_MS = 220;

export interface TimelinePoint {
  date: string;
  scans: number;
  credits: number;
}

/** Arrotonda il valore più alto a un massimo "pulito" per l'asse Y (es. 7 → 10, 24 → 30). */
function niceMax(val: number): number {
  if (val <= 0) return 5;
  const exp = Math.pow(10, Math.floor(Math.log10(val)));
  const f = val / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return Math.ceil(val / (step * exp)) * step * exp;
}

function dualLinePath(
  data: TimelinePoint[],
  pad: { left: number; right: number; top: number; bottom: number },
  innerW: number,
  innerH: number,
  key: 'scans' | 'credits',
  maxVal: number
): string {
  return data
    .map((d, i) => {
      const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
      const v = key === 'scans' ? d.scans : d.credits;
      const y = pad.top + innerH - (v / maxVal) * innerH;
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
  const maxNice = niceMax(Math.max(scansMax, creditsMax, 1));
  const w = 640;
  const h = 200;
  const pad = { top: 28, right: 28, bottom: 36, left: 52 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const pathScans = data.length ? `M ${dualLinePath(data, pad, innerW, innerH, 'scans', maxNice)}` : '';
  const pathCredits = data.length ? `M ${dualLinePath(data, pad, innerW, innerH, 'credits', maxNice)}` : '';

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number>(0);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hover = hoverIdx != null ? data[hoverIdx] : null;

  useEffect(() => {
    if (hoverIdx == null || !chartWrapRef.current || !svgRef.current || !data.length) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const wrapRect = chartWrapRef.current.getBoundingClientRect();
    const pointX = pad.left + (data.length > 1 ? (hoverIdx / (data.length - 1)) * innerW : innerW / 2);
    const xRatio = pointX / w;
    let left = xRatio * svgRect.width + (svgRect.left - wrapRect.left);
    const tooltipHalf = 100;
    left = Math.max(tooltipHalf, Math.min(wrapRect.width - tooltipHalf, left));
    setTooltipLeft(left);
  }, [hoverIdx, data.length, pad.left, innerW, w]);

  const clearLeaveTimeout = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };
  const handlePointEnter = (i: number) => {
    clearLeaveTimeout();
    setHoverIdx(i);
  };
  const handlePointLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => setHoverIdx(null), TOOLTIP_LEAVE_DELAY_MS);
  };
  const handleTooltipEnter = () => clearLeaveTimeout();
  const handleTooltipLeave = () => setHoverIdx(null);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * maxNice));
  const uniqY = Array.from(new Set(yTicks)).sort((a, b) => a - b);

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
      <div style={{ position: 'relative', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div ref={chartWrapRef} style={{ flex: '1 1 320px', minWidth: 0, position: 'relative', isolation: 'isolate' }}>
          <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', height: 'auto', display: 'block' }}>
            {/* Assi X e Y più visibili */}
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="var(--black)" strokeWidth={2} />
            <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="var(--black)" strokeWidth={2} />
            {/* Valori asse Y (massimo arrotondato) */}
            {uniqY.map((val) => {
              const y = pad.top + innerH - (val / maxNice) * innerH;
              return (
                <g key={val}>
                  <line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke="var(--black)" strokeWidth={1} strokeDasharray="4 2" opacity={0.4} />
                  <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--black)" fontFamily="var(--font-mono)">
                    {val}
                  </text>
                </g>
              );
            })}
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
              const yScans = pad.top + innerH - (d.scans / maxNice) * innerH;
              const yCredits = pad.top + innerH - (d.credits / maxNice) * innerH;
              return (
                <g key={d.date}>
                  <rect
                    x={x - 20}
                    y={pad.top - 4}
                    width={40}
                    height={innerH + 8}
                    fill="transparent"
                    onMouseEnter={() => handlePointEnter(i)}
                    onMouseLeave={handlePointLeave}
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
          {hover && hoverIdx != null && (
            <div
              className="brutal-card"
              role="tooltip"
              style={{
                position: 'absolute',
                top: 8,
                left: tooltipLeft,
                transform: 'translateX(-50%)',
                minWidth: 180,
                maxWidth: 200,
                padding: '0.5rem 0.75rem',
                zIndex: 9999,
                pointerEvents: 'auto',
              }}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={handleTooltipLeave}
            >
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
    </div>
  );
}

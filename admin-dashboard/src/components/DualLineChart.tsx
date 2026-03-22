import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const COST_PER_SCAN = 0.013;
const TOOLTIP_LEAVE_DELAY_MS = 400;
const TOOLTIP_EST_HEIGHT = 110;
const TOOLTIP_GAP_RIGHT = 12;
const TOOLTIP_WIDTH = 200;

export interface TimelinePoint {
  date: string;
  scans: number;
  credits: number;
  kimi_calls?: number;
  kimi_cost_usd?: number;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Arrotonda il valore più alto a un massimo "pulito" per l'asse Y (es. 7 → 10, 24 → 30). */
function niceMax(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 5;
  const exp = Math.pow(10, Math.floor(Math.log10(val)));
  const f = val / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  const out = Math.ceil(val / (step * exp)) * step * exp;
  return Number.isFinite(out) && out > 0 ? out : 5;
}

/** Asse Y sempre valido (mai NaN): scan/crediti non devono sparire se Kimi è a zero o sporco). */
function finiteAxisMax(scansMax: number, creditsMax: number): number {
  const m = Math.max(safeNum(scansMax), safeNum(creditsMax), 1);
  return niceMax(m);
}

type SeriesKey = 'scans' | 'credits' | 'kimi_calls' | 'kimi_cost_usd';

function getSeriesVal(d: TimelinePoint, key: SeriesKey): number {
  if (key === 'scans') return d.scans;
  if (key === 'credits') return d.credits;
  if (key === 'kimi_calls') return d.kimi_calls ?? 0;
  return d.kimi_cost_usd ?? 0;
}

function dualLinePath(
  data: TimelinePoint[],
  pad: { left: number; right: number; top: number; bottom: number },
  innerW: number,
  innerH: number,
  key: SeriesKey,
  maxVal: number
): string {
  if (!Number.isFinite(maxVal) || maxVal <= 0) return '';
  return data
    .map((d, i) => {
      const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
      const v = getSeriesVal(d, key);
      const y = pad.top + innerH - (v / maxVal) * innerH;
      return `${x},${y}`;
    })
    .join(' L ');
}

/** Per giorno: action_type → { count, credits } (per tooltip dettaglio). */
export type ByActionPerDay = Record<string, Record<string, { count: number; credits: number }>>;

interface DualLineChartProps {
  timeline: TimelinePoint[];
  period: number;
  onPeriodChange?: (p: number) => void;
  /** Dettaglio crediti per tipo azione per giorno (opzionale, per tooltip). */
  byActionPerDay?: ByActionPerDay;
  /** Nota sotto il grafico (es. filtro piano + Kimi anonimo). */
  planNote?: string | null;
}

export default function DualLineChart({ timeline, period, onPeriodChange, byActionPerDay, planNote }: DualLineChartProps) {
  const data: TimelinePoint[] = [...timeline]
    .reverse()
    .map((d) => ({
      date: d.date,
      scans: safeNum(d.scans),
      credits: safeNum(d.credits),
      kimi_calls: d.kimi_calls != null ? safeNum(d.kimi_calls) : 0,
      kimi_cost_usd: d.kimi_cost_usd != null ? safeNum(d.kimi_cost_usd) : 0,
    }));

  const scansMax = data.length ? Math.max(...data.map((d) => d.scans), 0) : 0;
  const creditsMax = data.length ? Math.max(...data.map((d) => d.credits), 0) : 0;
  const kimiCallsMax = data.length ? Math.max(...data.map((d) => d.kimi_calls ?? 0), 0) : 0;
  const costMaxRaw = data.length ? Math.max(...data.map((d) => d.kimi_cost_usd ?? 0), 0) : 0;

  /** Asse sinistro: solo scan + crediti. Kimi (anche assente o tutto a zero) non influenza mai questa scala. */
  const primaryMaxNice = finiteAxisMax(scansMax, creditsMax);
  /** Scala separata per la linea rosa Kimi (se c’è almeno un valore > 0). */
  const kimiAxisMaxNice = kimiCallsMax > 0 ? niceMax(Math.max(kimiCallsMax, 1)) : 0;
  const costMaxNice =
    costMaxRaw > 0 ? niceMax(Math.max(costMaxRaw, 0.0001)) : 0.1;

  const hasKimiAxis = kimiCallsMax > 0 && kimiAxisMaxNice > 0;
  /** Con Kimi: più margine sinistro per due colonne numeri (Kimi | Scan/Cr. | asse). */
  const axisX = hasKimiAxis ? 78 : 52;
  const w = hasKimiAxis ? 668 : 640;
  const h = 200;
  const pad = { top: 28, right: 48, bottom: 36, left: axisX };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  /** Colonna esterna (sinistra): scala Kimi chiamate. */
  const kimiLabelX = hasKimiAxis ? pad.left - 34 : 0;
  /** Colonna interna: scan + crediti (come prima, vicino all’asse). */
  const primaryLabelX = pad.left - 6;

  const segScans = data.length ? dualLinePath(data, pad, innerW, innerH, 'scans', primaryMaxNice) : '';
  const segCredits = data.length ? dualLinePath(data, pad, innerW, innerH, 'credits', primaryMaxNice) : '';
  const segKimi = data.length && kimiCallsMax > 0 && kimiAxisMaxNice > 0
    ? dualLinePath(data, pad, innerW, innerH, 'kimi_calls', kimiAxisMaxNice)
    : '';
  const segCost = data.length && costMaxNice > 0
    ? dualLinePath(data, pad, innerW, innerH, 'kimi_cost_usd', costMaxNice)
    : '';

  const pathScans = segScans ? `M ${segScans}` : '';
  const pathCredits = segCredits ? `M ${segCredits}` : '';
  const pathKimiCalls = segKimi ? `M ${segKimi}` : '';
  const pathCost = segCost ? `M ${segCost}` : '';

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number>(0);
  const [tooltipTop, setTooltipTop] = useState<number>(8);
  const [pointXWrap, setPointXWrap] = useState<number>(0);
  const [pointYWrap, setPointYWrap] = useState<number>(0);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hover = hoverIdx != null ? data[hoverIdx] : null;

  useEffect(() => {
    if (hoverIdx == null || !chartWrapRef.current || !svgRef.current || !data.length) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const wrapRect = chartWrapRef.current.getBoundingClientRect();
    const pointX = pad.left + (data.length > 1 ? (hoverIdx / (data.length - 1)) * innerW : innerW / 2);
    const d = data[hoverIdx];
    const maxVal = Math.max(d.scans, d.credits);
    const pointY = pad.top + innerH - (maxVal / primaryMaxNice) * innerH;
    const xRatio = pointX / w;
    const yRatio = pointY / h;
    const px = xRatio * svgRect.width + (svgRect.left - wrapRect.left);
    const py = yRatio * svgRect.height + (svgRect.top - wrapRect.top);
    setPointXWrap(px);
    setPointYWrap(py);
    let left = px + TOOLTIP_GAP_RIGHT;
    let top = py - TOOLTIP_EST_HEIGHT / 2;
    left = Math.max(8, Math.min(wrapRect.width - TOOLTIP_WIDTH - 8, left));
    top = Math.max(6, Math.min(wrapRect.height - TOOLTIP_EST_HEIGHT - 6, top));
    setTooltipLeft(left);
    setTooltipTop(top);
  }, [hoverIdx, data.length, pad.left, pad.top, innerW, innerH, w, h, primaryMaxNice]);

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

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * primaryMaxNice));
  const uniqY = Array.from(new Set(yTicks)).sort((a, b) => a - b);
  const kimiYTicks =
    hasKimiAxis && kimiAxisMaxNice > 0
      ? [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * kimiAxisMaxNice))
      : [];
  const uniqKimiY = Array.from(new Set(kimiYTicks)).sort((a, b) => a - b);
  const costTicks = costMaxNice > 0 ? [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * costMaxNice * 100) / 100) : [];
  const uniqCost = Array.from(new Set(costTicks)).sort((a, b) => a - b);

  return (
    <div className="brutal-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
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
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem', marginTop: 0 }}>
        <strong>Scan</strong> = n° operazioni audit/scan · <strong>Crediti</strong> = crediti consumati nel giorno (tutte le funzioni: audit, a11y_audit, generate, sync, …). Puoi avere crediti senza scan se hai usato altre funzioni.
        {hasKimiAxis ? (
          <>
            {' '}
            <strong>Due assi Y a sinistra:</strong> colonna <span style={{ color: 'var(--pink)', fontWeight: 700 }}>rosa</span> = chiamate Kimi (scala propria); colonna <strong>nera</strong> = scan + crediti (scala condivisa).
          </>
        ) : null}
      </p>
      {planNote ? (
        <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.75rem', marginTop: '-0.5rem', fontStyle: 'italic' }}>
          {planNote}
        </p>
      ) : null}
      <div style={{ position: 'relative', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div ref={chartWrapRef} style={{ flex: '1 1 320px', minWidth: 0, position: 'relative', isolation: 'isolate' }}>
          <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', height: 'auto', display: 'block' }}>
            {/* Assi X e Y più visibili */}
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="var(--black)" strokeWidth={2} />
            <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="var(--black)" strokeWidth={2} />
            {/* Griglia orizzontale + asse Y primario (scan / crediti) */}
            {uniqY.map((val) => {
              const y = pad.top + innerH - (val / primaryMaxNice) * innerH;
              return (
                <g key={`grid-${val}`}>
                  <line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke="var(--black)" strokeWidth={1} strokeDasharray="4 2" opacity={0.4} />
                  <text x={primaryLabelX} y={y + 3} textAnchor="end" fontSize="10" fill="var(--black)" fontFamily="var(--font-mono)">
                    {val}
                  </text>
                </g>
              );
            })}
            {/* Seconda colonna Y: scala Kimi (solo se ci sono chiamate nel periodo) — stesse altezze “fisiche” della scala Kimi, griglia resta su scan/crediti */}
            {hasKimiAxis &&
              uniqKimiY.map((val) => {
                const y = pad.top + innerH - (val / kimiAxisMaxNice) * innerH;
                return (
                  <text
                    key={`kimi-y-${val}`}
                    x={kimiLabelX}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="var(--pink)"
                    fontFamily="var(--font-mono)"
                    fontWeight={700}
                  >
                    {val}
                  </text>
                );
              })}
            {uniqCost.length > 0 && uniqCost.map((val) => {
              const y = pad.top + innerH - (val / costMaxNice) * innerH;
              return (
                <text key={`cost-${val}`} x={pad.left + innerW + 6} y={y + 3} textAnchor="start" fontSize="9" fill="var(--black)" fontFamily="var(--font-mono)">
                  ${val.toFixed(2)}
                </text>
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
            {pathKimiCalls && (
              <path
                d={pathKimiCalls}
                fill="none"
                stroke="var(--pink)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ vectorEffect: 'non-scaling-stroke' }}
              />
            )}
            {pathCost && (
              <path
                d={pathCost}
                fill="none"
                stroke="var(--ok)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ vectorEffect: 'non-scaling-stroke' }}
              />
            )}
            {data.map((d, i) => {
              const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
              const yScans = pad.top + innerH - (d.scans / primaryMaxNice) * innerH;
              const yCredits = pad.top + innerH - (d.credits / primaryMaxNice) * innerH;
              const yKimi =
                kimiCallsMax > 0 && kimiAxisMaxNice > 0
                  ? pad.top + innerH - ((d.kimi_calls ?? 0) / kimiAxisMaxNice) * innerH
                  : null;
              const yCost =
                costMaxRaw > 0 && Number.isFinite(costMaxNice) && costMaxNice > 0
                  ? pad.top + innerH - ((d.kimi_cost_usd ?? 0) / costMaxNice) * innerH
                  : null;
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
                  {yKimi != null && <circle cx={x} cy={yKimi} r={3} fill="var(--pink)" stroke="var(--black)" strokeWidth={1} />}
                  {yCost != null && <circle cx={x} cy={yCost} r={4} fill="var(--ok)" stroke="var(--black)" strokeWidth={2} />}
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
          <div style={{ display: 'flex', gap: '1rem', marginTop: 6, fontSize: '0.7rem', fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--black)' }} /> Scan
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--yellow)', border: '2px solid var(--black)' }} /> Crediti
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--pink)', border: '2px solid var(--black)' }} /> Kimi chiamate
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ok)', border: '2px solid var(--black)' }} /> Costo $ (stima)
            </span>
          </div>
          {hover && hoverIdx != null && (
            <>
              <div
                role="presentation"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: pointXWrap - 15,
                  top: pointYWrap - 50,
                  width: TOOLTIP_GAP_RIGHT + TOOLTIP_WIDTH + 35,
                  height: 100,
                  zIndex: 9998,
                  pointerEvents: 'auto',
                }}
                onMouseEnter={handleTooltipEnter}
                onMouseLeave={handlePointLeave}
              />
              <div
                className="brutal-card"
                role="tooltip"
                style={{
                  position: 'absolute',
                  top: tooltipTop,
                  left: tooltipLeft,
                  minWidth: 180,
                  maxWidth: TOOLTIP_WIDTH,
                  padding: '0.5rem 0.75rem',
                  zIndex: 9999,
                  pointerEvents: 'auto',
                }}
                onMouseEnter={handleTooltipEnter}
                onMouseLeave={handleTooltipLeave}
              >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{new Date(hover.date).toLocaleDateString('it-IT')}</div>
              <div>Scan (audit/scan): <strong>{hover.scans}</strong></div>
              <div>Crediti totali: <strong>{hover.credits}</strong></div>
              {(hover.kimi_calls != null || hover.kimi_cost_usd != null) && (
                <>
                  <div>Kimi chiamate: <strong>{hover.kimi_calls ?? 0}</strong></div>
                  <div>Costo stimato: <strong>${(hover.kimi_cost_usd ?? 0).toFixed(3)}</strong></div>
                </>
              )}
              {byActionPerDay?.[hover.date] && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                  {Object.entries(byActionPerDay[hover.date])
                    .sort((a, b) => (b[1].credits ?? 0) - (a[1].credits ?? 0))
                    .map(([action, { count, credits }]) => (
                      <span key={action} style={{ display: 'block' }}>
                        {action}: {count} operaz., {credits} cr
                      </span>
                    ))}
                </div>
              )}
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>~${(hover.scans * COST_PER_SCAN).toFixed(2)} (stima su scan)</div>
              <Link to="/credits" state={{ highlightDate: hover.date }} style={{ display: 'inline-block', marginTop: 6, fontSize: '0.8rem' }}>
                Dettaglio crediti →
              </Link>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

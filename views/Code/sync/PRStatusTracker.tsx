import React, { useEffect, useRef, useState } from 'react';
import { BRUTAL } from '../types';

type Props = {
  syncSessionId: string;
  prUrls: string[];
  pollPrStatus: (opts: { syncSessionId?: string; prUrl?: string | null }) => Promise<{
    state?: string;
    should_rescan?: boolean;
  }>;
  onMerged: () => void;
  pollIntervalMs?: number;
};

export const PRStatusTracker: React.FC<Props> = ({
  syncSessionId,
  prUrls,
  pollPrStatus,
  onMerged,
  pollIntervalMs = 30000,
}) => {
  const primaryPr = prUrls[0] || null;
  const [ghState, setGhState] = useState<string | null>(null);
  const mergedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const out = await pollPrStatus({
          syncSessionId,
          prUrl: primaryPr,
        });
        if (cancelled) return;
        const st = String(out.state || 'unknown');
        setGhState(st);
        if ((out.should_rescan || st === 'merged') && !mergedOnce.current) {
          mergedOnce.current = true;
          onMerged();
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [syncSessionId, primaryPr, pollPrStatus, onMerged, pollIntervalMs]);

  const steps = [
    { key: 'prep', label: 'Preparing changes', done: true },
    { key: 'open', label: 'Opening PR', done: Boolean(primaryPr) },
    {
      key: 'opened',
      label: 'PR opened',
      done: Boolean(primaryPr),
      link: primaryPr || undefined,
    },
    { key: 'ci', label: 'CI running', done: ghState === 'success' || ghState === 'failure' || ghState === 'merged' },
    { key: 'merge', label: 'Ready to merge', done: ghState === 'merged' },
  ];

  return (
    <div className={`${BRUTAL.card} border-2 border-black bg-white p-3`}>
      <div className="text-[10px] font-black uppercase tracking-wide">PR status</div>
      <ol className="mt-3 space-y-2 border-l-2 border-black pl-3">
        {steps.map((s) => (
          <li key={s.key} className="relative text-[10px] font-bold leading-tight">
            <span
              className={`absolute -left-[17px] top-0.5 flex size-3 items-center justify-center border border-black ${
                s.done ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}
              aria-hidden
            >
              {s.done ? '✓' : ''}
            </span>
            {s.label}
            {s.link ? (
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate font-mono text-[9px] font-normal text-blue-800 underline"
              >
                View on GitHub
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      {ghState ? (
        <p className="mt-2 text-[9px] text-gray-600">
          GitHub: <span className="font-mono">{ghState}</span>
        </p>
      ) : null}
    </div>
  );
};

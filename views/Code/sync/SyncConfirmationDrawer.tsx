import React from 'react';
import { BRUTAL } from '../types';
import { Button } from '../../../components/ui/Button';
import { PRStatusTracker } from './PRStatusTracker';

type Phase = 'confirm' | 'tracker';

type Props = {
  open: boolean;
  phase: Phase;
  onClose: () => void;
  branchLabel: string;
  analysisMode: 'ai' | 'standard' | null;
  /** Optional single file when opening PR for one drift only. */
  filePath?: string | null;
  costCredits: number;
  isPro: boolean;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
  /** After PR created */
  syncSessionId: string | null;
  prUrls: string[];
  pollPrStatus: (opts: { syncSessionId?: string; prUrl?: string | null }) => Promise<{ state?: string; should_rescan?: boolean }>;
  onPrMerged: () => void;
};

export const SyncConfirmationDrawer: React.FC<Props> = ({
  open,
  phase,
  onClose,
  branchLabel,
  analysisMode,
  filePath,
  costCredits,
  isPro,
  isSubmitting,
  error,
  onConfirm,
  syncSessionId,
  prUrls,
  pollPrStatus,
  onPrMerged,
}) => {
  if (!open) return null;

  const fallbackBody =
    analysisMode === 'standard'
      ? 'A PR will be opened with a description of the drift. Code changes may need to be applied manually after merge.'
      : 'A PR will be opened on your repository. Your code will not change on the default branch until you merge it.';

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[280] flex max-h-[66vh] min-h-[40%] flex-col border-t-[3px] border-black bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.18)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-drawer-title"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-6">
        {phase === 'confirm' ? (
          <>
            <h2 id="sync-drawer-title" className="text-xs font-black uppercase tracking-wide">
              What will happen
            </h2>
            <ul className="mt-2 space-y-2 text-[10px] font-bold leading-snug text-neutral-900">
              <li className="flex gap-2">
                <span aria-hidden>⎇</span>
                <span>
                  Branch: <span className="font-mono">{branchLabel || 'default'}</span>
                </span>
              </li>
              {filePath ? (
                <li className="flex gap-2">
                  <span aria-hidden>📄</span>
                  <span>
                    File: <span className="font-mono">{filePath}</span>
                  </span>
                </li>
              ) : (
                <li className="flex gap-2">
                  <span aria-hidden>📄</span>
                  <span>All pending files from this sync session</span>
                </li>
              )}
              <li className="flex gap-2">
                <span aria-hidden>◆</span>
                <span>Figma nodes with stored identity will be updated on merge when you rescan.</span>
              </li>
            </ul>
            <div className={`${BRUTAL.card} mt-3 border-2 border-black bg-[#ffc900] p-2 text-[10px] font-black uppercase`}>
              Cost: {isPro ? 'Included (Pro)' : `${costCredits} credits`}
            </div>
            <p className="mt-2 text-[9px] leading-snug text-gray-700">{fallbackBody}</p>
            {error ? <p className="mt-2 text-[10px] font-bold text-red-700">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" fullWidth className="h-11 text-[10px] font-black uppercase" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="black"
                fullWidth
                className="h-11 text-[10px] font-black uppercase"
                onClick={onConfirm}
                disabled={isSubmitting || !syncSessionId}
              >
                {isSubmitting ? 'Working…' : 'Confirm sync'}
              </Button>
            </div>
          </>
        ) : syncSessionId ? (
          <PRStatusTracker syncSessionId={syncSessionId} prUrls={prUrls} pollPrStatus={pollPrStatus} onMerged={onPrMerged} />
        ) : (
          <p className="text-[10px] text-red-700">Missing session id — close and run scan again.</p>
        )}
        <button type="button" className="mt-4 w-full text-center text-[9px] font-black uppercase text-gray-600 underline" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

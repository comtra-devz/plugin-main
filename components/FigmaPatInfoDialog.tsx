import React from 'react';
import { BRUTAL, FIGMA_PAT_ONBOARDING_GIF_URL } from '../constants';
import { Button } from './ui/Button';
import { FIGMA_PAT_BULLETS, FIGMA_PAT_INTRO, FIGMA_PAT_PRIVACY } from '../lib/figmaPatInfoCopy';

interface Props {
  onClose: () => void;
  /** When true, show primary CTA to open Personal details (used from audit gate only). */
  showOpenPersonalDetails?: boolean;
  onOpenPersonalDetails?: () => void;
  /** Yellow banner title (gate vs info-from-profile). */
  bannerTitle?: string;
  /** Overlay + flex wrapper (z-index: gate below receipt stack uses z-[110]). */
  wrapperClassName?: string;
}

/**
 * Same story as the pre-audit gate: why PAT, optional GIF, privacy line.
 */
export const FigmaPatInfoDialog: React.FC<Props> = ({
  onClose,
  showOpenPersonalDetails = false,
  onOpenPersonalDetails,
  bannerTitle = 'Why we need this token',
  wrapperClassName = 'fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4',
}) => {
  const gif = String(FIGMA_PAT_ONBOARDING_GIF_URL || '').trim();

  return (
    <div
      className={wrapperClassName}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pat-info-title"
    >
      <div className={`${BRUTAL.card} max-w-md w-full bg-white relative max-h-[90vh] overflow-y-auto`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-xl font-bold z-10 hover:opacity-70"
          aria-label="Close"
        >
          ×
        </button>
        <div className="border-b-2 border-black pb-3 mb-4 -mx-4 px-4 -mt-4 pt-4 bg-[#ffc900]">
          <h3 id="pat-info-title" className="font-black uppercase text-sm leading-tight pr-8">
            {bannerTitle}
          </h3>
        </div>

        <p className="text-[11px] font-medium text-gray-800 mb-3 leading-snug">{FIGMA_PAT_INTRO}</p>

        <p className="text-[10px] font-medium text-gray-700 mb-3 leading-snug border-l-4 border-black pl-2">
          {FIGMA_PAT_PRIVACY}
        </p>

        {gif ? (
          <div className="mb-3 border-2 border-black bg-gray-100 overflow-hidden shadow-[4px_4px_0_0_#000]">
            <img src={gif} alt="" className="w-full max-h-48 object-contain object-top bg-white" />
          </div>
        ) : null}

        <ol className="list-decimal pl-4 space-y-1.5 mb-4 text-[10px] font-bold text-gray-800 leading-snug">
          {FIGMA_PAT_BULLETS.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>

        <div className="flex flex-col gap-2">
          {showOpenPersonalDetails && onOpenPersonalDetails ? (
            <Button type="button" variant="black" fullWidth onClick={onOpenPersonalDetails} className="py-3">
              Open Personal details
            </Button>
          ) : null}
          <Button type="button" variant="secondary" fullWidth onClick={onClose} className="py-2">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};

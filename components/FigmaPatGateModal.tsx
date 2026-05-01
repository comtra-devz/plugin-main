import React from 'react';
import { FigmaPatInfoDialog } from './FigmaPatInfoDialog';

interface Props {
  onOpenPersonalDetails: () => void;
  onCancel: () => void;
}

/**
 * Pre-audit gate: same content as info dialog + CTA (stack below credit modal z-[105]).
 */
export const FigmaPatGateModal: React.FC<Props> = ({ onOpenPersonalDetails, onCancel }) => (
  <FigmaPatInfoDialog
    bannerTitle="Connect Figma file access first"
    wrapperClassName="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4"
    onClose={onCancel}
    showOpenPersonalDetails
    onOpenPersonalDetails={onOpenPersonalDetails}
  />
);

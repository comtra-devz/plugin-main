
import React from 'react';
import { BRUTAL } from '../constants';
import { Button } from './ui/Button';

interface Props {
  title: string;
  message: string;
  details?: {
    rule?: string;
    method?: string;
    action?: string;
    target?: string;
    scope?: string;
    dsPriority?: string;
    note?: string;
    costLabel?: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isWarning?: boolean;
}

export const ConfirmationModal: React.FC<Props> = ({ title, message, details, onConfirm, onCancel, confirmLabel = 'Confirm', isWarning = false }) => {
  const hasDetails = !!details && [
    details.rule,
    details.method,
    details.action,
    details.target,
    details.scope,
    details.dsPriority,
    details.note,
    details.costLabel,
  ].some((v) => typeof v === 'string' && v.trim().length > 0);
  const detailRows: Array<{ label: string; value?: string }> = [
    { label: 'Rule', value: details?.rule },
    { label: 'Method', value: details?.method },
    { label: 'Action', value: details?.action },
    { label: 'Target', value: details?.target },
    { label: 'Scope', value: details?.scope },
    { label: 'Cost', value: details?.costLabel },
  ].filter((r) => !!r.value);

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
      <div className={`${BRUTAL.card} max-w-xs w-full bg-white relative animate-in zoom-in-95 duration-200`}>
        <div className={`text-center border-b-2 border-black pb-2 mb-4 ${isWarning ? 'bg-red-100 -mx-4 -mt-4 p-4 border-b-2 border-black' : ''}`}>
            <h3 className={`font-black uppercase text-lg ${isWarning ? 'text-red-600' : 'text-black'}`}>
                {title}
            </h3>
        </div>

        {hasDetails ? (
          <div className="mb-4 border-2 border-black bg-gray-50 p-2 text-[10px]">
            <div className="font-black uppercase text-[10px] mb-1">Action Preview</div>
            <div className="space-y-1">
              {detailRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[64px_1fr] gap-1">
                  <span className="font-black uppercase text-[9px] text-gray-600">{row.label}</span>
                  <span className="font-medium text-[10px] text-gray-800 break-words">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-xs font-medium text-gray-700 mb-6 leading-relaxed text-center whitespace-pre-line">
          {message}
        </p>

        {hasDetails && (details?.dsPriority || details?.note) ? (
          <div className="mb-4 border-2 border-black bg-white p-2 text-[10px]">
            {details?.dsPriority ? (
              <p className="font-bold text-gray-800">{details.dsPriority}</p>
            ) : null}
            {details?.note ? (
              <p className="font-medium text-gray-700 mt-1">{details.note}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
            <Button
                variant={isWarning ? 'danger' : 'black'}
                fullWidth
                onClick={onConfirm}
                className="active:translate-y-1 active:shadow-none"
            >
                {confirmLabel}
            </Button>
            <button 
                onClick={onCancel}
                className="text-[10px] font-bold uppercase underline text-gray-500 hover:text-black text-center py-2"
            >
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { BRUTAL } from '../../constants';

export type ImportFeedAssistant = {
  id: string;
  role: 'assistant';
  text: string;
};

export type ImportFeedActionLog = {
  id: string;
  role: 'action_log';
  title: string;
  lines: string[];
};

export type ImportFeedItem = ImportFeedAssistant | ImportFeedActionLog;

function ImportActionBar({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`${BRUTAL.infoShelf} text-black`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-black uppercase leading-snug tracking-wide"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[13px]" aria-hidden>
            ⚡
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </span>
        <span className="shrink-0 font-black tabular-nums text-gray-600" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && lines.length > 0 && (
        <div className="border-t-2 border-black px-3 py-2 text-[10px] font-medium leading-relaxed text-neutral-900">
          {lines.map((line, i) => (
            <p key={i} className="py-0.5">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export const ImportConversationalPanel: React.FC<{
  items: ImportFeedItem[];
  /** Pin scroll to bottom when items grow (import progress). */
  autoscroll?: boolean;
}> = ({ items, autoscroll = true }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoscroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, autoscroll]);

  if (items.length === 0) return null;

  return (
    <div
      className={`${BRUTAL.infoPanel} flex max-h-[min(42vh,320px)] min-h-0 flex-col gap-3 overflow-y-auto pt-3 pb-5`}
      data-component="ImportConversationalPanel"
    >
      {items.map((item) => {
        if (item.role === 'assistant') {
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wide text-gray-600">Comtra</span>
              </div>
              <p className="text-[13px] leading-relaxed text-black">{item.text}</p>
            </div>
          );
        }
        return <ImportActionBar key={item.id} title={item.title} lines={item.lines} />;
      })}
      <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
};

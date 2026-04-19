import React, { useEffect, useRef } from 'react';

export type ImportFeedAssistant = {
  id: string;
  role: 'assistant';
  text: string;
  /** When set, render a subtle “Kimi” badge for AI-flavored lines. */
  flavored?: boolean;
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
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/90 text-neutral-900 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-semibold leading-snug text-neutral-800"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[13px]" aria-hidden>
            ⚡
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </span>
        <span className="shrink-0 text-neutral-500 tabular-nums" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && lines.length > 0 && (
        <ul className="border-t border-neutral-200/80 px-3 py-2 text-[10px] leading-relaxed text-neutral-700">
          {lines.map((line, i) => (
            <li key={i} className="list-disc pl-4 marker:text-neutral-400">
              {line}
            </li>
          ))}
        </ul>
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
      className="flex max-h-[min(42vh,320px)] min-h-[120px] flex-col gap-3 overflow-y-auto rounded-xl border border-neutral-200 bg-[#faf9f6] px-3 py-3"
      data-component="ImportConversationalPanel"
    >
      {items.map((item) => {
        if (item.role === 'assistant') {
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wide text-neutral-500">Comtra</span>
                {item.flavored ? (
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-900">
                    Kimi
                  </span>
                ) : null}
              </div>
              <p className="text-[13px] leading-relaxed text-neutral-900">{item.text}</p>
            </div>
          );
        }
        return <ImportActionBar key={item.id} title={item.title} lines={item.lines} />;
      })}
      <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
};

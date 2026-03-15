import React from 'react';
import { BRUTAL } from '../constants';

interface Props {
  onClose: () => void;
}

/**
 * Modale guida per utenti: come far funzionare Connect quando l’URL non espone ancora la lista delle stories.
 * Contenuto autosufficiente, senza riferimenti a file di repo.
 */
export const SyncStorybookGuideModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`${BRUTAL.card} max-w-md w-full bg-white relative animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b-2 border-black p-3 flex justify-between items-center shrink-0">
          <h3 className="font-black uppercase text-sm">How to expose the Storybook API</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-bold uppercase underline hover:text-pink-600"
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-y-auto text-left space-y-4 flex-1">
          <p className="text-xs text-gray-700 leading-relaxed">
            To connect, Comtra needs to read the list of your components from the same address you use to open Storybook in the browser. We look for a small “API” that returns that list in a standard format. If your build doesn’t provide it yet, use one of the options below.
          </p>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">What we look for</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              We try, in order: <code className="bg-gray-100 px-0.5 text-[10px]">/api/stories</code>, <code className="bg-gray-100 px-0.5 text-[10px]">/api/components</code>, and <code className="bg-gray-100 px-0.5 text-[10px]">/index.json</code>. If any of these returns a JSON list of your stories or components, the connection works. You don’t need all three — just one is enough.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Option A — Add an addon</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Install a Storybook addon that adds a small REST API (search npm for “storybook api” or similar). Once configured, your usual Storybook URL will also expose the list we need. Deploy as you normally do and paste that URL in Comtra.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Option B — Add a small endpoint</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              If you only have a static build (no addon): add one route that returns the story list as JSON. For example, on Vercel you can add a serverless function (e.g. in <code className="bg-gray-100 px-0.5">api/stories.js</code>) that responds to requests to <code className="bg-gray-100 px-0.5">/api/stories</code> with that JSON. You can generate the JSON at build time. The same URL will then work for both viewing Storybook and connecting in Comtra.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Option C — You might already have it</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Some Storybook setups already expose <code className="bg-gray-100 px-0.5">/index.json</code> with the story list. If your deployed URL already serves that file with a compatible structure, Comtra will use it automatically — no extra setup.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Testing from your machine</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Run Storybook locally, then use a tool like <strong>ngrok</strong> to get a public URL (e.g. <code className="bg-gray-100 px-0.5">ngrok http 6006</code>). Paste the ngrok URL in Comtra. If opening <code className="bg-gray-100 px-0.5">https://your-subdomain.ngrok.io/api/stories</code> (or <code className="bg-gray-100 px-0.5">/index.json</code>) in the browser shows the list in JSON format, Connect will work.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

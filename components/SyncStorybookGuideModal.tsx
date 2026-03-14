import React from 'react';
import { BRUTAL } from '../constants';

interface Props {
  onClose: () => void;
}

/**
 * Modale guida: come esporre l'API Storybook (GET /api/stories o equivalente)
 * per far funzionare Connect in Deep Sync. Contenuto allineato a docs/SYNC-STORYBOOK-URL-GUIDE.md.
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
            Comtra needs to read your list of components/stories from the same URL you use in the browser. We call <strong>GET /api/stories</strong>, then <strong>GET /api/components</strong>, then <strong>GET /index.json</strong>. If one returns valid JSON, the connection works.
          </p>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">What we need</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Your Storybook URL must expose one of these endpoints with a JSON like <code className="bg-gray-100 px-0.5 text-[10px]">{`{ "stories": [ { "component": "Button", "title": "Components/Button", "id": "..." } ] }`}</code> (or <code className="bg-gray-100 px-0.5 text-[10px]">components</code> array). Same URL you open in the browser — nothing else.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Option A — Add a REST API package</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Search npm for packages that add a REST API to Storybook (e.g. “storybook api”, “storybook rest api”). After setup, your existing Storybook URL will also serve <code className="bg-gray-100 px-0.5">/api/stories</code>. Deploy as usual; use that URL in Comtra.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Option B — Custom server or serverless</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              If you only have a static Storybook build: add a small server (or a serverless function) that responds to <code className="bg-gray-100 px-0.5">GET /api/stories</code> with the JSON. Our <strong>storybook-test</strong> folder in this repo shows the pattern: a Vercel function in <code className="bg-gray-100 px-0.5">api/stories.js</code> so the same deploy URL works. You can generate the JSON at build time and serve it from that route.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Option C — Static index</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Some Storybook builds or addons expose <code className="bg-gray-100 px-0.5">/index.json</code> with the story list. If your URL already serves that with a compatible structure, Comtra will use it.
            </p>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase text-black mb-1">Test locally</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Run your Storybook (with one of the options above), then expose the port with <strong>ngrok</strong> (e.g. <code className="bg-gray-100 px-0.5">ngrok http 6006</code>). Use the ngrok URL in Comtra; if <code className="bg-gray-100 px-0.5">https://your-subdomain.ngrok.io/api/stories</code> returns the JSON, Connect will succeed.
            </p>
          </section>

          <p className="text-[10px] text-gray-500 border-t border-gray-200 pt-3">
            Full guide: <code className="bg-gray-100 px-0.5">docs/SYNC-STORYBOOK-URL-GUIDE.md</code> in the repo.
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Button } from '@comtra/components/ui/Button';
import {
  BrutalDropdown,
  BrutalSelect,
  brutalMenuRowClass,
  brutalSelectOptionRowClass,
  brutalSelectOptionSelectedClass,
} from '@comtra/components/ui/BrutalSelect';
import { Toast } from '@comtra/components/Toast';
import { BRUTAL, COLORS } from '@comtra/constants';

type SectionId =
  | 'buttons'
  | 'cards'
  | 'form'
  | 'selects'
  | 'navigation'
  | 'feedback'
  | 'tokens';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'buttons', label: 'Buttons' },
  { id: 'cards', label: 'Cards' },
  { id: 'form', label: 'Form & Inputs' },
  { id: 'selects', label: 'Selects' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'feedback', label: 'Feedback & Notification' },
  { id: 'tokens', label: 'Colours & Tokens' },
];

export default function App() {
  const [active, setActive] = useState<SectionId>('buttons');

  return (
    <div className="min-h-screen flex bg-[#fdfdfd]">
      {/* Sidebar */}
      <aside className="w-56 border-r-2 border-black bg-white shrink-0 p-4">
        <h1 className="text-lg font-black uppercase tracking-tighter mb-2">Comtra</h1>
        <p className="text-[10px] font-bold uppercase text-gray-500 mb-6">Component Gallery</p>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`text-left py-2 px-3 text-xs font-bold uppercase transition-colors ${
                active === id ? 'bg-black text-white' : 'hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 max-w-3xl">
        {active === 'buttons' && <ButtonsSection />}
        {active === 'cards' && <CardsSection />}
        {active === 'form' && <FormSection />}
        {active === 'selects' && <SelectsSection />}
        {active === 'navigation' && <NavigationSection />}
        {active === 'feedback' && <FeedbackSection />}
        {active === 'tokens' && <TokensSection />}
      </main>
    </div>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
      {desc && <p className="text-sm text-gray-600 mt-1">{desc}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-xs font-bold uppercase text-gray-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ButtonsSection() {
  return (
    <>
      <SectionTitle
        title="Buttons"
        desc="CTA e azioni secondarie. Primary = rosa (attivo), grigio solo quando disabled."
      />
      <Block title="Primary (CTA attiva — rosa)">
        <div className="flex flex-wrap gap-3 items-start">
          <Button variant="primary">Scan Design</Button>
          <Button variant="primary" fullWidth className="max-w-[200px]">
            Scan Again
          </Button>
          <Button variant="primary" layout="row">
            <span>Create Wireframes</span>
          </Button>
        </div>
      </Block>
      <Block title="Primary disabled (grigio)">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Block>
      <Block title="Secondary">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Continue</Button>
          <Button variant="secondary" fullWidth className="max-w-[200px]">
            Copy CSS
          </Button>
        </div>
      </Block>
      <Block title="Black">
        <div className="flex flex-wrap gap-3">
          <Button variant="black">Login with Figma</Button>
          <Button variant="black" className="hover:bg-[#ff90e8] hover:text-black">
            View in Stats
          </Button>
        </div>
      </Block>
      <Block title="Danger">
        <Button variant="danger">Elimina</Button>
      </Block>
      <Block title="Sizes">
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="primary" size="default">
            Default
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
        </div>
      </Block>
    </>
  );
}

function CardsSection() {
  return (
    <>
      <SectionTitle title="Cards" desc="BRUTAL.card: bordo nero, ombra, padding." />
      <Block title="Card base">
        <div className={BRUTAL.card}>
          <p className="text-sm font-medium">Contenuto card. Shadow 4px 4px nero.</p>
        </div>
      </Block>
      <Block title="Card con titolo">
        <div className={`${BRUTAL.card} max-w-sm`}>
          <h3 className="font-black uppercase text-sm mb-2">Current Status</h3>
          <p className="text-xs text-gray-600">Testo secondario nella card.</p>
        </div>
      </Block>
    </>
  );
}

function SelectsSection() {
  const [lang, setLang] = useState('tsx');
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <>
      <SectionTitle
        title="Selects"
        desc="BrutalSelect / BrutalDropdown: bordo nero, ombra, hover opzioni giallo brand (#ffc900), selezione nera."
      />
      <Block title="BrutalSelect (singola)">
        <div className="max-w-md">
          <BrutalSelect
            value={lang}
            onChange={setLang}
            options={[
              { value: 'tsx', label: 'React + Tailwind' },
              { value: 'html', label: 'HTML + Clean CSS' },
              { value: 'vue', label: 'Vue 3' },
            ]}
            maxHeightClassName="max-h-56"
          />
        </div>
      </Block>
      <Block title="BrutalDropdown (pannello custom)">
        <div className="max-w-md">
          <BrutalDropdown
            open={customOpen}
            onOpenChange={setCustomOpen}
            maxHeightClassName="max-h-48"
            trigger={
              <button
                type="button"
                onClick={() => setCustomOpen(!customOpen)}
                className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 bg-white w-full text-left`}
              >
                <span className="text-xs font-bold uppercase">Menu custom</span>
                <span aria-hidden>{customOpen ? '▲' : '▼'}</span>
              </button>
            }
          >
            <div className={`${brutalMenuRowClass} border-b border-gray-100`}>
              <span className="w-3 h-3 shrink-0 border border-black bg-white" />
              <span className="text-xs font-bold">Con checkbox</span>
            </div>
            <div className={`${brutalSelectOptionRowClass} ${brutalSelectOptionSelectedClass}`.trim()}>
              Riga selezionata (nero)
            </div>
            <div className={brutalSelectOptionRowClass}>Altra opzione</div>
          </BrutalDropdown>
        </div>
      </Block>
    </>
  );
}

function FormSection() {
  return (
    <>
      <SectionTitle title="Form & Inputs" desc="Campi e controlli in stile brutal." />
      <Block title="Input base (BRUTAL.input)">
        <input
          type="text"
          placeholder="Placeholder..."
          className={BRUTAL.input}
          readOnly
        />
      </Block>
      <Block title="Input focus (giallo)">
        <input
          type="text"
          placeholder="Focus: bg giallo"
          className={BRUTAL.input}
        />
      </Block>
    </>
  );
}

function NavigationSection() {
  return (
    <>
      <SectionTitle title="Navigation" desc="Tab e link in stile plugin." />
      <Block title="Tab orizzontali">
        <div className="flex border-b-2 border-black">
          {['Audit', 'Generate', 'Code'].map((label, i) => (
            <button
              key={label}
              type="button"
              className={`py-2 px-4 text-[10px] font-black uppercase ${
                i === 0 ? 'bg-black text-white' : 'hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Block>
    </>
  );
}

function FeedbackSection() {
  return (
    <>
      <SectionTitle
        title="Feedback & Notification"
        desc="Toast bottom-stack per messaggi brevi e di sistema."
      />
      <Block title="Toast — default">
        <div className="max-w-sm">
          <Toast
            id="preview-default"
            title="Design scanned"
            description="We saved your latest scan."
            variant="default"
            onDismiss={() => {}}
          />
        </div>
      </Block>
      <Block title="Toast — error">
        <div className="max-w-sm">
          <Toast
            id="preview-error"
            title="Something went wrong"
            description="Comtra couldn't complete the action. Try again."
            variant="error"
            onDismiss={() => {}}
          />
        </div>
      </Block>
      <Block title="Toast — warning / info">
        <div className="flex flex-col gap-4 max-w-sm">
          <Toast
            id="preview-warning"
            title="Connection is a bit slow"
            description="You might see longer waits than usual."
            variant="warning"
            onDismiss={() => {}}
          />
          <Toast
            id="preview-info"
            title="Heads up"
            description="New audit types will land in the next update."
            variant="info"
            onDismiss={() => {}}
          />
        </div>
      </Block>
    </>
  );
}

function TokensSection() {
  return (
    <>
      <SectionTitle title="Colours & Tokens" desc="Palette e token condivisi." />
      <Block title="Primary (CTA)">
        <div className="flex gap-4 items-center flex-wrap">
          <div
            className="w-20 h-20 border-2 border-black shadow-[4px_4px_0_0_#000]"
            style={{ backgroundColor: COLORS.primary }}
          />
          <div>
            <p className="font-mono text-xs font-bold">{COLORS.primary}</p>
            <p className="text-[10px] text-gray-500">Rosa CTA — attivo</p>
          </div>
        </div>
      </Block>
      <Block title="Yellow (accent)">
        <div className="flex gap-4 items-center flex-wrap">
          <div
            className="w-20 h-20 border-2 border-black"
            style={{ backgroundColor: COLORS.yellow }}
          />
          <p className="font-mono text-xs font-bold">{COLORS.yellow}</p>
        </div>
      </Block>
      <Block title="Black / White">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="w-20 h-20 border-2 border-black bg-black" />
          <div className="w-20 h-20 border-2 border-black bg-white" />
        </div>
      </Block>
    </>
  );
}

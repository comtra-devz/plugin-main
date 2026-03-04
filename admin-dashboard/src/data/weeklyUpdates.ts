/**
 * Weekly Updates — struttura derivabile da commit (es. conventional commits).
 * In futuro: fetch da GitHub API e traduzione commit message → linguaggio semplice.
 * Categorie: FEAT, FIX, DOCS, CHORE, REFACTOR, SECURITY, STYLE.
 */
export type UpdateCategory = 'FEAT' | 'FIX' | 'DOCS' | 'CHORE' | 'REFACTOR' | 'SECURITY' | 'STYLE';

export interface WeeklyUpdate {
  id: string;
  date: string; // ISO date
  category: UpdateCategory;
  /** Titolo in linguaggio semplice (derivato da commit subject) */
  title: string;
  /** Descrizione in linguaggio semplice (derivato da commit body) */
  description: string;
  /** Opzionale: hash commit per link a repo */
  commitHash?: string;
}

/** Placeholder: in produzione si popolerà da API (es. GitHub commits → mapping/traduzione). */
export const PLACEHOLDER_WEEKLY_UPDATES: WeeklyUpdate[] = [
  {
    id: '1',
    date: new Date().toISOString().slice(0, 10),
    category: 'FEAT',
    title: 'Dashboard admin in stile BRUTAL',
    description: 'Nuova interfaccia admin con sidebar, login e grafici collegati alle pagine di dettaglio.',
    commitHash: 'placeholder',
  },
  {
    id: '2',
    date: new Date(Date.now() - 86400 * 1000 * 2).toISOString().slice(0, 10),
    category: 'FIX',
    title: 'Correzione calcolo crediti nella timeline',
    description: 'La timeline crediti ora mostra correttamente scan e crediti per giorno con tooltip.',
  },
  {
    id: '3',
    date: new Date(Date.now() - 86400 * 1000 * 5).toISOString().slice(0, 10),
    category: 'DOCS',
    title: 'Documentazione deploy admin e visibilità',
    description: 'Aggiunta guida per il deploy su Vercel e per la visibilità interna della dashboard.',
  },
  {
    id: '4',
    date: new Date(Date.now() - 86400 * 1000 * 7).toISOString().slice(0, 10),
    category: 'CHORE',
    title: 'Aggiornamento dipendenze e build',
    description: 'Mantenimento dipendenze e configurazione Vite aggiornate.',
  },
];

export const UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string> = {
  FEAT: 'Nuova funzionalità',
  FIX: 'Correzione',
  DOCS: 'Documentazione',
  CHORE: 'Manutenzione',
  REFACTOR: 'Refactoring',
  SECURITY: 'Sicurezza',
  STYLE: 'Stile',
};

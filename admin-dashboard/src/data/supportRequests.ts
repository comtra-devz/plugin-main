/**
 * Support Requests — placeholder. In futuro: collegamento a backend/ticketing.
 */
export type SupportRequestStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface SupportRequest {
  id: string;
  status: SupportRequestStatus;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  /** Placeholder: email utente (offuscata) se disponibile */
  userRef?: string;
}

export const PLACEHOLDER_SUPPORT_REQUESTS: SupportRequest[] = [
  {
    id: '1',
    status: 'TODO',
    subject: 'Richiesta informazioni su piani PRO',
    description: 'L’utente chiede differenze tra piano mensile e annuale. (Placeholder: nessun collegamento backend.)',
    createdAt: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
    userRef: 'user***@***.it',
  },
  {
    id: '2',
    status: 'IN_PROGRESS',
    subject: 'Problema sync Storybook',
    description: 'Segnalazione drift non aggiornato dopo modifica in Figma. (Placeholder.)',
    createdAt: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
    userRef: 'dev***@***.com',
  },
  {
    id: '3',
    status: 'DONE',
    subject: 'Reset crediti dopo upgrade',
    description: 'Risolto: crediti non si aggiornavano al passaggio FREE → PRO. (Placeholder.)',
    createdAt: new Date(Date.now() - 86400 * 1000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
  },
];

export const SUPPORT_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  TODO: 'Da fare',
  IN_PROGRESS: 'In corso',
  DONE: 'Completato',
};

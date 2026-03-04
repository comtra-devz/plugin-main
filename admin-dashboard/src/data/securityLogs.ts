/**
 * Security & Logs — ideazione a priori:
 *
 * Categorie evento: Login, FailedLogin, RoleChange, ApiKeyUsed, ExportData, ConfigChange, SecurityPatch, AccessRevoked
 * Severità: Info, Warning, Critical
 * Categorie di fix (per azioni di remediation): SecurityPatch, ConfigChange, AccessRevoke, PasswordReset
 *
 * In futuro: collegamento a log reali (DB, file, servizio esterno).
 */
export type SecurityEventCategory =
  | 'Login'
  | 'FailedLogin'
  | 'RoleChange'
  | 'ApiKeyUsed'
  | 'ExportData'
  | 'ConfigChange'
  | 'SecurityPatch'
  | 'AccessRevoked';

export type SecuritySeverity = 'Info' | 'Warning' | 'Critical';

export type FixCategory = 'SecurityPatch' | 'ConfigChange' | 'AccessRevoke' | 'PasswordReset';

export interface SecurityLogEntry {
  id: string;
  date: string; // ISO
  category: SecurityEventCategory;
  severity: SecuritySeverity;
  description: string;
  ip?: string;
  /** Se applicabile: tipo di fix applicato (remediation) */
  fixCategory?: FixCategory;
}

export const EVENT_CATEGORY_LABELS: Record<SecurityEventCategory, string> = {
  Login: 'Login',
  FailedLogin: 'Login fallito',
  RoleChange: 'Cambio ruolo',
  ApiKeyUsed: 'Uso API key',
  ExportData: 'Export dati',
  ConfigChange: 'Cambio configurazione',
  SecurityPatch: 'Patch sicurezza',
  AccessRevoked: 'Accesso revocato',
};

export const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  Info: 'Info',
  Warning: 'Attenzione',
  Critical: 'Critico',
};

export const FIX_CATEGORY_LABELS: Record<FixCategory, string> = {
  SecurityPatch: 'Patch sicurezza',
  ConfigChange: 'Configurazione',
  AccessRevoke: 'Revoca accesso',
  PasswordReset: 'Reset password',
};

/** Placeholder: in produzione da sostituire con feed reale. */
export const PLACEHOLDER_SECURITY_LOGS: SecurityLogEntry[] = [
  {
    id: '1',
    date: new Date().toISOString(),
    category: 'Login',
    severity: 'Info',
    description: 'Accesso admin dashboard da IP autorizzato.',
    ip: '192.168.1.1',
  },
  {
    id: '2',
    date: new Date(Date.now() - 3600 * 1000).toISOString(),
    category: 'FailedLogin',
    severity: 'Warning',
    description: 'Tentativo di accesso admin con credenziali errate (3 tentativi).',
    ip: '10.0.0.2',
  },
  {
    id: '3',
    date: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
    category: 'ExportData',
    severity: 'Info',
    description: 'Export CSV utenti eseguito dall’admin.',
  },
  {
    id: '4',
    date: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    category: 'ApiKeyUsed',
    severity: 'Info',
    description: 'Chiamata API admin (route: stats).',
    ip: '192.168.1.1',
  },
  {
    id: '5',
    date: new Date(Date.now() - 86400 * 1000 * 5).toISOString(),
    category: 'SecurityPatch',
    severity: 'Critical',
    description: 'Applicata patch per vulnerabilità CVE placeholder. Servizi riavviati.',
    fixCategory: 'SecurityPatch',
  },
  {
    id: '6',
    date: new Date(Date.now() - 86400 * 1000 * 7).toISOString(),
    category: 'AccessRevoked',
    severity: 'Warning',
    description: 'Revoca token per utente inattivo (policy 90 gg).',
    fixCategory: 'AccessRevoke',
  },
];

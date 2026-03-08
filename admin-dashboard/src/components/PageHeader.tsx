import { Link } from 'react-router-dom';
import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Mostra link "← Dashboard" a destra (default true). Impostare false sulla Home. */
  showBack?: boolean;
  /** Contenuto aggiuntivo a destra (es. pulsante Aggiorna). */
  actions?: ReactNode;
}

export default function PageHeader({ title, showBack = true, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {actions}
        {showBack && (
          <Link to="/" className="page-back">
            ← Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}

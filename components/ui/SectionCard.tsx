import React from 'react';
import { BRUTAL } from '../../constants';

export interface SectionCardProps {
  /** Titolo principale (sempre in maiuscolo nello stile plugin). */
  title: string;
  /**
   * Etichetta a destra nell’header (es. tipo layer INSTANCE).
   * Se valorizzata, l’header diventa riga due colonne con divider sotto.
   */
  headerRight?: React.ReactNode;
  /** Testo introduttivo sotto il titolo (tipico della card “Design System”). */
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Es. `Generate: Context Card` per debug / analytics. */
  dataComponent?: string;
  /** Opzionale: `data-component` sul titolo. */
  titleDataComponent?: string;
}

/**
 * Card sezione unificata: stesso container brutal per “Context layer”, “Design system”, ecc.
 * - Con `headerRight`: header a due colonne + bordo inferiore.
 * - Senza `headerRight`: solo titolo, poi eventuale `description`, poi `children`.
 */
export function SectionCard({
  title,
  headerRight,
  description,
  children,
  className = '',
  dataComponent,
  titleDataComponent,
}: SectionCardProps) {
  const hasSplitHeader =
    headerRight !== undefined && headerRight !== null && headerRight !== false && headerRight !== '';

  const titleClass = 'text-xs font-bold uppercase';

  return (
    <div
      data-component={dataComponent}
      className={`${BRUTAL.card} bg-white px-3 py-4 flex flex-col gap-3 relative ${className}`.trim()}
    >
      {hasSplitHeader ? (
        <div className="flex justify-between items-center border-b border-black/10 pb-2">
          <span data-component={titleDataComponent} className={titleClass}>
            {title}
          </span>
          <span className="text-[10px] font-bold uppercase text-gray-500">{headerRight}</span>
        </div>
      ) : (
        <span data-component={titleDataComponent} className={titleClass}>
          {title}
        </span>
      )}

      {description != null && description !== false && (
        <p className="text-[10px] text-gray-500">{description}</p>
      )}

      {children}
    </div>
  );
}

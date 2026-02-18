
# Admin Core Specification

## Layout
- **Header**:
  - Logo "Admin OS" a sinistra.
  - **User Avatar**: In alto a destra, cerchio con iniziale, indicatore di stato online.
  - **Global Date Filter**: Componente `BrutalDatePicker` custom (non nativo browser).
- **Navigation**: Tabs principali (Overview, Users, Security, Requests).
- **Bottom Bar**: Barra di stato fissa in basso. Mostra:
  - System Status (es. "System: Operational").
  - Versione API.
  - Ping/Latenza database.

## Visual Style
- **Brutalist**: Bordi neri 2px, ombre nette (`4px 4px`), colori piatti (Giallo, Rosa, Bianco, Nero).
- **No Rounded Corners**: Tutto squadrato o con border-radius minimo (2px).

# Archive Docs Policy

Questa cartella è destinata a documenti storici (proposal, brainstorming, piani superati).

## Criteri

Spostare in archive i file che:

- descrivono scenari non più target o già sostituiti;
- hanno titolo `PROPOSAL`, `ARCHIVIO`, `FUTURO`, `ACTION-PLAN` non operativo;
- duplicano una spec consolidata già presente altrove.

## Regola di sicurezza

Prima di spostare/rinominare file:

1. cercare riferimenti con `rg` su tutta la repo;
2. verificare file letti da tooling (es. `admin-dashboard/lib/plugin-doc-snapshot.mjs`);
3. lasciare eventualmente un file stub con link al nuovo path per retrocompatibilità.

## Candidati iniziali (non ancora spostati)

- `docs/ADMIN-DASHBOARD-PROPOSAL.md`
- `docs/ADMIN-DASHBOARD-ARCHIVIO-DA-FARE.md`
- `docs/ADMIN-DASHBOARD-COSTI-CONTROLLI-FUTURO.md`
- `docs/FEASIBILITY-KIMI-SWARM.md`

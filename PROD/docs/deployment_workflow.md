
# Automated Deployment Workflow (AI-Driven)

Questo documento spiega come gestire il ciclo di vita del software usando Google AI come "Junior Developer" e Antigravity/Vercel come pipeline di deploy automatica.

## 🎯 Obiettivo
Modificare l'interfaccia o la logica del plugin tramite prompt e vederlo live in pochi minuti, senza errori di build e senza ri-pubblicare su Figma.

---

## 1. Architettura "Iframe Hosting"
Il plugin Figma non contiene il codice React.
*   **Figma (Shell)**: Contiene solo `manifest.json` e un file HTML minimale che carica un `<iframe>`.
*   **Vercel (Brain)**: Ospita l'applicazione React (`PROD/`).
*   **Vantaggio**: Aggiornando Vercel, il plugin si aggiorna istantaneamente per tutti gli utenti.

---

## 2. Il Ciclo di Modifica "Zero-Error"

Quando chiedi modifiche all'AI, segui rigorosamente questo schema:

### STEP A: Prompting (Input)
Fornisci all'AI il contesto specifico della cartella `PROD`.
> **Prompt Esempio:**
> "Devo modificare la card 'Generate' in `PROD/views/Generate.tsx`. Aggiungi un bottone 'History'. Segui rigorosamente lo stile `BRUTAL` definito in `PROD/constants.ts`. Non toccare altri file."

### STEP B: Verifica (Local Check)
Prima di fare commit, verifica che l'AI non abbia:
1.  Importato file inesistenti.
2.  Usato percorsi assoluti (es. `src/components`) invece di relativi (es. `../components`).
3.  Modificato file fuori da `/PROD`.

### STEP C: Push & Deploy (Automazione)
1.  **Git Commit**: Esegui il commit delle sole modifiche nella cartella `PROD`.
    ```bash
    git add PROD/
    git commit -m "feat: updated generate ui"
    git push origin main
    ```
2.  **Vercel Build**: Vercel rileva il push, builda l'app React e aggiorna l'hosting.
3.  **Live**: In 2 minuti, il plugin Figma carica la nuova versione.

---

## 3. Gestione Errori Comuni (Troubleshooting)

### Errore: "Module not found"
*   **Causa**: L'AI ha usato un import errato (es. `import Button from '@/components/Button'`).
*   **Soluzione AI**: "Correggi gli import nel file X. Usa percorsi relativi (`./` o `../`) e assicurati che il file esista in `PROD/components`."

### Errore: "White Screen in Figma"
*   **Causa**: Crash React (Runtime Error) o `export default` mancante.
*   **Soluzione**: Controlla la console del browser (in Figma: Plugins > Development > Open Console) e incolla l'errore all'AI.

---

## 4. Regole per l'AI (Copia-Incolla)

Se cambi sessione AI, incolla questo blocco per istruirla sul workflow di deploy:

```text
*** DEPLOYMENT CONTEXT RULES ***
1. TARGET: You are modifying a live production app hosted on Vercel.
2. SCOPE: ONLY modify files inside the "PROD/" directory. Ignore "TESTING/".
3. STYLING: Strict adherence to "PROD/constants.ts" for colors and styles. Do not invent new Tailwind classes if a constant exists.
4. IMPORTS: Use relative paths only (e.g., "../components/Button"). Never use aliases like "@/" unless configured in Vite.
5. SAFETY: Do not remove existing "data-component" attributes (used for debugging).
```

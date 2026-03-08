# Prototype Audit — Direttive per eventuale agente (tips)

Se si aggiunge un blocco **“Prototype health tips”** generato da AI (opzionale), usare le seguenti direttive. L’audit core resta **deterministico** (nessun AI per i finding P-01–P-20).

---

## Scope dei tips

- **Input:** summary dell’audit (healthScore, advisoryLevel, totalFindings, conteggi per categoryId, eventualmente lista ruleId più frequenti).
- **Output:** 2–4 frasi di consiglio in linguaggio naturale, costruttive, senza ripetere i suggested fix delle singole issue.
- **Fonti:** usare **EFFORT-VS-FIDELITY.md** per ancorare i consigli (effort vs fidelity, quando semplificare, quando usare variabili/condizioni, iterazione > fedeltà estrema).

---

## Tono

- **Costruttivo e pratico:** “Consider simplifying variables if this prototype is for early flow testing” invece di “Your prototype is too complex.”
- **Rispettoso dello sforzo:** riconoscere che la prototipazione avanzata richiede tempo; suggerire alternative (proto più semplice, più cicli di test) senza sminuire.
- **Breve:** nessun paragrafo lungo; bullet o 2–4 frasi.
- **Non allarmistico:** anche con score basso, evitare toni catastrofici; orientare verso passi concreti (es. “Start by fixing dead-ends and back navigation, then reassess.”).

---

## Esempi di prompt (per backend/LLM)

- “Given this prototype audit summary: [summary]. Suggest 2–3 short tips based on EFFORT-VS-FIDELITY: when to simplify, when advanced prototyping is worth it, and iteration vs fidelity. Do not repeat the exact suggested fixes from the findings; keep tone constructive and under 4 sentences.”
- Se `advisoryLevel === 'at_risk'` o `critical`: “Emphasize fixing flow integrity first (dead-ends, back navigation), then consider whether variable/conditional complexity is necessary for the test goals.”

---

## Regole

1. I tips **non sostituiscono** i finding né i suggested fix delle regole P-01–P-20.
2. I tips **non devono** inventare issue o severity non presenti nell’audit.
3. Se non si usa AI, mostrare 1–2 consigli **statici** estratti da EFFORT-VS-FIDELITY.md in base a categoryId o advisoryLevel (es. “Many variable/conditional issues → see Effort vs Fidelity guide.”).

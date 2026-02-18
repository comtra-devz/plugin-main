# Content Hub Architecture & Security

## 1. Sicurezza Launcher & Accesso
Il `Communication Hub` e il `Master Plan` sono strumenti interni strategici. Non devono essere accessibili pubblicamente.

### Requisiti di Sviluppo Futuro (Antigravity):
1.  **Auth Wall**: Implementare un login separato (Admin) per accedere al Launcher.
2.  **Environment Variable**: Usare una variabile `IS_INTERNAL_ADMIN=true` per renderizzare il bottone Launcher.
3.  **Password Protection**: Se non si usa Auth completo, un semplice "Pin Code" in localStorage può bastare per la MVP.

## 2. Database Schema (Supabase)
Per rendere il Piano Editoriale persistente e collegabile agli Agent AI, creare le seguenti tabelle.

### Table: `editorial_posts`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `title` | text | |
| `status` | enum | 'DRAFT', 'ANALYSIS', 'IN_PROGRESS', 'DONE', 'SCHEDULED' |
| `publish_date` | timestamp | |
| `copy_en` | text | Il prompt per l'AI generator |
| `media_url` | text | Link all'asset generato |
| `goal` | text | |
| `format` | enum | 'VIDEO', 'IMAGE', 'CAROUSEL' |

### Table: `strategy_docs`
Per salvare ToV, USP e Analisi Competitor in modo che l'AI possa leggerli (RAG).
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `category` | text | 'BRAND', 'COMPETITOR' |
| `content` | text | Markdown content |
| `embedding` | vector | Per ricerca semantica (RAG) |

## 3. Integrazione AI Agents
In futuro, un Agent (es. "Social Media Manager") potrà:
1.  Leggere `strategy_docs` per capire il ToV.
2.  Leggere una riga di `editorial_posts` con status `ANALYSIS`.
3.  Generare il copy e suggerire un prompt per l'immagine.
4.  Aggiornare lo status a `DRAFT`.

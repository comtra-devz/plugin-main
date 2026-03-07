# Comtra — Error Messages Rewrite

> **Tone**: Friendly but minimal. No fluff, no jargon, no blame.  
> **Pattern**: `What happened` → `What to do` (+ optional CTA)  
> **Rule**: Never expose HTTP codes, stack traces, or internal service names to the user.

---

## Glossary of conventions

| Element | Usage |
|---------|-------|
| **Title** | Short, plain statement of what happened (≤ 8 words) |
| **Description** | One sentence: why + what the user can do |
| **CTA** | Button label when an action is available |
| **Variant** | `error` · `warning` · `info` · `default` |
| **Surface** | `toast` · `banner` · `inline` · `figma-notify` |

---

## 1 — Service & connectivity

### 1.1 Service temporarily unavailable (503 / throttle)

| | Old | New |
|---|---|---|
| **Title** | "Servizio temporaneamente non disponibile" | **Comtra is taking a breather** |
| **Desc** | "Riprova più tardi." | **Our servers are busy. Try again in a few minutes.** |
| Variant | `error` | `warning` |
| Surface | toast | toast |

> **Why `warning` instead of `error`**: it's temporary and not the user's fault. Red screams "you broke something." Orange says "hang on."

### 1.2 Throttle → discount code available

| | Old | New |
|---|---|---|
| **Title** | "Codice sconto 5%" | **Here's a little something** |
| **Desc** | "Usa il codice: …" | **Use code `{CODE}` for 5% off your next plan. Sorry for the wait.** |
| Variant | `default` | `default` |

### 1.3 Throttle → code not ready yet

| | Old | New |
|---|---|---|
| **Title** | "Codice non ancora disponibile" | **Not ready yet** |
| **Desc** | "Attendi 15 minuti dall'errore…" | **The discount code unlocks 15 min after the outage. Hang tight.** |
| Variant | `error` | `info` |

### 1.4 Throttle → code request failed

| | Old | New |
|---|---|---|
| **Title** | "Errore" | **Couldn't fetch the code** |
| **Desc** | data.error / "Non disponibile" / "Riprova più tardi." | **Something went wrong on our end. Try again shortly.** |
| Variant | `error` | `error` |

---

## 2 — Authentication & session

### 2.1 Session expired (401)

| | Old | New |
|---|---|---|
| **Title** | "Server error" / "Unauthorized" | **Session expired** |
| **Desc** | *(inconsistent or missing)* | **Log in again to pick up where you left off.** |
| CTA | — | **Log in** |
| Variant | — | `warning` |
| Surface | banner (inconsistent) | toast (unified) |

> **Recommendation**: intercept every `401` response centrally and fire one single toast + redirect to login. No more "Unauthorized" leaking into banners.

### 2.2 Login failed (OAuth errors)

| | Old | New |
|---|---|---|
| **Title** | "Impossibile contattare il server (…)" / "Risposta server non valida" | **Login didn't go through** |
| **Desc** | Technical message or raw error | **We couldn't connect to the login service. Check your connection and try again.** |
| CTA | — | **Retry** |
| Variant | — | `error` |
| Surface | inline (LoginModal) | inline (LoginModal) |

### 2.3 Login polling failed

| | Old | New |
|---|---|---|
| **Title** | "Qualcosa non è andato a buon fine. Riprova il login." | **Login timed out** |
| **Desc** | *(same as title)* | **The login window may have closed. Give it another go.** |
| CTA | — | **Try again** |

---

## 3 — Figma connection

### 3.1 Figma not connected (403 / FIGMA_RECONNECT)

| | Old | New |
|---|---|---|
| **Title** | "Figma non connesso. Clicca 'Riconnetti Figma' nel plugin." | **Figma connection lost** |
| **Desc** | *(same)* | **Comtra needs access to your Figma file. Reconnect to continue.** |
| CTA | "Riconnetti" (only in Audit) | **Reconnect Figma** *(everywhere)* |
| Variant | `error` | `warning` |
| Surface | toast (Audit only) | toast (unified across Audit, Generate, Code) |

> **Key change**: same message and CTA in every context. One helper function, one toast.

### 3.2 File not saved

| | Old | New |
|---|---|---|
| **Title** | "Save the file to run the audit." / "Salva il file per generare." | **Save your file first** |
| **Desc** | *(same as title)* | **Comtra needs a saved file to work with. Hit ⌘S and try again.** |
| Variant | `error` | `info` |
| Surface | banner + toast | inline banner only |

> **Why demote to banner-only**: this isn't an error — it's a precondition. A toast feels like punishment for something trivial.

### 3.3 Layer not found (apply fix)

| | Old | New |
|---|---|---|
| **Title** | figma.notify("Layer not found", { error: true }) | **Can't find that layer** |
| **Desc** | — | **It may have been moved or deleted. Rerun the audit to refresh.** |
| Surface | figma-notify only | figma-notify + inline banner under the issue |

---

## 4 — Credits & payments

### 4.1 Insufficient credits (402)

| | Old | New |
|---|---|---|
| **Title** | "Crediti insufficienti. Upgrade o riprova più tardi." / *(modal only, no text)* | **Out of credits** |
| **Desc** | *(inconsistent)* | **This action costs {N} credits. Top up or upgrade to keep going.** |
| CTA | — | **Upgrade** |
| Variant | — | `warning` |
| Surface | modal (Audit) / banner (Fix) / inline (Generate, Code) | toast + CTA everywhere |

> **Key change**: always tell the user *how many* credits the action needs. Transparency builds trust, especially on a paid action that failed.

### 4.2 Credit consumption error (non-402)

| | Old | New |
|---|---|---|
| **Title** | result.error (raw) | **Payment hiccup** |
| **Desc** | "Server error" / "Network error" | **We couldn't process the credits. Nothing was charged. Try again.** |
| Variant | `error` | `error` |

> **Critical**: always reassure that nothing was charged on failure.

### 4.3 Checkout redirect failed

| | Old | New |
|---|---|---|
| **Title** | *(not handled)* | **Couldn't open checkout** |
| **Desc** | — | **The payment page didn't load. Check your popup blocker and try again.** |
| CTA | — | **Retry** |
| Surface | — | toast |

### 4.4 Discount fetch failed (GET /discounts/me)

| | Old | New |
|---|---|---|
| **Title** | *(silent .catch)* | **Discount unavailable** |
| **Desc** | — | **We couldn't load your discount code. It'll show up next time.** |
| Variant | — | `info` |
| Surface | — | toast (low priority) |

---

## 5 — Audits (Design System & Accessibility)

### 5.1 Connection / token error

| | Old | New |
|---|---|---|
| **Title** | "Errore A11Y" / "Errore Design System" | **Audit couldn't start** |
| **Desc** | "La connessione non è completa. Riprova tra poco." | **Comtra lost the connection to your file. This usually fixes itself — try again.** |
| CTA | "Riprova" | **Retry** |
| Surface | toast | toast |

### 5.2 Timeout / 504

| | Old | New |
|---|---|---|
| **Title** | *(embedded in desc)* | **Audit timed out** |
| **Desc** | "L'audit ha impiegato troppo tempo. Prova con una singola pagina…" | **Your file is too large to scan in one go. Select fewer frames or a single page and retry.** |
| CTA | — | **Retry** |
| Variant | `error` | `warning` |

### 5.3 AI service error (502 / Kimi)

| | Old | New |
|---|---|---|
| **Title** | "Kimi API error" / "Invalid response from AI" | **Analysis interrupted** |
| **Desc** | err.message (raw) | **Our AI engine hit a snag. This is on us — try again in a moment.** |
| Variant | `error` | `error` |
| Surface | banner | banner + toast |

### 5.4 Figma API error (502)

| | Old | New |
|---|---|---|
| **Title** | "Figma API error" | **Figma isn't responding** |
| **Desc** | error + details | **Figma's servers are slow right now. Wait a minute and retry.** |
| Variant | `error` | `warning` |

### 5.5 "Audit not available"

| | Old | New |
|---|---|---|
| **Title** | "Audit not available" | **Audit not available** |
| **Desc** | — | **This audit type isn't available for your current selection. Pick a different frame or page.** |

### 5.6 Fix apply — insufficient credits

| | Old | New |
|---|---|---|
| **Title** | "Crediti insufficienti. Upgrade o riprova più tardi." | **Not enough credits for this fix** |
| **Desc** | *(same)* | **Top up or upgrade to apply automatic fixes.** |
| CTA | — | **Upgrade** |
| Surface | inline banner | inline banner (keep — no toast needed for inline fixes) |

---

## 6 — Generate

### 6.1 Invalid response

| | Old | New |
|---|---|---|
| **Title** | "Risposta non valida." | **Generation failed** |
| **Desc** | *(same)* | **The output came back malformed. Try again — if it persists, try a simpler selection.** |

### 6.2 General generate error

| | Old | New |
|---|---|---|
| **Title** | err.message (raw) | **Something went wrong** |
| **Desc** | — | **Comtra couldn't generate the output. Give it another try.** |
| CTA | — | **Retry** |

### 6.3 Generate timeout / 504

| | Old | New |
|---|---|---|
| **Title** | *(not specifically handled)* | **Generation timed out** |
| **Desc** | — | **Complex selections take longer. Try generating fewer components at once.** |
| CTA | — | **Retry** |
| Surface | inline | inline + toast |

---

## 7 — Code & Sync

### 7.1 Sync scan error (generic)

| | Old | New |
|---|---|---|
| **Title** | msg.error (raw) | **Scan failed** |
| **Desc** | — | **Comtra couldn't complete the sync scan. Try again.** |

### 7.2 Invalid data

| | Old | New |
|---|---|---|
| **Title** | "Invalid data received. Try again." | **Unexpected data** |
| **Desc** | — | **The scan returned something we didn't expect. Retry — it's usually a one-off.** |

### 7.3 Design tokens read failure

| | Old | New |
|---|---|---|
| **Title** | "Failed to read variables" | **Can't read design tokens** |
| **Desc** | msg.error | **Comtra couldn't pull the tokens from your file. Make sure variables are published and try again.** |

### 7.4 Storybook unreachable

| | Old | New |
|---|---|---|
| **Title** | *(banner only)* | **Storybook not reachable** |
| **Desc** | connectionStatus error | **Comtra can't connect to your Storybook instance. Check the URL and make sure the server is running.** |
| Surface | inline banner | inline banner + toast |

### 7.5 Sync timeout / 504

| | Old | New |
|---|---|---|
| **Title** | *(not specifically handled)* | **Sync timed out** |
| **Desc** | — | **Large files need more time. Try syncing fewer components.** |
| Surface | inline | inline + toast |

---

## 8 — Affiliate program

### 8.1 Load failed

| | Old | New |
|---|---|---|
| **Title** | "Impossibile caricare il programma affiliati." | **Couldn't load affiliate data** |
| **Desc** | — | **Try refreshing. If it keeps happening, reach out to us.** |

### 8.2 Registration failed

| | Old | New |
|---|---|---|
| **Title** | data.error / "Registrazione fallita." | **Registration didn't go through** |
| **Desc** | — | **Something went wrong while signing you up. Try again or contact support.** |

---

## 9 — Node counting (controller)

### 9.1 Count nodes failed

| | Old | New |
|---|---|---|
| **Title** | figma.notify(errMsg, { error: true }) | **Couldn't count the layers** |
| **Desc** | "Layer not found" / timeout | **Comtra needs to count your layers before scanning. Deselect and reselect your frame, then retry.** |
| Surface | figma-notify only | figma-notify + toast (if it blocks the audit) |

---

## 10 — Catch-all / unknown errors

For any error not covered above:

| | Value |
|---|---|
| **Title** | **Something went wrong** |
| **Desc** | **That wasn't supposed to happen. Try again — if it keeps up, let us know.** |
| CTA | **Retry** (if retriable) · **Contact support** (if not) |
| Variant | `error` |

> Never show raw `err.message` or backend strings to the user. Log them to console for debugging, display the catch-all instead.

---

## Implementation notes

### Unified helpers

Create two central functions to enforce consistency:

```
showSystemToast(type, options)   →  maps error category to title + desc + CTA
isRetriable(error)               →  returns boolean based on status code / error type
```

This avoids 15 different files each composing their own toast copy.

### Severity mapping

| HTTP / condition | Variant | Rationale |
|---|---|---|
| 401 | `warning` | Not broken — just needs re-auth |
| 402 | `warning` | Not broken — just needs credits |
| 403 (Figma) | `warning` | Reconnectable |
| 404 | `error` | Something is actually missing |
| 502 (external) | `error` | Third-party failure |
| 503 / throttle | `warning` | Temporary, will self-resolve |
| 504 / timeout | `warning` | Retriable with smaller scope |
| 500 / unknown | `error` | Genuine system failure |

### Credit safety rule

**Any error that interrupts a paid action must explicitly state whether credits were consumed or not.** This is non-negotiable for user trust in a credit-based product.

### Figma-native vs plugin UI

Some errors surface through `figma.notify()` (Figma's own toast) and some through Comtra's UI. Rule of thumb:
- **Figma-notify**: instant, contextual actions (layer not found, node errors)  
- **Plugin toast**: anything related to Comtra's systems (auth, credits, API, sync)
- **Never both** for the same event — pick one surface per error

### Copy principles (cheat sheet)

| Do | Don't |
|---|---|
| "Comtra couldn't…" | "Error 502" |
| "Try again" | "An error occurred" |
| "This is on us" | "Invalid request" |
| "Your file is large — try fewer frames" | "Timeout exceeded" |
| "Nothing was charged" | *(silence on credit failures)* |
| One sentence, one action | Walls of text |

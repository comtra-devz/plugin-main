
# Admin Security Specification

## Security Log Table
- **Columns**: Type, IP Address, Reason, Timestamp, Action.
- **Actions**: Bottone "BAN IP" visibile per minacce attive.

## IP Blocking Flow (Modal)
1. Trigger: Click su "BAN IP".
2. **Popup Interaction**:
   - Titolo: "Confirm IP Block".
   - Messaggio: "Are you sure you want to blacklist [IP]? This will prevent all future requests."
   - Input opzionale: "Reason" (es. DDoS, Spam).
   - Bottoni: "CONFIRM BAN" (Rosso) / "CANCEL".
3. Feedback: Toast notification "IP [x] added to Blacklist".

## Logic
- I log devono evidenziare in ROSSO i tentativi falliti critici.

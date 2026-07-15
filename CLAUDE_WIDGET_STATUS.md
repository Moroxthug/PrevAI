# Allineamento Progetto: Standalone Widget & Admin Dashboard (PrevAI)

Ciao Claude! Questo file riassume lo stato attuale del lavoro svolto per il Widget di PrevAI, i repository GitHub, le URL di produzione live e le modifiche apportate al codice, per consentirti di riprendere le attività senza perdere contesto.

---

## 1. Repository GitHub & URL Live

### Repository Principale (PrevAI)
* **GitHub URL:** [https://github.com/Moroxthug/PrevAI](https://github.com/Moroxthug/PrevAI)
* **Vercel Hosting:** Ospitato sul progetto principale associato all'account Vercel.
* **Cosa contiene:** Il backend Express (`artifacts/api-server`) e il client web SPA (`artifacts/preventivo-ai`).

### Repository Widget Standalone
* **GitHub URL:** [https://github.com/Moroxthug/prevai-widget](https://github.com/Moroxthug/prevai-widget)
* **Vercel Hosting:** [https://prevai-widget-three.vercel.app/](https://prevai-widget-three.vercel.app/)
* **URL Script Widget Live:** **`https://prevai-widget-three.vercel.app/widget.js`**
* **Cosa contiene:** File statici compilati del widget (`widget.js` e `README.md` con istruzioni di embed). È un progetto a sé stante per garantire caricamenti super veloci e isolamento in caso di offline del sito principale.

---

## 2. Architettura & Lavoro Svolto

### A. Sicurezza CORS e API Pubbliche (Backend)
* **[app.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/api-server/src/app.ts):** Abilitato CORS globale per le rotte sotto `/api/public/*` per consentire ai widget sui siti esterni di contattare il backend.
* **[public-quotes.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/api-server/src/routes/public-quotes.ts):**
  * Creato l'endpoint `GET /api/public/config` per recuperare i dati dell'impresa e il catalogo degli interventi in base alla `apiKey`.
  * Creato l'endpoint `POST /api/public/quotes` per inserire preventivi nel database (CRM lead) e calcolare il preventivo tramite Groq (Llama 3.3).

### B. Notifiche Lead via E-mail
* **[email.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/api-server/src/lib/email.ts):** Implementata la funzione `sendWidgetLeadNotification` che invia una e-mail di notifica all'impresa edile ogni volta che un utente compila il widget, inserendo contatti (nome, email, telefono), note sulla ristrutturazione e prezzo AI stimato.
* **Integrazione:** Chiamata in modo asincrono in `public-quotes.ts` alla creazione del preventivo.

### C. Widget Standalone React (IIFE Bundle)
* **[WidgetFunnelDemo.tsx](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/mockup-sandbox/src/components/mockups/prevai-redesign/WidgetFunnelDemo.tsx):**
  * Supporta il recupero di configurazioni dinamiche (nome impresa, listini, ecc.).
  * Invio dei lead via API.
  * Fallback matematico locale istantaneo in caso di timeout (4 secondi) o errori di rete.
  * Integrazione del GDPR consent obbligatorio.
  * Backlink credit SEO friendly ("Powered by PrevAI").
* **[vite-widget.config.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/mockup-sandbox/vite-widget.config.ts):** Configurazione Vite per compilare il widget come file IIFE autonomo (`dist/prevai-widget.js`) includendo React e stili in linea.
* **[copy-widget.js](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/mockup-sandbox/copy-widget.js):** Utility per copiare automaticamente il widget compilato dentro `preventivo-ai/public/widget.js` ad ogni build.

### D. Sezioni Dashboard Admin e Impostazioni Profilo
* **Dashboard Admin ([admin.tsx](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/preventivo-ai/src/pages/admin.tsx) / [admin.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/api-server/src/routes/admin.ts)):**
  * Aggiunto un sotto-menu nella tab "Widget" per scindere la gestione delle chiavi dall'analisi AI.
  * Visualizzazione metriche Groq (preventivi totali da widget, token complessivi e costo stimato in Euro al millesimo di centesimo).
  * Cronologia delle ultime 50 chiamate effettuate dai widget per scopi di debug.
  * Form di **creazione clienti non registrati (virtuali)**: genera un `userId` provvisorio (`temp_widget_xxx`) ed una chiave API all'istante.
* **Impostazioni Utente Partner ([settings.tsx](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/preventivo-ai/src/pages/dashboard/settings.tsx) / [business-profile.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/api-server/src/routes/business-profile.ts)):**
  * Aggiunta la scheda **"Integrazione Widget Funnel"** in fondo alle impostazioni del profilo del partner, mostrando la sua API Key attiva, il pulsante per rigenerarla/crearla, e lo snippet HTML da copiare per l'installazione su WordPress/Wix.

---

## 3. Configurazione del Deploy (Vercel Build Command)

Nel file [vercel.json](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/vercel.json) principale, il comando di build è stato modificato in:
```json
"buildCommand": "pnpm --filter @workspace/mockup-sandbox build && pnpm --filter @workspace/api-server build && pnpm --filter @workspace/preventivo-ai build"
```
Questo fa sì che ogni volta che il progetto principale PrevAI viene deployato, anche il widget venga ricompilato e incluso nei file pubblici del sito web.

Buon lavoro per le prossime fasi!

# APP-5: kit della beta con le imprese pilota

Riga 20 del piano (`docs/PIANO-AZIONE.md`), fase APP-5 di `docs/APP-PLAN.md` §5.
Preparato il 27/9/2026, prima che esista l'app nativa: la parte sul sito è pronta, TestFlight e Play partono quando APP-3 e APP-4 sono fatte.

## 1. Cosa c'è già (sul sito, vale anche per l'app)

| Pezzo | Dove | Stato |
|---|---|---|
| Eventi d'uso: **app aperta** (una volta al giorno per dispositivo), **preventivo creato**, **preventivo condiviso** (link copiato o email inviata) | `lib/app-beta.ts` → `POST /api/app/events` → tabella `app_events` | inerte finché non gira la migrazione 0009 |
| Superficie di ogni evento: `web`, `pwa` (installata), `android`, `ios` (guscio Capacitor, APP-3) e viewport `phone`/`desktop` | `detectSurface()` in `lib/app-beta.ts` | pronto; `android`/`ios` compaiono da soli quando il guscio espone `window.Capacitor` |
| **Segnala un problema**: foglio Altro (telefono) e menu account (desktop). Il testo, la pagina, la superficie e la versione finiscono in `app_feedback`, in un'email a `OPS_ALERT_EMAIL`/`ADMIN_EMAIL` e come avviso su Sentry | `components/feedback-sheet.tsx`, `POST /api/app/feedback` | risponde "non ancora attivo" finché non gira la 0009 |
| **Pannello "Beta app"** in `/dashboard/admin`: per impresa aperture, preventivi creati e condivisi (app nativa / totale), segnalazioni con stato nuovo → visto → risolto, contatore verso l'obiettivo di 20 preventivi dall'app | `components/admin-app-beta.tsx`, `GET /api/admin/app-beta` | pronto |
| **Sentry**: errori del browser e del server già cablati (v2, Phase 69); ora ogni errore del browser ha anche i tag `surface` e `viewport`, quindi si filtrano gli errori dell'app | `lib/error-tracking.ts` | serve il DSN (sotto) |

Nessun contenuto dei preventivi finisce negli eventi: solo id, tipo, superficie, versione.

## 2. Cosa deve fare il titolare prima della beta

1. **Migrazione 0009**: `migrations/v2/0009_app5_beta.sql`, additiva e idempotente (due tabelle nuove, vuote). Comando in RUNBOOKS §12. Si può fare subito: da quel momento si contano già web e PWA.
2. **Sentry**: creare un progetto (piano gratuito basta per 5 imprese) e mettere su Vercel, ambiente Production:
   - `SENTRY_DSN` (server) e `VITE_SENTRY_DSN` (browser, stesso DSN va bene);
   - facoltativi: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` per caricare le source map a ogni build (`scripts/sentry-sourcemaps.mjs`).
   Poi un redeploy. In Sentry: una regola di avviso "nuovo problema con tag `surface` = android o ios" → email.
3. **Account store** (APP-0, D14): Apple Developer e Google Play Console; senza questi non esistono TestFlight né il test interno di Play.

## 3. Scelta delle imprese pilota (3–5)

- Prima quelle che usano già il widget sul loro sito (oggi rba-edilizia e abduledilizia): sono attive e ci conoscono.
- Almeno una con Android e, se possibile, una con iPhone (TestFlight). Il titolare non ha dispositivi Apple: l'iPhone di una pilota è l'unico test vero su iOS oltre a BrowserStack (APP-PLAN §3b).
- Almeno una che crea preventivi dal cantiere (telefono), non solo dall'ufficio.
- Nel pannello admin, periodo "ultimi 90 giorni", si vede chi usa già PrevAI da telefono.

## 4. Messaggio d'invito (bozza, da mandare dal titolare)

> Ciao {nome}, stiamo per pubblicare l'app di PrevAI per telefono e cerchiamo 3–5 imprese che la provino per due settimane prima che esca negli store. Cambia poco rispetto al sito: stessi dati, stesso account, ma si installa sul telefono e (su Android e iPhone) arriva con le notifiche. Ti chiediamo solo di usarla per i preventivi che faresti comunque e, se qualcosa non va, di premere **Altro → Segnala un problema**. In cambio {offerta, da decidere: es. un mese gratis}. Ti va?

L'offerta in cambio la decide il titolare; non è nel codice.

## 5. Come si installa (quando esiste l'app)

- **Android**: test interno di Google Play. Il titolare aggiunge l'email Google della pilota alla lista dei tester nella Play Console e le manda il link di adesione.
- **iPhone**: TestFlight. Il titolare aggiunge l'email Apple ID della pilota come tester esterno (la prima build esterna passa una breve revisione Apple); la pilota installa TestFlight e apre l'invito.
- Il login è quello di sempre (email e password o link); nell'app il login usa il token (plugin `bearer`, APP-3).

## 6. Le due settimane

- **Giorno 0**: installazione con la pilota al telefono, un preventivo di prova insieme.
- **Ogni 2–3 giorni**: pannello Beta app (preventivi dall'app, ultime segnalazioni) e Sentry filtrato per `surface:android` / `surface:ios`.
- **Segnalazioni**: ognuna va messa su "visto" quando è letta e su "risolto" quando la correzione è in produzione; alla pilota si risponde via email.
- **Giorno 7**: un giro di correzioni (una build nuova negli store solo se cambiano i plugin nativi; il resto arriva col normale deploy web).
- **Giorno 14**: verifica del "fatto quando".

## 7. Fatto quando (APP-PLAN §5)

- due settimane senza crash bloccanti: in Sentry nessun problema aperto con `surface` android/ios e livello error/fatal che impedisca di creare o inviare un preventivo;
- almeno **20 preventivi creati dall'app** dalle imprese pilota: il riquadro "Preventivi dall'app" del pannello (periodo 14 o 30 giorni), che conta gli eventi `quote_created` con superficie android o ios.

Query di controllo, se serve fuori dal pannello:

```sql
select surface, count(*) from app_events
where kind = 'quote_created' and created_at > now() - interval '14 days'
group by surface order by 2 desc;
```

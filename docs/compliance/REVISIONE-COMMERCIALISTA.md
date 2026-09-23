# Revisione del motore regole 2026 con il commercialista partner — pacchetto per la prima riunione

Versione 1.2 · A-0, aggiornato in A-2 e A-3 · 22 settembre 2026 · Bloccato dalla decisione **D6** (`PIANO-AZIONE.md`): finché il titolare non indica il professionista, questa è la lista di ciò che gli va sottoposto. Le regole sono quelle raccolte in `AMMINISTRAZIONE-PLAN.md` §3 e **sono già codificate** in `lib/config/src/fiscale/regole/2026.ts` (A-2), ma tutte con `revisione.stato = "non_revisionata"`: **niente è codificato come "verificato" prima della sua firma**, e il prodotto lo dice all'utente in ogni schermata.

> **Cosa è cambiato con A-2 (2026-09-22).** Il motore esiste e gira: ogni regola qui sotto ha un identificatore vivo nel codice, i 5 casi golden sono test veri (`artifacts/api-server/src/fiscale/golden.test.ts`) e il prodotto calcola già, marcando però ogni numero come non verificato. Alla riunione si arriva quindi con i **nostri valori calcolati** accanto a ogni caso, da confrontare con i suoi: è molto più rapido che partire da un foglio bianco. Per ottenerli: `pnpm --filter @workspace/api-server exec vitest run src/fiscale`.
>
> Due domande nate scrivendo il motore, da aggiungere alla riunione:
> - **base INPS vs base fiscale** (F6/F10): abbiamo calcolato i contributi sul reddito forfettario *senza* dedurre i contributi versati, e l'imposta su quello stesso reddito *meno* i contributi versati. Conferma?
> - **scaglione e massimale INPS 2026** (F10): `55.008 €` e `92.413 €` sono ricavati per proporzione dagli anni precedenti, non letti dalla circolare. Sono i due numeri di cui siamo meno sicuri.

## Come si svolge

1. Riunione di 90 minuti (anche da remoto). Al commercialista arriva prima: questo file, `AMMINISTRAZIONE-PLAN.md` §3 e §5, la `DPIA.md` (sezione fiscale), 5 casi di prova (sotto).
2. Per ogni regola: conferma / correzione / "dipende da" (con la condizione). Le sue risposte finiscono nella colonna **Esito** e nel commit di A-2 come commento con data e nome.
3. Ci fornisce i **valori attesi** dei 5 casi golden (imposta, INPS, acconti, saldo) → diventano i test `rules/2026.golden.test.ts`.
4. Accordo scritto (anche una email) sul perimetro: revisione delle regole, non consulenza ai singoli utenti (quella è fase 2, A-6/D9). Compenso a forfait.

## Regole da confermare (una riga = un test)

| # | Regola | Fonte da noi indicata | Domanda specifica | Esito |
|---|---|---|---|---|
| F1 | Soglia accesso/permanenza ricavi ≤ 85.000 € (ragguaglio ad anno per attività iniziate in corso d'anno) | L. 190/2014 art. 1 c. 54, come modificato | Il ragguaglio si applica anche all'uscita? Ricavi "incassati" o "fatturati" ai fini della soglia? | ⬜ |
| F2 | Uscita immediata > 100.000 € (IVA dall'operazione che supera), differita 85.001–100.000 | c. 71 | L'IVA si applica all'intera fattura che fa superare o solo all'eccedenza? Trattamento delle fatture già emesse senza IVA nell'anno | ⬜ |
| F3 | Spese lavoro dipendente/collaboratori ≤ 20.000 € lordi | c. 54 lett. b | Cosa rientra: solo dipendenti o anche occasionali/prestazioni di terzi con P. IVA? | ⬜ |
| F4 | Redditi da lavoro dipendente anno precedente ≤ 35.000 € (2025–2026) | L. 207/2024 | Confermare che per il 2026 vale ancora 35.000 e cosa succede se cessato il rapporto | ⬜ |
| F5 | Coefficienti di redditività: 86% gruppi ATECO 41–43 (costruzioni/impianti); tabella completa e **mappatura ATECO 2025** | allegato 2 L. 145/2018 + ATECO 2025 | Fornire/validare la tabella codice → coefficiente per i codici tipici degli artigiani PrevAI (idraulici, elettricisti, imbianchini, muratori, serramentisti, giardinieri, ecc.) | ⬜ |
| F6 | Deduzione dei contributi previdenziali **versati** nell'anno (criterio di cassa), inclusi quelli a saldo dell'anno precedente | c. 64 | Vanno dedotti anche i contributi versati per i collaboratori familiari? Eccedenza deducibile dal reddito complessivo? | ⬜ |
| F7 | Imposta sostitutiva 15%; 5% per i primi 5 anni con le 3 condizioni | c. 65 | Chiarire "mera continuazione" per chi era dipendente dello stesso settore; decorrenza dei 5 anni | ⬜ |
| F8 | Bollo 2 € su fatture > 77,47 €, assolto virtualmente, F24 trimestrale (scadenze e codici tributo); riaddebito al cliente = ricavo | DPR 642/72; provv. AdE | Confermare scadenze 2026 e la soglia per lo slittamento del versamento del 1°/2° trimestre | ⬜ |
| F9 | Diciture obbligatorie in fattura forfettaria (operazione senza IVA ex c. 58; non soggetta a ritenuta ex c. 67; bollo) | c. 58, 67 | Testo esatto da stampare; codice natura N2.2 nell'XML | ⬜ |
| F10 | INPS artigiani 2026: minimale 18.808 €, aliquota 24%, fissi ≈ 4.521 €/anno in 4 rate (16/5, 20/8, 16/11, 16/2), eccedenza oltre il minimale con saldo/acconti | Circ. INPS 14/2026 | Confermare importi, aliquota aggiuntiva oltre 55.008 €, massimale; contributo maternità | ⬜ |
| F11 | Riduzione 35% (forfettari) vs 50% per 36 mesi (nuovi iscritti dal 2025): esclusive tra loro, effetti sull'accredito | L. 190/2014 c. 77; L. 207/2024 c. 186 | Quale proporre di default nel simulatore e quale disclaimer ("scelta con effetti pensionistici") | ⬜ |
| F12 | Acconti: 30/6 saldo + 1° acconto (40% o 50% se rateizzato / soggetti ISA), 30/11 2° acconto; metodo storico vs previsionale; soglia sotto cui l'acconto non è dovuto (51,65 €) e unica rata se < 257,52 € | DPR 435/2001 | Confermare percentuali 2026 e regole di rateizzazione; possibilità di rateizzare il saldo fino a dicembre | ⬜ |
| F13 | Scadenze Redditi PF 2026: 30/10 telematico; quadro LM; precompilata P. IVA | provv. AdE | Confermare che l'utente può inviare da solo via Fisconline e quali quadri il software deve precompilare (LM, RR) | ⬜ |
| F14 | Fattura elettronica obbligatoria per tutti i forfettari; conservazione a norma 10 anni; decadenza ridotta per chi fattura solo elettronicamente | D.L. 36/2022; DPR 633/72 | Cosa deve contenere il manuale di conservazione se usiamo la conservazione dell'intermediario | ⬜ |
| F15 | Ciclo passivo: fatture ricevute senza rilevanza IVA, ma il forfettario è debitore d'imposta per acquisti intra-UE/reverse charge (integrazione e versamento entro il 16 del mese successivo) | c. 58–60 | Quali casi gestire nel software e quali segnalare "chiedi al commercialista" | ⬜ |
| F16 | "Quanto mettere via": formula proposta = (incassi × coeff. − contributi) × aliquota + INPS eccedenza + fissi, ripartita per mese | — | Approvare la formula e i margini di sicurezza da mostrare (es. +10%) | ⬜ |
| F17 | Codici tributo dell'imposta sostitutiva nel modello F24: **1792** saldo, **1790** primo acconto, **1791** secondo acconto o acconto in unica soluzione | Ris. AdE 59/E 2015 | Confermare i tre codici e l'anno di riferimento da scrivere per ciascuno (saldo = anno chiuso, acconti = anno in corso). Esistono codici diversi per la rateazione del saldo? | ⬜ |
| F18 | Sezione INPS del modello F24: causali **AF**/**AP** (artigiani fissi/percentuale), **CF**/**CP** (commercianti), codice sede a 4 cifre, matricola d'azienda, periodo "da mm/aaaa – a mm/aaaa" per trimestre | Circ. INPS 98/2001 e istruzioni del modello | Confermare causali e il periodo da indicare per ciascuna delle 4 rate e per l'eccedenza (12 mesi?). Gestione separata: causale corretta (PXX?) e come si compila | ⬜ |
| F19 | Imposta di bollo virtuale: codici tributo **2521-2524** per trimestre, scadenze 31/5, 30/9, 30/11, 28/2 | Ris. AdE 42/E 2019; DM 4/12/2020 | Già toccato da F8: qui serve la conferma dei **codici** e dell'anno di riferimento da scrivere nel modello | ⬜ |

| F20 | Prospetto per la dichiarazione: ricavi incassati, coefficiente e codice ATECO in **LM22**; reddito lordo **LM34**; contributi dedotti **LM35** (fino a capienza del reddito); reddito netto **LM36**; perdite **LM37** (non gestite, dichiarato 0); **LM38**; imposta sostitutiva **LM39**; acconti **LM45** (solo 1790/1791 dell'anno); debito **LM46** o credito **LM47**; quadro **RR sez. I** per artigiani e commercianti | Istruzioni del modello Redditi PF, fascicolo 3 | Confermare numeri di rigo e colonne sul modello Redditi PF 2027 (anno 2026) appena esce; se LM35 va indicato il versato o il dedotto; se nel quadro RR vanno i contributi del minimale o solo l'eccedenza | ⬜ |

> F17–F19 sono state aggiunte con la fase A-3 (scadenzario e F24 precompilati). Sono fatti della stessa natura degli altri: un codice tributo sbagliato manda il denaro su un altro tributo, e l'imposta risulta non versata anche se il conto è stato addebitato.
>
> F20 è stata aggiunta con la fase A-4 (chiusura d'anno). PrevAI non compila né invia la dichiarazione: prepara un prospetto da ricopiare. Ma un importo giusto nel rigo sbagliato è una dichiarazione sbagliata, e i righi cambiano da un modello all'altro: questa regola va riconfermata **ogni anno**, non una volta sola.

## 5 casi golden (valori attesi da compilare dal commercialista)

| Caso | Profilo | Incassi 2026 | Contributi versati 2026 | Note |
|---|---|---|---|---|
| G1 | Idraulico, ATECO 43.22, 15%, 3° anno | 42.000 € | 4.521 € fissi | caso base |
| G2 | Elettricista, 43.21, **5%** start-up 1° anno, iscritto INPS 2026 con riduzione 50% | 28.000 € | rate fisse ridotte | verifica 5% + 50% |
| G3 | Imbianchino, 43.34, 15%, riduzione INPS 35% | 61.000 € | fissi ridotti 35% + eccedenza | eccedenza oltre minimale |
| G4 | Muratore, 43.99, 15%, supera 85.000 a settembre (fattura da 12.000 che porta a 91.000) | 91.000 € | 4.521 € | F1/F2: uscita differita |
| G5 | Serramentista, 43.32, 15%, fattura da 30.000 che porta a 104.000 in novembre | 104.000 € | 4.521 € | F2: uscita immediata, IVA |

Per ciascuno: imponibile, imposta sostitutiva, contributi INPS dovuti (fissi + eccedenza), acconti 2027, saldo 2026, bollo stimato, "da mettere via" mensile.

## Dopo la riunione

- Aggiornare la colonna Esito, salvare la email di conferma in `C:\Users\Admin\PrevAI-compliance\`.
- Annotare nome, data e perimetro nella `DPIA.md` §8.
- **Riportare le risposte nel codice**, regola per regola: in `lib/config/src/fiscale/regole/2026.ts` si cambia `revisione` da `{ stato: "non_revisionata" }` a `{ stato: "confermata" | "con_condizione" | "corretta", da: "<nome, albo>", il: "<AAAA-MM-GG>", nota: "<condizione>" }`. Se un valore va corretto, si corregge il parametro **e** si segna `corretta`.
- **Compilare i 5 casi golden** in `lib/config/src/fiscale/golden.ts` (`attesi`) con i valori che ha dato lui. Da quel momento il test è un vincolo e ogni modifica futura alle regole deve ripassare da lui.
- Verifica finale: `pnpm --filter @workspace/api-server exec vitest run src/fiscale` — c'è un test che controlla proprio che le due cose restino allineate (regole confermate ⇒ golden compilati, e viceversa).
- Quando tutte e 19 sono ✅, `Calcolo.revisionato` diventa `true` da solo e l'avviso "numeri non verificati" sparisce dalla pagina Fisco e dallo scadenzario, e il prospetto F24 perde l'avvertenza sui codici. Nessun'altra modifica serve.

**Finché la revisione non è chiusa**, il modulo A-2 resta acceso solo per le imprese a cui si mette il flag `fiscal_engine` a mano (RUNBOOKS §7.2): nessun piano lo include e nessuna impresa lo vede.

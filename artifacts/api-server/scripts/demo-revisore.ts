// APP-6 (docs/APP-STORE-KIT.md §5): riempie l'account demo che Apple e Google
// usano per la revisione dell'app, così il revisore apre PrevAI e trova
// preventivi, clienti e listino veri invece di una dashboard vuota.
//
// L'account si crea a mano dal sito (registrazione + onboarding) con una
// casella del titolare, es. revisione@prevai.it: lo script non crea utenti e
// non tocca password. Poi:
//
//   DATABASE_URL=… pnpm --filter @workspace/api-server ops:demo-revisore --email revisione@prevai.it
//   DATABASE_URL=… pnpm --filter @workspace/api-server ops:demo-revisore --email revisione@prevai.it --apply
//
// Senza --apply mostra cosa farebbe. Si rifiuta se l'account ha già dei
// preventivi (non si mescola mai con un'impresa vera) o se l'onboarding non è
// finito. Nessuna email parte: niente automazioni, clienti su domini
// `.invalid`, nessun promemoria programmato (next_follow_up_at resta vuoto).

import pg from "pg";

type Voce = { descrizione: string; quantita: number; um: string; prezzoUnitario: number; totale: number };
type Capitolo = { lettera: string; titolo: string; voci: Voce[]; subtotale: number };

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i === -1 ? undefined : process.argv[i + 1];
}

const tondo = (n: number) => Math.round(n * 100) / 100;

function capitolo(lettera: string, titolo: string, voci: Array<[string, number, string, number]>): Capitolo {
  const righe = voci.map(([descrizione, quantita, um, prezzoUnitario]) => ({ descrizione, quantita, um, prezzoUnitario, totale: tondo(quantita * prezzoUnitario) }));
  return { lettera, titolo, voci: righe, subtotale: tondo(righe.reduce((s, v) => s + v.totale, 0)) };
}

const CLIENTI = [
  { chiave: "rossi", nome: "Laura Rossi", email: "laura.rossi@demo.invalid", telefono: "3331234567", indirizzo: "Via Garibaldi 12", citta: "Monza", provincia: "MB", cap: "20900" },
  { chiave: "bianchi", nome: "Condominio Bianchi", email: "amministrazione@demo.invalid", telefono: "0391234567", indirizzo: "Viale Lombardia 88", citta: "Monza", provincia: "MB", cap: "20900" },
  { chiave: "verdi", nome: "Marco Verdi", email: "marco.verdi@demo.invalid", telefono: "3479876543", indirizzo: "Via Manzoni 3", citta: "Milano", provincia: "MI", cap: "20121" },
] as const;

type Preventivo = {
  cliente: (typeof CLIENTI)[number]["chiave"];
  descrizione: string;
  capitoli: Capitolo[];
  iva: number;
  stato: "draft" | "unlocked" | "accepted";
  inviato: boolean;
  giorniFa: number;
};

const PREVENTIVI: Preventivo[] = [
  {
    cliente: "rossi",
    descrizione: "Rifacimento completo del bagno principale: demolizione, nuovi impianti, rivestimenti e sanitari sospesi.",
    capitoli: [
      capitolo("A", "Demolizioni", [["Rimozione sanitari e rivestimenti esistenti", 1, "a corpo", 650], ["Trasporto e smaltimento macerie", 1, "a corpo", 280]]),
      capitolo("B", "Impianti", [["Impianto idrico-sanitario completo", 1, "a corpo", 1800], ["Punti luce e prese", 6, "cad", 65]]),
      capitolo("C", "Finiture", [["Posa piastrelle a pavimento e rivestimento", 24, "m²", 48], ["Sanitari sospesi con cassetta a incasso", 1, "a corpo", 1150]]),
    ],
    iva: 10,
    stato: "accepted",
    inviato: true,
    giorniFa: 12,
  },
  {
    cliente: "bianchi",
    descrizione: "Tinteggiatura del vano scala condominiale (4 piani) con ripristino delle parti ammalorate.",
    capitoli: [
      capitolo("A", "Preparazione", [["Protezione pavimenti e corrimano", 1, "a corpo", 220], ["Raschiatura e stuccatura parti ammalorate", 60, "m²", 9]]),
      capitolo("B", "Tinteggiatura", [["Pittura traspirante due mani", 320, "m²", 7.5]]),
    ],
    iva: 22,
    stato: "unlocked",
    inviato: true,
    giorniFa: 4,
  },
  {
    cliente: "verdi",
    descrizione: "Sostituzione di 5 finestre in PVC con vetrocamera basso emissivo, compreso smontaggio dei serramenti vecchi.",
    capitoli: [
      capitolo("A", "Serramenti", [["Finestra PVC due ante 120×140", 4, "cad", 690], ["Portafinestra PVC 90×220", 1, "cad", 980]]),
      capitolo("B", "Posa", [["Smontaggio e smaltimento serramenti esistenti", 5, "cad", 60], ["Posa in opera con schiuma e sigillatura", 5, "cad", 120]]),
    ],
    iva: 10,
    stato: "draft",
    inviato: false,
    giorniFa: 1,
  },
];

const LISTINO: Array<[string, string, string, number]> = [
  ["Posa piastrelle", "Finiture", "m²", 48],
  ["Pittura traspirante due mani", "Tinteggiatura", "m²", 7.5],
  ["Ora di manodopera specializzata", "Manodopera", "h", 38],
  ["Smaltimento macerie", "Demolizioni", "a corpo", 280],
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const email = argomento("--email")?.trim().toLowerCase();
  if (!url || !email) {
    console.error("Servono DATABASE_URL e --email <casella dell'account demo>");
    process.exit(2);
  }
  const apply = process.argv.includes("--apply");

  const pool = new pg.Pool({ connectionString: url, ssl: url.includes("sslmode=disable") || url.includes("127.0.0.1") || url.includes("localhost") ? undefined : { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  try {
    const utente = await client.query<{ id: string; company_name: string | null; preventivi: string }>(
      `select u.id, bp.company_name,
              (select count(*) from quotes q where q.user_id = u.id)::text as preventivi
         from auth_user u left join business_profiles bp on bp.user_id = u.id
        where lower(u.email) = $1`,
      [email],
    );
    const riga = utente.rows[0];
    if (!riga) {
      console.error(`Nessun account con email ${email}: registralo prima dal sito e completa l'onboarding.`);
      process.exit(1);
    }
    if (!riga.company_name) {
      console.error("L'onboarding non è finito (manca la ragione sociale): completalo dal sito, poi rilancia.");
      process.exit(1);
    }
    if (Number(riga.preventivi) > 0) {
      console.error(`L'account ha già ${riga.preventivi} preventivi: lo script riempie solo un account demo vuoto e si ferma qui.`);
      process.exit(1);
    }

    console.log(`Account demo: ${email} (${riga.company_name})`);
    console.log(`  ${CLIENTI.length} clienti, ${PREVENTIVI.length} preventivi (accettato, inviato, bozza), ${LISTINO.length} voci di listino`);
    if (!apply) {
      console.log("Prova a vuoto: niente scritto. Aggiungi --apply per scrivere.");
      return;
    }

    await client.query("begin");
    const idCliente = new Map<string, string>();
    for (const c of CLIENTI) {
      const { rows } = await client.query<{ id: string }>(
        `insert into clients (user_id, name, email, phone, address, city, province, postal_code, dedup_key, marketing_unsubscribe_token)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, gen_random_uuid()::text) returning id`,
        [riga.id, c.nome, c.email, c.telefono, c.indirizzo, c.citta, c.provincia, c.cap, `demo-revisore-${c.chiave}`],
      );
      idCliente.set(c.chiave, rows[0]!.id);
    }
    for (const p of PREVENTIVI) {
      const c = CLIENTI.find((x) => x.chiave === p.cliente)!;
      const subtotale = tondo(p.capitoli.reduce((s, x) => s + x.subtotale, 0));
      const iva = tondo(subtotale * p.iva / 100);
      const quando = new Date(Date.now() - p.giorniFa * 86_400_000);
      await client.query(
        `insert into quotes (user_id, client_id, province, client_data, descrizione_generale, capitoli, condizioni_pagamento,
                             subtotale, iva_percentuale, iva_valore, totale, status, sent_at, accepted_at, accepted_by_name,
                             unsubscribe_token, source, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, gen_random_uuid()::text, 'web', $16, $16)`,
        [
          riga.id, idCliente.get(p.cliente), c.provincia,
          JSON.stringify({ nome: c.nome, indirizzo: c.indirizzo, city: c.citta, province: c.provincia, postalCode: c.cap, email: c.email, phone: c.telefono }),
          p.descrizione, JSON.stringify(p.capitoli), ["30% acconto alla firma", "40% a metà lavori", "30% a fine lavori"],
          String(subtotale), String(p.iva), String(iva), String(tondo(subtotale + iva)), p.stato,
          p.inviato ? quando : null,
          p.stato === "accepted" ? new Date(quando.getTime() + 2 * 86_400_000) : null,
          p.stato === "accepted" ? c.nome : null,
          quando,
        ],
      );
    }
    for (const [nome, categoria, um, prezzo] of LISTINO) {
      await client.query(
        `insert into price_catalog_items (user_id, nome, categoria, um, prezzo_unitario) values ($1, $2, $3, $4, $5)`,
        [riga.id, nome, categoria, um, String(prezzo)],
      );
    }
    await client.query("commit");
    console.log("Fatto. Controlla dal sito entrando come l'account demo.");
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

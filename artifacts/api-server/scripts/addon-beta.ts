// A-5 (docs/RUNBOOKS.md §10.4): porta gli utenti beta del modulo
// Amministrazione dai feature flag all'add-on.
//
// Prima del lancio il modulo si accendeva a mano con i flag
// `sdi_invoicing` / `fiscal_engine` / `admin_suite` sul profilo. Un flag a
// true vince su tutto (anche su un abbonamento cessato) e non scade mai: al
// lancio va convertito in un add-on in stato `beta` con una data di fine,
// dopo la quale l'impresa vede il paywall come tutti.
//
//   DATABASE_URL=… pnpm --filter @workspace/api-server ops:addon-beta
//   DATABASE_URL=… pnpm --filter @workspace/api-server ops:addon-beta --apply --fino 2027-01-31
//
// Senza --apply elenca e basta. Idempotente: chi è già in beta con la stessa
// data, o paga l'add-on, viene saltato. I flag a false (spegnimenti espliciti)
// non si toccano. Non accende la 2FA obbligatoria: il webhook lo fa quando
// l'impresa si abbona, e imporla qui chiuderebbe fuori chi non l'ha ancora.

import pg from "pg";

const FLAG = ["sdi_invoicing", "fiscal_engine", "admin_suite"] as const;
const VARIANTE_PREDEFINITA = "a";

type Riga = {
  user_id: string;
  company_name: string;
  feature_flags: Record<string, boolean> | null;
  addons: { amministrazione?: { stato?: string; betaFino?: string; variante?: string } } | null;
};

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }
  const apply = process.argv.includes("--apply");
  const fino = argomento("--fino");
  let finoIso: string | null = null;
  if (apply) {
    if (!fino || !/^\d{4}-\d{2}-\d{2}$/.test(fino)) {
      console.error("--apply richiede --fino AAAA-MM-GG (ultimo giorno di accesso gratuito)");
      process.exit(2);
    }
    const data = new Date(`${fino}T23:59:59+01:00`);
    if (!Number.isFinite(data.getTime()) || data.getTime() <= Date.now()) {
      console.error("--fino deve essere una data futura");
      process.exit(2);
    }
    finoIso = data.toISOString();
  }

  const pool = new pg.Pool({ connectionString: url, ssl: url.includes("sslmode=disable") || url.includes("127.0.0.1") || url.includes("localhost") ? undefined : { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  try {
    const { rows } = await client.query<Riga>(
      `SELECT user_id, company_name, feature_flags, addons FROM business_profiles
        WHERE (feature_flags->>'sdi_invoicing') = 'true' OR (feature_flags->>'fiscal_engine') = 'true' OR (feature_flags->>'admin_suite') = 'true'
        ORDER BY created_at`,
    );
    const daFare: Riga[] = [];
    for (const r of rows) {
      const abb = r.addons?.amministrazione;
      const accesi = FLAG.filter((f) => r.feature_flags?.[f] === true);
      let nota = "";
      if (abb?.stato === "attivo" || abb?.stato === "prova" || abb?.stato === "insoluto") nota = "paga già l'add-on: si tolgono solo i flag";
      else if (abb?.stato === "beta" && abb.betaFino === finoIso) nota = "già in beta con questa data";
      console.log(`${r.user_id}  ${r.company_name || "(senza nome)"}  flag: ${accesi.join(", ")}  add-on: ${abb?.stato ?? "nessuno"}${nota ? `  — ${nota}` : ""}`);
      if (nota !== "già in beta con questa data") daFare.push(r);
    }
    console.log(`\n${rows.length} imprese con il modulo acceso da flag, ${daFare.length} da convertire.`);
    if (!apply) {
      console.log("Prova a secco: nessuna modifica. Rilancia con --apply --fino AAAA-MM-GG.");
      return;
    }

    await client.query("BEGIN");
    const ora = new Date().toISOString();
    for (const r of daFare) {
      const abb = r.addons?.amministrazione ?? {};
      const paga = abb.stato === "attivo" || abb.stato === "prova" || abb.stato === "insoluto";
      const flags = { ...(r.feature_flags ?? {}) };
      for (const f of FLAG) if (flags[f] === true) delete flags[f];
      const nuovo = paga ? abb : { ...abb, stato: "beta", betaFino: finoIso, variante: abb.variante ?? VARIANTE_PREDEFINITA, aggiornatoIl: ora };
      await client.query(
        `UPDATE business_profiles SET feature_flags = $2::jsonb, addons = coalesce(addons, '{}'::jsonb) || jsonb_build_object('amministrazione', $3::jsonb) WHERE user_id = $1`,
        [r.user_id, JSON.stringify(flags), JSON.stringify(nuovo)],
      );
      if (!paga) {
        await client.query(`INSERT INTO addon_events (user_id, addon, variante, tipo) VALUES ($1, 'amministrazione', $2, 'beta')`, [r.user_id, nuovo.variante ?? VARIANTE_PREDEFINITA]);
      }
    }
    await client.query("COMMIT");
    console.log(`Convertite ${daFare.length} imprese: beta fino al ${fino}.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

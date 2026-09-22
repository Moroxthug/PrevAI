import { createHash } from "node:crypto";
import {
  db,
  supplierEInvoicesTable,
  costEntriesTable,
  suppliersTable,
  projectsTable,
  normalizzaPartitaIva,
  COST_CATEGORIES,
  type SupplierEInvoice,
  type CostCategory,
} from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { writeAudit, createNotification } from "../lib/notifications.js";
import { impostazioniOCrea, ErroreSdi } from "./service.js";
import { intermediarioPer } from "./providers/index.js";

const storage = new ObjectStorageService();

// ── A-1: ciclo passivo ───────────────────────────────────────────────────────
// Le fatture di acquisto (materiali, subappalti) arrivano gratis dallo SdI e
// valgono oro: sono i costi del cantiere senza che nessuno digiti niente.
//
// Due vincoli che vengono dal Garante (Provv. fatturazione elettronica
// 2018-2019) e stanno nel codice, non solo nella policy:
//   * la ricezione è un'adesione **esplicita** dell'utente
//     (`sdi_settings.ciclo_passivo_attivo`): senza, non si scarica nulla;
//   * la fattura passiva resta "nuova" finché è l'utente a collegarla a un
//     cantiere: nessuna categorizzazione automatica con effetti contabili.

export type EsitoSincronizzazione = { scaricate: number; nuove: number; saltate: number };

/** Scarica dall'intermediario le fatture di acquisto non ancora viste. */
export async function sincronizzaPassive(params: { userId: string; da?: Date | null }): Promise<EsitoSincronizzazione> {
  const settings = await impostazioniOCrea(params.userId);
  if (!settings.cicloPassivoAttivo) {
    throw new ErroreSdi("ciclo_passivo_spento", "La ricezione delle fatture di acquisto non è attiva: attivala nelle impostazioni del modulo.");
  }
  const intermediario = intermediarioPer(settings);
  const documenti = await intermediario.scaricaPassive({ da: params.da ?? null });
  let nuove = 0;
  let saltate = 0;

  for (const doc of documenti) {
    let xmlPath: string | null = null;
    let xmlHash: string | null = null;
    if (doc.xml) {
      xmlHash = createHash("sha256").update(doc.xml).digest("hex");
      xmlPath = `sdi/${params.userId}/passive/${doc.fileName || `${doc.providerDocumentId}.xml`}`;
      try {
        await storage.uploadObjectBuffer({ subPath: xmlPath, buffer: Buffer.from(doc.xml, "utf8"), contentType: "application/xml" });
      } catch (err) {
        logger.warn({ err, providerDocumentId: doc.providerDocumentId }, "XML della fattura passiva non archiviato");
        xmlPath = null;
      }
    }
    const [inserita] = await db
      .insert(supplierEInvoicesTable)
      .values({
        userId: params.userId,
        provider: settings.provider,
        providerDocumentId: doc.providerDocumentId,
        fileName: doc.fileName,
        xmlPath,
        xmlHash,
        fornitoreNome: doc.fornitoreNome,
        fornitorePartitaIva: doc.fornitorePartitaIva,
        fornitoreCodiceFiscale: doc.fornitoreCodiceFiscale,
        supplierId: await fornitoreEsistente(params.userId, doc.fornitoreNome, doc.fornitorePartitaIva),
        numero: doc.numero,
        data: doc.data,
        tipoDocumento: doc.tipoDocumento,
        imponibileCents: doc.imponibileCents,
        ivaCents: doc.ivaCents,
        totaleCents: doc.totaleCents,
        valuta: doc.valuta,
        righe: doc.righe,
      })
      .onConflictDoNothing()
      .returning();
    if (inserita) nuove++;
    else saltate++;
  }

  if (nuove > 0) {
    await createNotification({
      userId: params.userId,
      type: "sdi_fatture_passive",
      title: nuove === 1 ? "1 nuova fattura di acquisto" : `${nuove} nuove fatture di acquisto`,
      body: "Sono arrivate dallo SdI: collegale a un cantiere per farle entrare nei costi.",
      link: "/dashboard/costs",
    });
  }
  return { scaricate: documenti.length, nuove, saltate };
}

/** Il fornitore già in anagrafica, riconosciuto dalla P. IVA o dal nome. */
async function fornitoreEsistente(userId: string, nome: string, partitaIva: string | null): Promise<string | null> {
  const piva = normalizzaPartitaIva(partitaIva);
  const candidati = await db.select().from(suppliersTable).where(eq(suppliersTable.userId, userId));
  const perNome = nome.trim().toLowerCase();
  const trovato = candidati.find((s) => s.name.trim().toLowerCase() === perNome) ?? (piva ? candidati.find((s) => s.contactInfo.includes(piva)) : undefined);
  return trovato?.id ?? null;
}

export async function listaPassive(params: { userId: string; stato?: SupplierEInvoice["stato"] }): Promise<SupplierEInvoice[]> {
  const dove = params.stato
    ? and(eq(supplierEInvoicesTable.userId, params.userId), eq(supplierEInvoicesTable.stato, params.stato))
    : eq(supplierEInvoicesTable.userId, params.userId);
  return db.select().from(supplierEInvoicesTable).where(dove).orderBy(desc(supplierEInvoicesTable.ricevutaAt)).limit(500);
}

export async function passiveDaLavorare(userId: string): Promise<number> {
  const righe = await db
    .select({ id: supplierEInvoicesTable.id })
    .from(supplierEInvoicesTable)
    .where(and(eq(supplierEInvoicesTable.userId, userId), eq(supplierEInvoicesTable.stato, "nuova"), isNull(supplierEInvoicesTable.costEntryId)));
  return righe.length;
}

/**
 * Collega la fattura di acquisto a un cantiere creando il costo. L'importo
 * che entra nei costi è l'imponibile: nel forfettario l'IVA pagata ai
 * fornitori non si detrae ma è un costo a tutti gli effetti, quindi se la
 * fattura ha IVA si somma (il margine di cantiere dev'essere quello vero).
 */
export async function collegaACantiere(params: {
  userId: string;
  id: string;
  projectId: string;
  category?: CostCategory;
  milestoneId?: string | null;
  ip?: string | null;
}): Promise<SupplierEInvoice> {
  const [passiva] = await db.select().from(supplierEInvoicesTable).where(and(eq(supplierEInvoicesTable.id, params.id), eq(supplierEInvoicesTable.userId, params.userId)));
  if (!passiva) throw new ErroreSdi("not_found", "Fattura di acquisto non trovata.");
  if (passiva.costEntryId) throw new ErroreSdi("gia_collegata", "Questa fattura è già collegata a un cantiere.");
  const [progetto] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, params.projectId), eq(projectsTable.userId, params.userId)));
  if (!progetto) throw new ErroreSdi("not_found", "Cantiere non trovato.");

  const category: CostCategory = params.category && COST_CATEGORIES.includes(params.category) ? params.category : "materials";
  const [costo] = await db
    .insert(costEntriesTable)
    .values({
      userId: params.userId,
      projectId: params.projectId,
      milestoneId: params.milestoneId ?? null,
      category,
      vendor: passiva.fornitoreNome,
      supplierId: passiva.supplierId,
      description: `Fattura ${passiva.numero}`.trim(),
      date: passiva.data ?? passiva.ricevutaAt,
      subtotalCents: passiva.imponibileCents,
      taxCents: passiva.ivaCents,
      taxBreakdown: passiva.ivaCents ? { IVA: passiva.ivaCents } : {},
      totalCents: passiva.totaleCents || passiva.imponibileCents + passiva.ivaCents,
      status: "confirmed",
      source: "supplier_invoice",
      createdBy: "user",
      confirmedAt: new Date(),
    })
    .returning();

  const [aggiornata] = await db
    .update(supplierEInvoicesTable)
    .set({ stato: "collegata", costEntryId: costo!.id, projectId: params.projectId })
    .where(eq(supplierEInvoicesTable.id, passiva.id))
    .returning();

  await writeAudit({
    userId: params.userId,
    actorType: "user",
    actorId: params.userId,
    entityType: "supplier_e_invoice",
    entityId: passiva.id,
    action: "linked_to_job",
    diff: { projectId: params.projectId, costEntryId: costo!.id, totaleCents: passiva.totaleCents },
    ip: params.ip,
  });
  return aggiornata!;
}

export async function ignoraPassiva(params: { userId: string; id: string; ip?: string | null }): Promise<SupplierEInvoice> {
  const [aggiornata] = await db
    .update(supplierEInvoicesTable)
    .set({ stato: "ignorata" })
    .where(and(eq(supplierEInvoicesTable.id, params.id), eq(supplierEInvoicesTable.userId, params.userId)))
    .returning();
  if (!aggiornata) throw new ErroreSdi("not_found", "Fattura di acquisto non trovata.");
  await writeAudit({ userId: params.userId, actorType: "user", actorId: params.userId, entityType: "supplier_e_invoice", entityId: params.id, action: "ignored", ip: params.ip });
  return aggiornata;
}

export function serializzaPassiva(p: SupplierEInvoice) {
  return {
    id: p.id,
    numero: p.numero,
    data: p.data?.toISOString() ?? null,
    tipoDocumento: p.tipoDocumento,
    fornitoreNome: p.fornitoreNome,
    fornitorePartitaIva: p.fornitorePartitaIva,
    imponibileCents: p.imponibileCents,
    ivaCents: p.ivaCents,
    totaleCents: p.totaleCents,
    valuta: p.valuta,
    righe: p.righe,
    stato: p.stato,
    projectId: p.projectId,
    costEntryId: p.costEntryId,
    fileName: p.fileName,
    xmlDisponibile: Boolean(p.xmlPath),
    ricevutaAt: p.ricevutaAt.toISOString(),
  };
}

/** XML della passiva, per chi vuole portarselo via o darlo al commercialista. */
export async function xmlPassiva(params: { userId: string; id: string }): Promise<{ fileName: string; xml: string }> {
  const [passiva] = await db.select().from(supplierEInvoicesTable).where(and(eq(supplierEInvoicesTable.id, params.id), eq(supplierEInvoicesTable.userId, params.userId)));
  if (!passiva?.xmlPath) throw new ErroreSdi("not_found", "File XML non disponibile.");
  const risposta = await storage.downloadPrivateObject(passiva.xmlPath);
  if (!risposta.ok) throw new ErroreSdi("storage", "File XML non leggibile.");
  return { fileName: passiva.fileName || `${passiva.numero}.xml`, xml: await risposta.text() };
}

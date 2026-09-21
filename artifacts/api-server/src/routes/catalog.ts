import { Router } from "express";
import multer from "multer";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import type { Response } from "express";
import { db, priceCatalogItemsTable, quotesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import type { QuoteChapter } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { extractFromPdf, extractFromDocx, extractFromXlsx } from "../lib/extractDocument.js";
import { userRateLimiter } from "../lib/rateLimit.js";

const router = Router();

const OCR_ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const OCR_ALLOWED_DOC_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const OCR_ALLOWED_MIMES = [...OCR_ALLOWED_IMAGE_MIMES, ...OCR_ALLOWED_DOC_MIMES];

const catalogOcrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (OCR_ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato non supportato: ${file.mimetype}. Usa JPG, PNG, WEBP, HEIC, PDF, DOCX o XLSX.`));
    }
  },
});

// Import del listino via OCR è un'operazione occasionale (non ripetuta a
// ogni preventivo come la generazione AI), quindi un tetto orario più basso
// basta a contenere i costi senza intralciare l'uso normale.
const catalogOcrLimiter = userRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: "Hai raggiunto il limite orario di importazioni listino. Riprova più tardi.",
});

const OCR_PROMPT = `Sei un assistente che estrae un LISTINO PREZZI da un'immagine (foto di un listino cartaceo o a schermo) o da testo estratto da un documento (PDF, DOCX, XLSX).

Per ogni voce di listino individuata, restituisci un oggetto con:
- nome: descrizione della lavorazione o dell'articolo
- categoria: categoria generale (es. "Tinteggiatura", "Impianto elettrico", "Impianto idraulico", "Opere edili"), null se non deducibile
- um: unità di misura tra mq, ml, mc, cad, ore, kg, "a.c.", pezzi, kw, lt, t, m, %
- prezzoUnitario: numero (solo la cifra in euro, senza simbolo né separatori di migliaia)
- note: eventuali dettagli aggiuntivi, stringa vuota se assenti

REGOLE FONDAMENTALI:
1. Estrai SOLO voci con un prezzo unitario chiaramente leggibile o deducibile dal contesto. Se una riga non ha un prezzo leggibile, scartala: non inventare prezzi.
2. Se un prezzo è indicato come range (es. "10-15€"), usa il valore medio.
3. Correggi refusi OCR evidenti solo quando il contesto li rende inequivocabili; in caso di dubbio, scarta la voce piuttosto che indovinare.
4. Massimo 200 voci.

OUTPUT: SOLO un array JSON valido, nessun testo o markdown extra:
[{ "nome": "...", "categoria": "...", "um": "...", "prezzoUnitario": 0, "note": "" }]`;

function serializeItem(item: typeof priceCatalogItemsTable.$inferSelect) {
  return {
    id: item.id,
    userId: item.userId,
    nome: item.nome,
    categoria: item.categoria ?? null,
    um: item.um,
    prezzoUnitario: Number(item.prezzoUnitario),
    note: item.note ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/catalog", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const items = await db
      .select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome);
    res.json(items.map(serializeItem));
  } catch (err) {
    req.log.error({ err }, "Error listing catalog items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/catalog", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { nome, categoria, um, prezzoUnitario, note } = req.body as {
      nome?: string;
      categoria?: string;
      um?: string;
      prezzoUnitario?: number;
      note?: string;
    };

    if (!nome || !um || prezzoUnitario === undefined) {
      res.status(400).json({ error: "nome, um e prezzoUnitario sono obbligatori" });
      return;
    }

    const [created] = await db
      .insert(priceCatalogItemsTable)
      .values({
        userId,
        nome: nome.trim(),
        categoria: categoria?.trim() || null,
        um: um.trim(),
        prezzoUnitario: String(prezzoUnitario),
        note: note?.trim() || null,
      })
      .returning();

    res.status(201).json(serializeItem(created));
  } catch (err) {
    req.log.error({ err }, "Error creating catalog item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/catalog/bulk", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const items = req.body as Array<{
      nome?: string;
      categoria?: string;
      um?: string;
      prezzoUnitario?: number;
      note?: string;
    }>;

    if (!Array.isArray(items)) {
      res.status(400).json({ error: "body must be an array of items" });
      return;
    }

    const inserted = [];
    if (items.length > 0) {
      const values = items.map(item => {
        if (!item.nome || !item.um || item.prezzoUnitario === undefined) {
          throw new Error("Invalid item in bulk array: nome, um, prezzoUnitario are required");
        }
        return {
          userId,
          nome: item.nome.trim(),
          categoria: item.categoria?.trim() || null,
          um: item.um.trim(),
          prezzoUnitario: String(item.prezzoUnitario),
          note: item.note?.trim() || null,
        };
      });

      const result = await db.insert(priceCatalogItemsTable).values(values).returning();
      inserted.push(...result.map(serializeItem));
    }

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Error bulk creating catalog items");
    res.status(500).json({ error: (err instanceof Error ? err.message : "Internal server error") });
  }
});


router.post("/catalog/import-from-quotes", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const quotes = await db
      .select({ capitoli: quotesTable.capitoli })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId));

    const existing = await db
      .select({ nome: priceCatalogItemsTable.nome, um: priceCatalogItemsTable.um })
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId));

    const existingKeys = new Set(
      existing.map(e => `${e.nome.toLowerCase().trim()}|${e.um.toLowerCase().trim()}`)
    );

    const seen = new Map<string, { nome: string; um: string; prezzoUnitario: number; count: number }>();

    for (const quote of quotes) {
      const capitoli = quote.capitoli as QuoteChapter[] | null;
      if (!Array.isArray(capitoli)) continue;
      for (const cap of capitoli) {
        for (const voce of cap.voci) {
          const key = `${voce.descrizione.toLowerCase().trim()}|${voce.um.toLowerCase().trim()}`;
          if (existingKeys.has(key)) continue;
          const current = seen.get(key);
          if (current) {
            current.prezzoUnitario =
              (current.prezzoUnitario * current.count + voce.prezzoUnitario) / (current.count + 1);
            current.count++;
          } else {
            seen.set(key, {
              nome: voce.descrizione.trim(),
              um: voce.um.trim(),
              prezzoUnitario: voce.prezzoUnitario,
              count: 1,
            });
          }
        }
      }
    }

    const toInsert = Array.from(seen.values());
    let imported = 0;
    const skipped = existing.length;

    if (toInsert.length > 0) {
      await db.insert(priceCatalogItemsTable).values(
        toInsert.map(item => ({
          userId,
          nome: item.nome,
          um: item.um,
          prezzoUnitario: String(Math.round(item.prezzoUnitario * 100) / 100),
          categoria: null,
          note: null,
        }))
      );
      imported = toInsert.length;
    }

    res.json({ imported, skipped });
  } catch (err) {
    req.log.error({ err }, "Error importing catalog from quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/catalog/import-ocr — legge una foto o un documento del listino
// dell'utente e ne estrae le voci via AI. Restituisce solo un'ANTEPRIMA:
// l'inserimento vero avviene con una chiamata separata a POST /catalog/bulk
// dopo che l'utente ha rivisto/corretto le voci, per evitare che un errore
// di lettura OCR inquini silenziosamente il listino.
router.post(
  "/catalog/import-ocr",
  requireAuth,
  catalogOcrLimiter,
  catalogOcrUpload.array("files", 3),
  async (req, res) => {
    try {
      const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
      if (uploadedFiles.length === 0) {
        res.status(400).json({ error: "Carica almeno una foto o un documento del listino." });
        return;
      }

      const imageFiles = uploadedFiles.filter(f => OCR_ALLOWED_IMAGE_MIMES.includes(f.mimetype));
      const docFiles = uploadedFiles.filter(f => OCR_ALLOWED_DOC_MIMES.includes(f.mimetype));

      const imageDataUrls = imageFiles.map(
        (f) => `data:${f.mimetype};base64,${f.buffer.toString("base64")}`
      );

      const docTexts: string[] = [];
      for (const f of docFiles) {
        let text = "";
        if (f.mimetype === "application/pdf") text = await extractFromPdf(f.buffer);
        else if (f.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") text = await extractFromDocx(f.buffer);
        else if (f.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") text = await extractFromXlsx(f.buffer);
        if (text) docTexts.push(`--- File: ${f.originalname} ---\n${text}`);
      }

      const hasImages = imageDataUrls.length > 0;
      if (!hasImages && docTexts.length === 0) {
        res.status(422).json({ error: "Non è stato possibile leggere alcun contenuto dai file caricati." });
        return;
      }

      const userText = docTexts.length > 0
        ? `Testo estratto dal/dai documento/i caricato/i:\n\n${docTexts.join("\n\n")}`
        : "Estrai il listino prezzi dalle immagini allegate.";

      const targetModel = hasImages ? "gpt-4o" : "gpt-4o-mini";
      const completion = await openai.chat.completions.create({
        model: targetModel,
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: OCR_PROMPT },
          {
            role: "user",
            content: hasImages
              ? [
                  { type: "text" as const, text: userText },
                  ...imageDataUrls.map(img => ({
                    type: "image_url" as const,
                    image_url: { url: img, detail: "high" as const },
                  })),
                ]
              : userText,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content ?? "[]";
      let parsedItems: any[] = [];
      try {
        const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        const parsed = JSON.parse(cleaned);
        parsedItems = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
      } catch (err) {
        req.log.error({ err, content }, "Failed to parse OCR catalog JSON");
        res.status(422).json({ error: "L'AI non è riuscita a leggere un listino da questi file. Prova con una foto più nitida." });
        return;
      }

      const items = parsedItems
        .filter((it) => it && it.nome && it.um && it.prezzoUnitario !== undefined && it.prezzoUnitario !== null)
        .slice(0, 200)
        .map((it) => ({
          nome: String(it.nome).trim(),
          categoria: it.categoria ? String(it.categoria).trim() : null,
          um: String(it.um).trim(),
          prezzoUnitario: Number(it.prezzoUnitario) || 0,
          note: it.note ? String(it.note).trim() : null,
        }));

      if (items.length === 0) {
        res.status(422).json({ error: "Nessuna voce con prezzo leggibile trovata in questi file." });
        return;
      }

      res.json({ items });
    } catch (err) {
      req.log.error({ err }, "Error importing catalog via OCR");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.put("/catalog/:id", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id);
    const { nome, categoria, um, prezzoUnitario, note } = req.body as {
      nome?: string;
      categoria?: string;
      um?: string;
      prezzoUnitario?: number;
      note?: string;
    };

    const updates: Partial<typeof priceCatalogItemsTable.$inferInsert> = {};
    if (nome !== undefined) updates.nome = nome.trim();
    if (categoria !== undefined) updates.categoria = categoria?.trim() || null;
    if (um !== undefined) updates.um = um.trim();
    if (prezzoUnitario !== undefined) updates.prezzoUnitario = String(prezzoUnitario);
    if (note !== undefined) updates.note = note?.trim() || null;

    const [updated] = await db
      .update(priceCatalogItemsTable)
      .set(updates)
      .where(and(eq(priceCatalogItemsTable.id, id), eq(priceCatalogItemsTable.userId, userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Voce non trovata" });
      return;
    }

    res.json(serializeItem(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating catalog item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/catalog/:id", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id);

    const deleted = await db
      .delete(priceCatalogItemsTable)
      .where(and(eq(priceCatalogItemsTable.id, id), eq(priceCatalogItemsTable.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Voce non trovata" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting catalog item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

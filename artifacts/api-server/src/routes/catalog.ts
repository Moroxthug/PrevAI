import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, priceCatalogItemsTable, quotesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import type { QuoteChapter } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router = Router();

function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

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

// GET /api/catalog
router.get("/catalog", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
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

// POST /api/catalog
router.post("/catalog", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
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

// POST /api/catalog/import-from-quotes
router.post("/catalog/import-from-quotes", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);

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

// PUT /api/catalog/:id
router.put("/catalog/:id", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
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

// DELETE /api/catalog/:id
router.delete("/catalog/:id", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
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

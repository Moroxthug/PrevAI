import { db, quotesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { formatQuoteNumber } from "@workspace/config";

/**
 * Genera il prossimo numero di preventivo dell'impresa, nel formato di
 * PrevAI v1: "N° {progressivo}.{anno} del {gg}/{mm}/{anno}".
 * Il progressivo è count(preventivi esistenti) + 1.
 */
export async function generateNumeroPreventivo(userId: string): Promise<string> {
  const [result] = await db
    .select({ count: count() })
    .from(quotesTable)
    .where(eq(quotesTable.userId, userId));

  return formatQuoteNumber(Number(result?.count ?? 0) + 1);
}

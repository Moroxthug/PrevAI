// vitest suite (Phase 61): the assertions below were a plain node:assert script; now run by `pnpm test`.
import assert from "node:assert/strict";
import { computeInvoiceAmounts, termSubtotalCents, finalInvoiceSubtotalCents, lienPeriodDays, statusAfterPayment, arAging, lineFrom, taxLinesFor } from "./math.js";
import { test } from "vitest";

test("invoices/math", () => {

  // SAL con ritenuta a garanzia 10 %: IVA sul netto della ritenuta.
  const sal = computeInvoiceAmounts({ lines: [lineFrom("Opere murarie", 1_000_000)], taxCode: "IVA22", holdbackPercent: 10, registration: { vatNumber: "01234567890" } });
  assert.equal(sal.subtotalCents, 1_000_000);
  assert.equal(sal.holdbackCents, 100_000);
  assert.equal(sal.taxableCents, 900_000);
  assert.deepEqual(sal.taxLines.map((t) => [t.code, t.amountCents, t.registrationNumber]), [["IVA22", 198_000, "01234567890"]]);
  assert.equal(sal.totalCents, 1_098_000);

  // Ristrutturazione: IVA 10 %.
  const rid = computeInvoiceAmounts({ lines: [lineFrom("Idraulica", 250_000)], taxCode: "IVA10", registration: { vatNumber: "1234" } });
  assert.deepEqual(rid.taxLines.map((t) => [t.code, t.amountCents, t.registrationNumber]), [["IVA10", 25_000, "1234"]]);
  assert.equal(rid.totalCents, 275_000);

  // Acconto: niente ritenuta anche se la percentuale è 0; regime sconosciuto → 22 %.
  const acc = computeInvoiceAmounts({ lines: [lineFrom("Acconto", 100_000)], taxCode: null, holdbackPercent: 0 });
  assert.equal(acc.holdbackCents, 0);
  assert.equal(acc.taxCents, 22_000);

  // Nota di credito: righe negative, mai ritenuta, IVA negativa.
  const cn = computeInvoiceAmounts({ lines: [lineFrom("Storno", -50_000)], taxCode: "IVA22", holdbackPercent: 10 });
  assert.equal(cn.holdbackCents, 0);
  assert.equal(cn.taxCents, -11_000);
  assert.equal(cn.totalCents, -61_000);

  // Importi delle rate: percentuale dell'imponibile; importo fisso IVA inclusa scorporato.
  const contract = { subtotalCents: 2_000_000, totalCents: 2_440_000 }; // IVA 22 %
  assert.equal(termSubtotalCents({ amountType: "percent", value: 15 }, contract), 300_000);
  assert.equal(termSubtotalCents({ amountType: "fixed", value: 2440 }, contract), 200_000);

  // Final invoice = remaining unbilled, incl. change orders, never negative.
  assert.equal(finalInvoiceSubtotalCents({ jobSubtotalCents: 2_150_000, invoicedSubtotalCents: 1_700_000 }), 450_000);
  assert.equal(finalInvoiceSubtotalCents({ jobSubtotalCents: 2_000_000, invoicedSubtotalCents: 2_000_100 }), 0);

  // Lien periods.
  assert.equal(lienPeriodDays("MI"), 60);
  assert.equal(lienPeriodDays(null), 60);

  // Status transitions.
  const due = new Date("2026-09-01T00:00:00Z");
  const before = new Date("2026-08-20T00:00:00Z");
  const after = new Date("2026-09-10T00:00:00Z");
  assert.equal(statusAfterPayment({ status: "sent", totalCents: 1000, paidCents: 0, dueDate: due, now: before }), "sent");
  assert.equal(statusAfterPayment({ status: "viewed", totalCents: 1000, paidCents: 0, dueDate: due, now: after }), "overdue");
  assert.equal(statusAfterPayment({ status: "overdue", totalCents: 1000, paidCents: 400, dueDate: due, now: after }), "partially_paid");
  assert.equal(statusAfterPayment({ status: "overdue", totalCents: 1000, paidCents: 1000, dueDate: due, now: after }), "paid");
  assert.equal(statusAfterPayment({ status: "partially_paid", totalCents: 1000, paidCents: 0, dueDate: due, now: before }), "sent");
  assert.equal(statusAfterPayment({ status: "draft", totalCents: 1000, paidCents: 1000, dueDate: due }), "draft");
  assert.equal(statusAfterPayment({ status: "sent", totalCents: -500, paidCents: 0, dueDate: due }), "paid");

  // AR aging.
  const now = new Date("2026-09-13T00:00:00Z");
  const aging = arAging(
    [
      { status: "sent", totalCents: 1000, paidCents: 0, dueDate: new Date("2026-09-20T00:00:00Z") },
      { status: "overdue", totalCents: 1000, paidCents: 250, dueDate: new Date("2026-09-01T00:00:00Z") },
      { status: "overdue", totalCents: 500, paidCents: 0, dueDate: new Date("2026-07-01T00:00:00Z") },
      { status: "paid", totalCents: 999, paidCents: 999, dueDate: new Date("2026-01-01T00:00:00Z") },
      { status: "draft", totalCents: 999, paidCents: 0, dueDate: new Date("2026-01-01T00:00:00Z") },
    ],
    now,
  );
  assert.deepEqual(aging, { current: 1000, d1_30: 750, d31_60: 0, d61_90: 500, d90_plus: 0, totalCents: 2250, overdueCents: 1250 });

  // Righe IVA: regime ridotto e P. IVA accanto alla riga; regime sconosciuto → ordinaria.
  assert.deepEqual(taxLinesFor(10_000, "IVA10", { vatNumber: "01234567890" }).map((l) => [l.code, l.amountCents, l.registrationNumber]), [["IVA10", 1000, "01234567890"]]);
  assert.equal(taxLinesFor(10_000, null)[0]!.rate, 22);
});

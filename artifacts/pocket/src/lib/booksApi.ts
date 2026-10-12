// Le chiamate al server della schermata Libri (routes/primanota.ts); il fetch dell'app aggiunge il token e l'impresa attiva.
import { api } from "./api";
import type { BooksOverview, MovimentoDto } from "./books";

const id = encodeURIComponent;
const act = (lineId: string, azione: string, body: unknown = {}) => api<unknown>(`/api/fiscale/banca/movimenti/${id(lineId)}/${azione}`, { method: "POST", body });

export const booksApi = {
  /** La panoramica con la lista del mese (senza `month`, quello appena finito). */
  overview: (month?: string) => api<BooksOverview>(`/api/fiscale/libri${month ? `?month=${id(month)}` : ""}`),
  doClose: (month: string, note = "") => api<{ close: unknown }>("/api/fiscale/libri/chiudi", { method: "POST", body: { month, note } }),
  reopen: (month: string) => api<unknown>("/api/fiscale/libri/riapri", { method: "POST", body: { month } }),
  bank: (year: number) => api<{ movimenti: MovimentoDto[] }>(`/api/fiscale/banca?anno=${year}`),
  matchExisting: (lineId: string, tipo: string, targetId: string) => act(lineId, "abbina", { tipo, id: targetId }),
  recordPayment: (lineId: string, invoiceId: string) => act(lineId, "incasso", { invoiceId }),
  /** Un costo con la categoria generica («misc») se non se ne sceglie un’altra: si corregge poi dal cantiere o dai Documenti. */
  recordCost: (lineId: string, categoria = "misc") => act(lineId, "costo", { categoria }),
  recordMovement: (lineId: string, categoria: string) => act(lineId, "movimento", { categoria }),
  unmatch: (lineId: string) => act(lineId, "scollega"),
  ignore: (lineId: string) => act(lineId, "ignora"),
};

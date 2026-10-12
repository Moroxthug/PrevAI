// Le chiamate al server della schermata Ore e costo del lavoro (routes/pay.ts); il fetch dell'app aggiunge il token.
import { api } from "./api";
import type { PayReport, PaySettingsPayload, RawSettings } from "./pay";

const id = encodeURIComponent;

export const payApi = {
  settings: () => api<PaySettingsPayload>("/api/pay/settings"),
  saveSettings: (body: RawSettings) => api<PaySettingsPayload>("/api/pay/settings", { method: "PUT", body }),
  period: (date?: string) => api<PayReport>(`/api/pay/period${date ? `?date=${id(date)}` : ""}`),
  exportPath: (date: string) => `/api/pay/export.csv?date=${id(date)}`,
};

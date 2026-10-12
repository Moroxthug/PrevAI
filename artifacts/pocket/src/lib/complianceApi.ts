// Le chiamate al server della schermata Scadenze (routes/fiscale.ts); il fetch dell'app aggiunge il token e l'impresa attiva.
import { api } from "./api";
import type { ComplianceOverview, ReminderDto, ReminderKind, Recurrence } from "./compliance";

const id = encodeURIComponent;

export const complianceApi = {
  overview: () => api<ComplianceOverview>("/api/fiscale/calendario"),
  /** Registra ciò che l'impresa dichiara di aver versato (PrevAI non versa niente). */
  markPaid: (anno: number, chiave: string, day: string) => api<unknown>(`/api/fiscale/scadenzario/${id(chiave)}/versata`, { method: "POST", body: { anno, data: day } }),
  undoPaid: (anno: number, chiave: string) => api<unknown>(`/api/fiscale/scadenzario/${id(chiave)}/riapri?anno=${anno}`, { method: "POST", body: {} }),
  reminderDone: (reminderId: string) => api<{ reminder: ReminderDto | null }>(`/api/fiscale/calendario/promemoria/${id(reminderId)}/fatto`, { method: "POST", body: {} }),
  addReminder: (body: { kind: ReminderKind; preset?: string | null; title: string; authority?: string; dueDate: string; recurrence: Recurrence }) => api<{ reminder: ReminderDto }>("/api/fiscale/calendario/promemoria", { method: "POST", body }),
};

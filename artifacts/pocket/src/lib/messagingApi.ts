// The messaging server calls (routes/whatsapp.ts). PrevAI has no texts (SMS), so there is nothing to ask about them.
import { api } from "./api";

export type WaStatus = { connected: boolean; available: boolean; phoneNumber: string | null; isEnabled: boolean | null; businessNumber: string | null };
/** Quotes made from WhatsApp this month, and the plan's allowance (Pro has one, Elite none). */
export type WaUsage = { used: number; limit: number | null; plan: string | null };

export const messagingApi = {
  wa: () => api<WaStatus>("/api/whatsapp/status"),
  waUsage: () => api<WaUsage>("/api/whatsapp/usage"),
  waConnect: (phoneNumber: string) => api<{ sent: boolean; phoneNumber: string }>("/api/whatsapp/connect", { method: "POST", body: { phoneNumber } }),
  waVerify: (phoneNumber: string, otp: string) => api<{ success: boolean }>("/api/whatsapp/verify", { method: "POST", body: { phoneNumber, otp } }),
  waDisconnect: () => api<unknown>("/api/whatsapp/disconnect", { method: "DELETE" }),
};

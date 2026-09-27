import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import type { PaymentSchedule } from "@/lib/payment-schedule";

export type AutomationSettings = {
  notifyOnQuoteAccepted: boolean;
  autoDraftContract?: boolean;
  autoSendInvoices: boolean;
  invoiceAutoSendAfterHours: number;
  invoiceReminders: boolean;
};

/** GET /api/business-profile con i campi che il client generato non tipizza. */
export type BusinessProfile = {
  companyName: string;
  vatNumber: string | null;
  address: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  apiKey?: string | null;
  province: string | null;
  codiceFiscale: string | null;
  codiceSdi: string | null;
  reaNumber: string | null;
  iban: string | null;
  googleReviewUrl: string | null;
  secondaryReviewUrl: string | null;
  sendReviewRequests: boolean;
  defaultPaymentSchedule: PaymentSchedule | null;
  automationSettings: AutomationSettings;
  features?: Record<string, boolean> | null;
  plan?: string | null;
};

export function useBusinessProfile() {
  const q = useGetBusinessProfile();
  return { ...q, data: q.data as unknown as BusinessProfile | undefined };
}

/**
 * PUT /api/business-profile con i soli campi che la sezione ha cambiato
 * (l'endpoint accetta corpi parziali e unisce automationSettings). Avvisa in
 * entrambi i casi; se fallisce rilancia, così la barra tiene le modifiche.
 */
export function useSaveBusinessProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/business-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: "Salvataggio non riuscito", description: err.error, variant: "destructive" });
      throw new Error(err.error || "Salvataggio non riuscito");
    }
    await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
    toast({ title: "Modifiche salvate" });
  }, [queryClient, toast]);
}

/** Le chiavi di `draft` il cui valore è diverso da `saved`. */
export function changed<T extends Record<string, unknown>>(draft: T, saved: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(draft) as Array<keyof T>) {
    if (JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) out[k] = draft[k];
  }
  return out;
}

/** "" → null, per i campi di testo annullabili dell'endpoint. */
export const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

import { CalendarDays, Code2, CreditCard, FileCheck2, Globe, Mail, Megaphone, MessageCircle, type LucideIcon } from "lucide-react";
import { PLAN_FEATURES, PLAN_IDS, type PlanId, type ProductFeature } from "@/lib/plans";

// ── APP-1b (come QuoteAI Phase 103): il catalogo delle app ───────────────────
// Ogni integrazione che PrevAI ha, in un solo elenco: in che gruppo sta, il
// logo (public/brands/, vedi BRANDS.md lì), la funzione del piano che la
// sblocca e — per le tre che hanno già una sezione propria — dove porta il
// riquadro invece di un pannello. I testi sono qui (PrevAI è solo in italiano).

export type AppId =
  | "google_calendar" | "outlook_calendar" | "ics_calendar"
  | "gmail"
  | "whatsapp"
  | "stripe"
  | "sdi"
  | "meta_leads"
  | "widget" | "api";

export type AppGroup = "calendar" | "email" | "messaging" | "payments" | "fisco" | "leads" | "developers";

export type AppDef = {
  id: AppId;
  group: AppGroup;
  name: string;
  /** Cosa fa, in una riga (sotto il nome nel riquadro). */
  tagline: string;
  /** Cosa fa, per esteso (in cima al pannello). */
  about: string;
  /** Quali dati passano e verso chi. */
  shared: string;
  /**
   * File in public/brands/ — il marchio dell'azienda stessa (BRANDS.md: da dove
   * viene ciascuno, e perché Outlook, WhatsApp e Meta non ne hanno: i titolari
   * concedono il logo solo con permesso scritto o dietro l'accettazione di termini).
   */
  logo?: string;
  /** Un logotipo invece di un simbolo quadrato: ha un riquadro più largo. */
  wide?: boolean;
  /** I nostri strumenti, i marchi senza logo concesso e il ripiego se il file manca. */
  icon: LucideIcon;
  /** La funzione del piano che la sblocca (lib/plans.ts, copia di quella del server). */
  feature?: ProductFeature;
  /** Per WhatsApp, legato a un'allowance mensile e non a una funzione. */
  minPlan?: PlanId;
  /** Sbloccata da un modulo aggiuntivo, non da un piano. */
  addon?: "PrevAI Fisco";
  /** Apre questa sezione delle Impostazioni invece di un pannello. */
  section?: "whatsapp" | "widget" | "sdi";
  /** Per la riga sui marchi in fondo alla pagina. */
  owner?: string;
};

export const APPS: AppDef[] = [
  {
    id: "google_calendar", group: "calendar", name: "Google Calendar", logo: "google-calendar.svg", icon: CalendarDays, feature: "calendar_sync", owner: "Google LLC",
    tagline: "Fasi e turni nel tuo calendario, i tuoi impegni in PrevAI",
    about: "Ogni fase di cantiere con una data e ogni turno dell'agenda compaiono nel tuo Google Calendar e si aggiornano quando li sposti in PrevAI. Nell'altro senso PrevAI legge i tuoi appuntamenti dei prossimi tre mesi solo per mostrarli nel calendario della dashboard: non li modifica mai.",
    shared: "Fasi e turni (titolo, cantiere, operaio, orari) vanno a Google; da Google arrivano titolo, luogo e orari dei tuoi appuntamenti, tenuti in una copia che si rifà a ogni lettura.",
  },
  {
    id: "outlook_calendar", group: "calendar", name: "Outlook", icon: CalendarDays, feature: "calendar_sync", owner: "Microsoft Corporation",
    tagline: "Fasi e turni nel calendario Outlook",
    about: "Ogni fase di cantiere con una data e ogni turno dell'agenda compaiono nel tuo calendario Outlook (Microsoft 365) e si aggiornano quando li sposti in PrevAI. PrevAI legge i tuoi appuntamenti dei prossimi tre mesi solo per mostrarli nel calendario della dashboard, senza modificarli.",
    shared: "Fasi e turni (titolo, cantiere, operaio, orari) vanno a Microsoft; da Microsoft arrivano titolo, luogo e orari dei tuoi appuntamenti.",
  },
  {
    id: "ics_calendar", group: "calendar", name: "Calendari .ics", icon: CalendarDays, feature: "calendar_sync",
    tagline: "Calendly, Apple e ogni calendario con un link",
    about: "Abbonati a qualsiasi calendario che pubblica un link .ics (Calendly, Calendario di Apple, un Google Calendar condiviso): i suoi eventi compaiono nel calendario della dashboard, in sola lettura. E pubblica la tua agenda con un link privato da aggiungere a qualsiasi app di calendario.",
    shared: "PrevAI scarica i link .ics che indichi. Chi ha il link pubblicato vede turni e fasi dei cantieri (non fatture né preventivi).",
  },
  {
    id: "gmail", group: "email", name: "Gmail", logo: "gmail.svg", icon: Mail, feature: "gmail_send", owner: "Google LLC",
    tagline: "Preventivi e fatture dalla tua casella",
    about: "Preventivi, contratti e fatture partono dal tuo indirizzo Gmail invece che da no-reply@prevai.it, e le risposte dei clienti arrivano a te. PrevAI può solo inviare: non legge la tua posta.",
    shared: "Le email che mandi da PrevAI passano da Google con il tuo account.",
  },
  {
    id: "whatsapp", group: "messaging", name: "WhatsApp", icon: MessageCircle, minPlan: "monthly_pro", section: "whatsapp", owner: "WhatsApp LLC",
    tagline: "Preventivi da testo, vocali e foto",
    about: "Scrivi, manda un vocale o una foto al bot di PrevAI su WhatsApp e ricevi il preventivo pronto.",
    shared: "I messaggi che mandi al bot passano da WhatsApp (Meta).",
  },
  {
    id: "stripe", group: "payments", name: "Stripe", logo: "stripe.svg", wide: true, icon: CreditCard, feature: "invoice_card_payments", owner: "Stripe, Inc.",
    tagline: "Incassa le fatture con carta",
    about: "I clienti pagano acconti e fatture con carta dal link che ricevono, e i soldi arrivano sul tuo conto Stripe. PrevAI non tocca mai i soldi.",
    shared: "Importo, numero del documento ed email del cliente vanno a Stripe al momento del pagamento.",
  },
  {
    id: "sdi", group: "fisco", name: "Fatture elettroniche (SdI)", icon: FileCheck2, feature: "sdi_invoicing", addon: "PrevAI Fisco", section: "sdi",
    tagline: "Invio al Sistema di Interscambio",
    about: "Le fatture partono verso il Sistema di Interscambio tramite l'intermediario, con ricevute e conservazione a norma.",
    shared: "Le fatture elettroniche passano dall'intermediario accreditato che scegli.",
  },
  {
    id: "meta_leads", group: "leads", name: "Lead Ads di Facebook e Instagram", icon: Megaphone, feature: "meta_lead_ads", owner: "Meta Platforms, Inc.",
    tagline: "Nuovi contatti dalle campagne",
    about: "Ogni modulo Lead Ads compilato sulla tua pagina Facebook o Instagram entra da solo tra i tuoi Lead, con nome, telefono e richiesta.",
    shared: "PrevAI legge da Meta i moduli compilati della pagina che colleghi.",
  },
  {
    id: "widget", group: "developers", name: "Widget per il sito", icon: Globe, section: "widget",
    tagline: "Stima del prezzo sul tuo sito",
    about: "Un riquadro sul tuo sito che dà al visitatore una stima del prezzo e ti manda il contatto come lead.",
    shared: "Le richieste dei visitatori arrivano a PrevAI.",
  },
  {
    id: "api", group: "developers", name: "API e webhook", icon: Code2, feature: "public_api",
    tagline: "Zapier, Make e i tuoi strumenti",
    about: "Leggi e crea preventivi, clienti, cantieri e fatture dai tuoi strumenti, e ricevi un webhook quando succede qualcosa (preventivo accettato, fattura pagata…).",
    shared: "Solo quello che le chiavi e i webhook che crei chiedono, verso gli indirizzi che indichi.",
  },
];

export const APP_GROUPS: Array<{ id: AppGroup; label: string }> = [
  { id: "calendar", label: "Calendario" },
  { id: "email", label: "Email" },
  { id: "messaging", label: "Messaggi" },
  { id: "payments", label: "Pagamenti" },
  { id: "fisco", label: "Fisco" },
  { id: "leads", label: "Contatti" },
  { id: "developers", label: "Sito e sviluppatori" },
];

export const appById = (id: string | null | undefined): AppDef | undefined => APPS.find((a) => a.id === id);

/** Il piano più economico che include l'app; null quando ogni piano ce l'ha (o quando serve un modulo). */
export function requiredPlanFor(app: AppDef): PlanId | null {
  if (app.addon) return null;
  if (app.minPlan) return app.minPlan;
  if (!app.feature) return null;
  for (const plan of PLAN_IDS) if (PLAN_FEATURES[plan].has(app.feature)) return plan;
  return "monthly_elite";
}

/**
 * I callback OAuth rimandano il browser a /dashboard/settings/apps con uno di
 * questi parametri (…?cal=connected). Quale app era, così si apre il suo pannello.
 */
export const RETURN_PARAMS: Array<{ param: string; app: (q: URLSearchParams) => AppId }> = [
  { param: "cal", app: (q) => (q.get("provider") === "outlook" ? "outlook_calendar" : "google_calendar") },
  { param: "email", app: () => "gmail" },
  { param: "stripeConnect", app: () => "stripe" },
  { param: "metaLeadAds", app: () => "meta_leads" },
];

export const APPS_HREF = "/dashboard/settings/apps";
export const appHref = (id: AppId) => `${APPS_HREF}?app=${id}`;

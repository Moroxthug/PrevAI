import { MARKET } from "@workspace/config";
import { logger } from "./logger.js";
import { FROM, escapeHtml, resendOrThrow, shell, type EmailLang } from "./emailContracts.js";

/** Magic link per la pagina di timbratura ore dell'operaio (/t/:token). */
export async function sendWorkerInviteEmail(params: { toEmail: string; workerName: string; companyName: string; url: string; language?: EmailLang }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const worker = escapeHtml(params.workerName);
  const t = {
    title: "Il tuo link per registrare le ore",
    sub: `${params.companyName} ti ha aggiunto alla squadra`,
    body: `Ciao ${worker},<br/><br/><strong>${company}</strong> usa ${MARKET.brand} per registrare le ore in cantiere. Apri il link qui sotto dal telefono per segnare le tue ore ogni giorno: niente account né password. Aggiungi la pagina alla schermata Home per ritrovarla subito.`,
    btn: "Registra le mie ore",
    hint: "Questo link è personale: non condividerlo. Se lo perdi, chiedine uno nuovo al tuo datore di lavoro.",
    footer: `Inviato tramite ${MARKET.brand} per conto di ${company}.`,
    subject: `${params.companyName} — il tuo link per le ore`,
  };
  const html = shell({
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.url}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Worker invite email sent");
}

/** Phase 7: invito per una persona ad avere il proprio accesso all'account aziendale. */
export async function sendTeamMemberInviteEmail(params: { toEmail: string; companyName: string; inviterName: string; role: string; url: string; language?: EmailLang }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const inviter = escapeHtml(params.inviterName);
  const t = {
    title: "Sei stato invitato in un team",
    sub: `${params.companyName} su ${MARKET.brand}`,
    body: `Ciao,<br/><br/><strong>${inviter}</strong> ti invita a entrare nell'account ${MARKET.brand} di <strong>${company}</strong> con il ruolo «${escapeHtml(params.role)}». Crea il tuo accesso cliccando qui sotto.`,
    btn: "Entra nel team",
    hint: "Questo link è personale e scade tra 7 giorni.",
    footer: `Inviato tramite ${MARKET.brand} per conto di ${company}.`,
    subject: `${params.companyName} ti invita su ${MARKET.brand}`,
  };
  const html = shell({
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.url}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Team member invite email sent");
}

// EMAIL-2: who a campaign goes to.
//
// Every audience starts from the same base, which is also the legal filter:
//  • verified email, not a placeholder (.invalid),
//  • not unsubscribed from PrevAI news (marketing_preferences),
//  • no account deletion pending,
//  • never bounced or marked as spam (email_events from the Resend webhook).
// Then each audience adds one condition.

import { db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";

export type AudienceId = "tutti" | "senza_preventivi" | "senza_abbonamento" | "abbonati" | "nuovi_30";

export const AUDIENCES: ReadonlyArray<{ id: AudienceId; label: string; description: string }> = [
  { id: "tutti", label: "Tutti gli utenti", description: "Ogni account con email verificata che non si è disiscritto." },
  { id: "senza_preventivi", label: "Registrati senza preventivi", description: "Titolari d'impresa che non hanno ancora creato un preventivo." },
  { id: "senza_abbonamento", label: "Senza abbonamento", description: "Titolari d'impresa in prova o senza piano attivo." },
  { id: "abbonati", label: "Abbonati", description: "Titolari d'impresa con un piano attivo." },
  { id: "nuovi_30", label: "Iscritti negli ultimi 30 giorni", description: "Account creati negli ultimi 30 giorni." },
];

export function isAudienceId(v: unknown): v is AudienceId {
  return typeof v === "string" && AUDIENCES.some((a) => a.id === v);
}

function condition(id: AudienceId): SQL {
  switch (id) {
    case "tutti":
      return sql`true`;
    case "senza_preventivi":
      return sql`bp.user_id is not null and not exists (select 1 from quotes q where q.user_id = u.id)`;
    case "senza_abbonamento":
      return sql`bp.user_id is not null and coalesce(bp.subscription_status, '') <> 'active'`;
    case "abbonati":
      return sql`bp.subscription_status = 'active'`;
    case "nuovi_30":
      return sql`u.created_at > now() - interval '30 days'`;
  }
}

function query(id: AudienceId, select: SQL): SQL {
  return sql`
    select ${select}
    from auth_user u
    left join business_profiles bp on bp.user_id = u.id
    left join marketing_preferences mp on mp.user_id = u.id
    where u.email_verified = true
      and u.email not like '%.invalid'
      and mp.unsubscribed_at is null
      and not exists (select 1 from account_deletions d where d.subject_user_id = u.id and d.stato = 'in_attesa')
      and not exists (
        select 1 from email_events e
        where e.type in ('email.bounced', 'email.complained')
          and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(e."to") = 'array' then e."to" else '[]'::jsonb end) t(addr) where lower(t.addr) = lower(u.email))
      )
      and (${condition(id)})`;
}

export type AudienceMember = { userId: string; email: string; name: string };

export async function audienceMembers(id: AudienceId): Promise<AudienceMember[]> {
  const res = await db.execute(query(id, sql`u.id as "userId", lower(u.email) as email, u.name as name`));
  return (res.rows as AudienceMember[]).map((r) => ({ userId: String(r.userId), email: String(r.email), name: String(r.name ?? "") }));
}

export async function audienceCount(id: AudienceId): Promise<number> {
  const res = await db.execute(query(id, sql`count(*)::int as n`));
  return Number((res.rows[0] as { n: number } | undefined)?.n ?? 0);
}

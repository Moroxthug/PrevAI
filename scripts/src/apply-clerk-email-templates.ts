/**
 * apply-clerk-email-templates.ts
 *
 * Applies Prevai branding to all Clerk system email templates via the Clerk Backend API.
 * Must be run separately for the development instance (sk_test_*) and the
 * production instance (sk_live_*).
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_test_... pnpm --filter @workspace/scripts run apply-clerk-email-templates
 *   CLERK_SECRET_KEY=sk_live_... pnpm --filter @workspace/scripts run apply-clerk-email-templates
 */

const CLERK_API_BASE = "https://api.clerk.com/v1/templates/email";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error("Error: CLERK_SECRET_KEY environment variable is required.");
  process.exit(1);
}

type TemplateUpdate = {
  slug: string;
  subject: string;
  fromEmailName: string;
};

const TEMPLATE_UPDATES: TemplateUpdate[] = [
  {
    slug: "verification_code",
    subject: "{{otp_code}} è il tuo codice di verifica – Prevai",
    fromEmailName: "Prevai",
  },
  {
    slug: "reset_password_code",
    subject: "{{otp_code}} è il tuo codice per reimpostare la password – Prevai",
    fromEmailName: "Prevai",
  },
  {
    slug: "magic_link_sign_in",
    subject: "Il tuo link per accedere a Prevai",
    fromEmailName: "Prevai",
  },
  {
    slug: "magic_link_sign_up",
    subject: "Il tuo link per registrarti su Prevai",
    fromEmailName: "Prevai",
  },
  {
    slug: "magic_link_user_profile",
    subject: "Verifica il tuo indirizzo email – Prevai",
    fromEmailName: "Prevai",
  },
  {
    slug: "password_changed",
    subject: "La tua password Prevai è stata modificata",
    fromEmailName: "Prevai",
  },
  {
    slug: "new_device_sign_in",
    subject: "Nuovo accesso al tuo account Prevai",
    fromEmailName: "Prevai",
  },
  {
    slug: "invitation",
    subject: "Sei stato invitato su Prevai",
    fromEmailName: "Prevai",
  },
];

async function clerkGet(slug: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${CLERK_API_BASE}/${slug}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function clerkPut(slug: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${CLERK_API_BASE}/${slug}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function applyTemplate(update: TemplateUpdate): Promise<void> {
  const current = await clerkGet(update.slug);

  if (!current["name"]) {
    console.log(`  SKIP  ${update.slug} — template not found in this instance`);
    return;
  }

  const payload: Record<string, unknown> = {
    name: current["name"],
    body: current["body"] ?? "",
    subject: update.subject,
    from_email_name: update.fromEmailName,
  };
  if (current["markup"]) {
    payload["markup"] = current["markup"];
  }

  const result = await clerkPut(update.slug, payload);

  if (result["slug"]) {
    console.log(`  OK    ${update.slug}`);
    console.log(`        subject:  ${result["subject"]}`);
    console.log(`        from:     ${result["from_email_name"]}`);
    console.log(`        custom:   ${result["is_custom"]}`);
  } else {
    const errors = result["errors"] ?? result;
    console.error(`  ERR   ${update.slug}: ${JSON.stringify(errors)}`);
  }
}

async function main(): Promise<void> {
  const keyPrefix = CLERK_SECRET_KEY!.slice(0, 10);
  const env = CLERK_SECRET_KEY!.startsWith("sk_live_") ? "PRODUCTION" : "development";
  console.log(`\nApplying Prevai email branding to Clerk ${env} instance (key: ${keyPrefix}...)\n`);

  for (const update of TEMPLATE_UPDATES) {
    await applyTemplate(update);
    console.log();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

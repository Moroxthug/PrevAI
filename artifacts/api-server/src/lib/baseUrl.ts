/**
 * Returns the public base URL for this app.
 *
 * Priority:
 *  1. PREVAI_BASE_URL env var (explicit production override, e.g. https://www.prevai.it)
 *  2. First non-replit domain in REPLIT_DOMAINS (custom domain like prevai.it)
 *  3. First domain in REPLIT_DOMAINS (replit.app / replit.dev fallback)
 *  4. http://localhost:80 (local dev without Replit env)
 */
export function getBaseUrl(): string {
  if (process.env.PREVAI_BASE_URL) return process.env.PREVAI_BASE_URL;

  const domains = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  const customDomain = domains.find((d) => !d.includes("replit"));
  const domain = customDomain ?? domains[0];
  return domain ? `https://${domain}` : "http://localhost:80";
}

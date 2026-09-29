import { useLocation } from "wouter";
import type { PageContextDto } from "@/lib/assistant-api";

/**
 * APP-8a — the screen a question is asked from, so "questo cantiere" or
 * "questa fattura" need no explaining. Only ids from the address go to the
 * server, which checks each one belongs to the company.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RULES: [RegExp, keyof Omit<PageContextDto, "path">][] = [
  [new RegExp(`^/dashboard/jobs/(${UUID})`, "i"), "projectId"],
  [new RegExp(`^/dashboard/quotes/(${UUID})`, "i"), "quoteId"],
  [new RegExp(`^/dashboard/invoices/(${UUID})`, "i"), "invoiceId"],
];

function pageContextFor(path: string): PageContextDto {
  const clean = path.split(/[?#]/)[0]!.replace(/[^\w\-/]/g, "").slice(0, 200) || "/dashboard";
  const ctx: PageContextDto = { path: clean.startsWith("/") ? clean : `/${clean}` };
  for (const [re, key] of RULES) {
    const m = re.exec(clean);
    if (m) ctx[key] = m[1]!.toLowerCase();
  }
  return ctx;
}

export function useAssistantPageContext(): PageContextDto {
  const [location] = useLocation();
  return pageContextFor(location);
}

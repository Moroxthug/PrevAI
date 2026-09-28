// SEC-3: `logoUrl` is only ever the path the logo upload wrote
// (routes/business-profile.ts → logos/<tenant>/logo.<ext>). Anything else is
// refused on write and ignored on read, so a crafted value can neither inject
// HTML into an email sent from no-reply@ nor pull another company's file into
// a PDF.

import { getBaseUrl } from "./baseUrl";

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PREFIX = "/api/storage/public-objects/";
const LOGO_PATH = /^\/api\/storage\/public-objects\/logos\/([A-Za-z0-9_-]+)\/logo\.(?:svg|png|jpe?g)$/;

/** The path the upload route writes for this tenant's logo, or null when `url` is anything else. */
export function ownLogoPath(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const m = LOGO_PATH.exec(url);
  return m && m[1] === userId ? url : null;
}

/** Any tenant's logo path (reads where the owner is not at hand); null for anything else. */
export function logoPath(url: string | null | undefined): string | null {
  return url && LOGO_PATH.test(url) ? url : null;
}

/** Object-storage sub-path of a valid logo path (for the PDF, which embeds the bytes). */
export function logoSubPath(url: string): string {
  return url.slice(PREFIX.length);
}

/**
 * Absolute, HTML-escaped URL for an `<img src>` in an email — mail clients
 * cannot resolve the relative path the profile stores — or null.
 */
export function emailLogoSrc(url: string | null | undefined): string | null {
  const path = logoPath(url);
  return path ? escapeAttr(`${getBaseUrl()}${path}`) : null;
}

// Copia gli articoli del centro assistenza del sito nell'app (src/content/helpArticles.ts), così il telefono li legge anche offline.
// L'app è fuori dal workspace pnpm: l'import di `Lang` da @workspace/config diventa il tipo locale (solo italiano).
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../../preventivo-ai/src/data/help-articles.ts", import.meta.url), "utf8")
  .replace(/^import type \{ Lang \} from "@workspace\/config";\nexport type HelpLang = Lang;$/m, "export type HelpLang = \"it\";");
if (src.includes("@workspace/")) throw new Error("help-articles.ts imports from the workspace: update scripts/sync-help.mjs");
const head = "// UNA COPIA di artifacts/preventivo-ai/src/data/help-articles.ts (il centro assistenza del sito), per leggerla offline sul telefono.\n// Non modificarla qui: cambia il file del sito e lancia `npm run sync-help`.\n";
writeFileSync(new URL("../src/content/helpArticles.ts", import.meta.url), head + src);
console.log("Articoli dell'assistenza copiati.");

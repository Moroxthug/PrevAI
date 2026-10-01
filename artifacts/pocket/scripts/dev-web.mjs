// Expo web in sviluppo (`node scripts/dev-web.mjs [porta]`, default 8092).
// Metro si blocca all'avvio se il percorso contiene parentesi, e questa copia sta in
// "C:\Users\Admin\Downloads\PrevAI (2)\...". Su Windows si mappa la cartella su un'unità
// (subst P:) e si avvia da lì: stessi file, percorso senza parentesi.
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const port = process.argv[2] ?? "8092";
let cwd = app;
if (process.platform === "win32" && /[()]/.test(app)) {
  // La cartella fino al primo pezzo con le parentesi compreso: "C:\...\PrevAI (2)".
  const parts = app.split(/[\\/]/);
  const parent = parts.slice(0, parts.findIndex((p) => /[()]/.test(p)) + 1).join("\\");
  const drive = process.env.POCKET_DRIVE ?? "P:";
  if (!existsSync(`${drive}\\`)) execFileSync("subst", [drive, parent]);
  cwd = join(`${drive}\\`, relative(parent, app));
}
const child = spawn(process.execPath, [join(cwd, "node_modules", "expo", "bin", "cli"), "start", "--web", "--port", port], { cwd, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));

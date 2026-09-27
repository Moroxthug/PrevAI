#!/usr/bin/env bash
# Preflight del cutover v1 → v2 (docs/CUTOVER-29-09.md, RUNBOOKS §5).
#
# SOLA LETTURA: non scrive sul database, non fa push, non promuove, non
# decifra variabili Vercel e non stampa segreti. Si lancia da Git Bash nella
# radice del repo, lunedì 28/9 (prova) e martedì 29/9 alle 06:40 (T-20):
#
#   bash scripts/cutover-preflight.sh                       # senza DB
#   CUTOVER_DB_URL="$URL" bash scripts/cutover-preflight.sh # anche il DB
#
# $URL è quello di RUNBOOKS §5.3 (session pooler 5432 + sslmode=verify-full
# e sslrootcert). Esce con 1 se almeno un controllo è KO: con un KO non si
# parte (criteri go/no-go in docs/CUTOVER-29-09.md §3).

set -u
cd "$(dirname "$0")/.."

PG=/c/Users/Admin/pg17/pgsql/bin
CA=/c/Users/Admin/PrevAI-backups/supabase-ca.crt
ORIGINE_ESTERNA="https://www.rba-edilizia.it"
KO=0; AVVISI=0

ok()     { printf '  OK     %s\n' "$1"; }
ko()     { printf '  KO     %s\n' "$1"; KO=$((KO+1)); }
avviso() { printf '  AVVISO %s\n' "$1"; AVVISI=$((AVVISI+1)); }
titolo() { printf '\n== %s\n' "$1"; }
http()   { curl -s --ssl-no-revoke -o /dev/null -w '%{http_code}' "$@"; }

titolo "1. Strumenti"
for b in psql pg_dump pg_restore; do
  [ -x "$PG/$b.exe" ] && ok "$b ($("$PG/$b.exe" --version | awk '{print $3}'))" || ko "$b mancante in $PG"
done
for c in vercel pnpm node git curl; do
  command -v "$c" >/dev/null && ok "$c" || ko "$c non nel PATH"
done
[ -s "$CA" ] && ok "CA Supabase in $CA" || ko "CA Supabase assente: scaricarla (RUNBOOKS §5.3, TLS)"

titolo "2. Repo"
ramo=$(git rev-parse --abbrev-ref HEAD)
[ "$ramo" = "v2" ] && ok "ramo v2" || ko "ramo corrente $ramo, serve v2"
[ -z "$(git status --porcelain --untracked-files=no)" ] && ok "nessuna modifica non committata" || ko "modifiche non committate"
git fetch -q origin v2 main 2>/dev/null
locale=$(git rev-parse HEAD); remoto=$(git rev-parse origin/v2)
[ "$locale" = "$remoto" ] && ok "v2 pushato (${locale:0:9})" \
  || ko "origin/v2 = ${remoto:0:9}, locale = ${locale:0:9}: la preview non contiene gli ultimi commit (push di v2, §2 del kit)"
if grep -q 'www\.prevai\.it' artifacts/preventivo-ai/public/widget.js; then
  ko "widget.js nel repo chiama ancora www.prevai.it"
else
  ok "widget.js nel repo sull'apex"
fi

titolo "3. Migrazioni (hash = quelle provate su staging)"
while read -r atteso file; do
  if [ ! -f "$file" ]; then ko "$file mancante"; continue; fi
  reale=$(sha256sum "$file" | awk '{print $1}')
  [ "$reale" = "$atteso" ] && ok "$file" || ko "$file cambiato dopo la prova generale (hash diverso)"
done <<'ELENCO'
7c32f9f7c7595562883a08aa54e10338824013b1e93310902cda35fce3a1d922 migrations/v2/0001_v1_to_v2_additive.sql
fc3661fe7d46a45832033049c62f1f4747959877d04a5b0dc01c4115bcf02e60 migrations/v2/0002_a0_compliance.sql
17efb65efa949af998c938f9011eb7c25e47e1edbacfbd33eb9a5259303988e0 migrations/v2/0003_a1_sdi.sql
4df97339bff1ab44e41f8970b4c0145bc784edff7dcafab048be5d18040cf11d migrations/v2/0004_a2_fiscale.sql
321490a2e30b131539b956ef21882b893d1f8674f7b2e293af56c19f0a6b1829 migrations/v2/0005_a3_scadenzario.sql
9c8211b43332e9a95871c6180282b165a8d79bd0b33be299b47777a311376320 migrations/v2/0006_a4_prima_nota.sql
4b83a7a69821f42bfdd6f15b33855107219acad24bd337316591260b9a2b7503 migrations/v2/0007_a5_addon.sql
85ea673ae89c2144dfc9fb95189d4949057c6315ce082c2f874ce5618d7a7e06 migrations/v2/0008_a6_commercialista.sql
c321f07a13592abfc30f97e9aa54a94f7388bc1d3fb69eecfc464e1cf6a274ff docs/sql/reconcile.sql
ELENCO

titolo "4. Variabili Vercel (solo nomi, Production)"
envs=$(vercel env ls production 2>&1 | awk '{print $1}')
for v in DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL TRUSTED_ORIGINS CRON_SECRET TOKEN_ENCRYPTION_KEY \
         STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY RESEND_WEBHOOK_SECRET GROQ_API_KEY \
         SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY ADMIN_EMAIL; do
  printf '%s\n' "$envs" | grep -qx "$v" && ok "$v" || ko "$v assente su Production"
done
printf '%s\n' "$envs" | grep -qx STRIPE_CONNECT_WEBHOOK_SECRET && ok "STRIPE_CONNECT_WEBHOOK_SECRET" \
  || avviso "STRIPE_CONNECT_WEBHOOK_SECRET assente: RUNBOOKS §5.1 chiede comunque un valore (senza, il webhook Connect logga un errore a ogni chiamata)"
printf '%s\n' "$envs" | grep -qx OPS_ALERT_EMAIL && ok "OPS_ALERT_EMAIL" \
  || avviso "OPS_ALERT_EMAIL assente: gli alert vanno ad ADMIN_EMAIL"
printf '%s\n' "$envs" | grep -qx PREVAI_BASE_URL \
  && avviso "PREVAI_BASE_URL presente (di luglio): il valore va controllato a mano, deve essere https://prevai.it"

titolo "5. Produzione (v1) vista da fuori"
[ "$(http https://prevai.it/api/healthz)" = 200 ] && ok "/api/healthz 200" || ko "/api/healthz non risponde 200"
[ "$(http https://prevai.it/api/healthz/db)" = 200 ] && ok "/api/healthz/db 200" || ko "/api/healthz/db non risponde 200"
[ "$(http https://www.prevai.it/)" = 308 ] && ok "www → apex (308)" || avviso "www non risponde 308: il verso del redirect è cambiato?"
acao=$(curl -s --ssl-no-revoke -o /dev/null -D - -X OPTIONS https://prevai.it/api/public/quotes \
  -H "Origin: $ORIGINE_ESTERNA" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-api-key" | tr -d '\r' | grep -i '^access-control-allow-origin:')
[ -n "$acao" ] && ok "preflight CORS da $ORIGINE_ESTERNA consentito" || ko "preflight CORS da $ORIGINE_ESTERNA senza Access-Control-Allow-Origin"
if curl -s --ssl-no-revoke https://prevai.it/widget.js | grep -q 'www\.prevai\.it'; then
  ko "widget.js in produzione chiama www.prevai.it"
else
  ok "widget.js in produzione sull'apex"
fi

titolo "6. Preview v2 da promuovere"
PREVIEW=${PREVIEW_URL:-$(vercel ls prevai 2>&1 | grep -m1 ' Preview ' | grep -o 'https://[^ ]*vercel\.app')}
if [ -z "$PREVIEW" ]; then
  ko "nessuna preview trovata"
else
  printf '  preview: %s\n' "$PREVIEW"
  vc() { MSYS_NO_PATHCONV=1 vercel curl "$1" --deployment "$PREVIEW" -- --ssl-no-revoke -s 2>/dev/null; }
  vc /api/healthz | grep -q '"ok"' && ok "/api/healthz ok" || ko "/api/healthz della preview non ok"
  w=$(vc /widget.js)
  if [ -z "$w" ]; then ko "widget.js della preview non letto"
  elif printf '%s' "$w" | grep -q 'www\.prevai\.it'; then
    ko "widget.js della preview chiama www.prevai.it: preview vecchia, NON promuovere (push di v2 e nuova preview)"
  else ok "widget.js della preview sull'apex"; fi
fi

titolo "7. Database di produzione (sola lettura)"
if [ -z "${CUTOVER_DB_URL:-}" ]; then
  avviso "CUTOVER_DB_URL non impostata: controllo del DB saltato"
else
  q() { "$PG/psql.exe" "$CUTOVER_DB_URL" -At -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
  r=$(q "select 1")
  if [ "$r" = 1 ]; then ok "connessione TLS con la CA (select 1)"; else
    ko "connessione fallita: $(printf '%s' "$r" | head -1) (piano B TLS in RUNBOOKS §5.3)"
  fi
  if [ "$r" = 1 ]; then
    n=$(q "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
    v2=$(q "select count(*) from (values ('quote_variants'),('professionisti')) t(n) where to_regclass('public.'||n) is not null")
    case "$v2" in
      0) ok "schema v1 non ancora migrato ($n tabelle; atteso 24)";;
      2) avviso "tabelle v2 già presenti ($n tabelle): migrazione già eseguita? Le 0001–0008 sono idempotenti, ma annotarlo";;
      *) ko "schema a metà ($n tabelle, $v2/2 tabelle v2 sentinella): fermarsi e capire";;
    esac
    [ "$n" = 24 ] || [ "$v2" != 0 ] || avviso "tabelle pubbliche = $n, il baseline ne aveva 24"
  fi
fi

printf '\n== Esito: %d KO, %d avvisi\n' "$KO" "$AVVISI"
[ "$KO" -eq 0 ] && echo "   GO dal preflight (gli avvisi vanno letti uno per uno)" || echo "   NO-GO: risolvere i KO prima di partire"
exit $((KO > 0))

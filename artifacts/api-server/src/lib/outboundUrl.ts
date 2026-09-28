// SEC-3: the server only calls URLs a customer typed (webhooks) or a browser
// handed over (push endpoints) when they point at the public internet.
// Without this, a webhook to http://169.254.169.254/… or http://10.0.0.5/
// would let a tenant make the API knock on internal addresses (blind SSRF).
//
// Webhooks: the address is checked when the socket connects (custom
// `lookup`), so a hostname that resolves to a public IP at save time and a
// private one at send time (DNS rebinding) is still refused; redirects are
// not followed.
// Push: only the browser vendors' push services are accepted — every real
// subscription endpoint is on one of them.

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const isProduction = () => process.env.NODE_ENV === "production";

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number, number, number];
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 || // this-net, private, loopback, multicast/reserved
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // 192.0.0.0/24 IETF, 192.0.2.0/24 docs
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51) || (a === 203 && b === 0) // docs
  );
}

/** True for any address that is not plain public unicast. */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return ipv4Private(ip);
  if (family !== 6) return true;
  const v6 = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return ipv4Private(mapped[1]!);
  return (
    v6 === "::" || v6 === "::1" ||
    /^f[cd]/.test(v6) || // unique local
    /^fe[89ab]/.test(v6) || // link-local
    /^ff/.test(v6) || // multicast
    v6.startsWith("64:ff9b:") || // NAT64 (can reach IPv4 private space)
    v6.startsWith("2001:db8:") // docs
  );
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Static check for a customer-supplied webhook URL (on save and before each
 * send): https in production, no credentials, no IP literal or name that is
 * private. The address a name resolves to is checked again at connect time.
 */
export function checkWebhookUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL non valido" };
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !isProduction())) return { ok: false, reason: "serve un indirizzo https://" };
  if (url.username || url.password) return { ok: false, reason: "niente credenziali nell'indirizzo" };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!isProduction()) return { ok: true, url };
  if (net.isIP(host) ? isPrivateAddress(host) : host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local") || !host.includes(".")) {
    return { ok: false, reason: "l'indirizzo deve essere raggiungibile da internet" };
  }
  return { ok: true, url };
}

/** `lookup` for http(s).request that refuses private answers (in production). */
function guardedLookup(hostname: string, options: object, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    if (isProduction() && list.some((a) => isPrivateAddress(a.address))) {
      const e: NodeJS.ErrnoException = new Error(`${hostname} risolve su un indirizzo privato`);
      e.code = "EPRIVATEADDR";
      return callback(e, "");
    }
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}

/** POSTs `body` to a checked webhook URL. Never follows redirects. */
export function postWebhook(raw: string, body: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<{ status: number }> {
  const check = checkWebhookUrl(raw);
  if (!check.ok) return Promise.reject(new Error(check.reason));
  const { url } = check;
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
        lookup: guardedLookup as never,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume(); // the response body is never read
        resolve({ status: res.statusCode ?? 0 });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

// Endpoints browsers hand out for Web Push (Chrome/Edge/Android via FCM,
// Firefox, Edge/Windows, Safari/iOS).
const PUSH_SERVICE_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

/** True when `endpoint` is an https URL on a known push service. */
export function isPushServiceEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  // Reserved TLD (RFC 2606) the e2e suite stubs; never resolvable.
  if (!isProduction() && host.endsWith(".invalid")) return true;
  return PUSH_SERVICE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

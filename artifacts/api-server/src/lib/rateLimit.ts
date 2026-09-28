import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { SharedRateLimitStore, bucketPart } from "./rateLimitStore.js";

// Requires `app.set("trust proxy", ...)` upstream so req.ip reflects the
// real client IP behind Vercel's proxy instead of colliding on one IP.
//
// SEC-2: every limiter counts in Postgres (rateLimitStore.ts), shared by all
// instances, so each one needs a `name` that is unique in the app — it is the
// prefix of its rows. Two limiters with the same name would share one budget.

type LimiterOptions = { name: string; windowMs: number; max: number; message: string };

const names = new Set<string>();

function base(opts: LimiterOptions, keyGenerator?: (req: Request, res: Response) => string) {
  if (names.has(opts.name)) throw new Error(`Rate limiter name already used: ${opts.name}`);
  names.add(opts.name);
  return {
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SharedRateLimitStore(opts.name),
    // A database hiccup must not turn every limited route into a 500.
    passOnStoreError: true,
    ...(keyGenerator ? { keyGenerator } : {}),
    // Both keys populated: better-auth's client reads `message` off the
    // error body, our own hand-written fetch helpers (usage-api.ts etc.)
    // read `error`/`message` too — a rate-limit block should never come
    // through the UI looking like "invalid credentials".
    message: { error: opts.message, message: opts.message, code: "RATE_LIMITED" },
  } as const;
}

export function ipRateLimiter(opts: LimiterOptions) {
  return rateLimit(base(opts));
}

/**
 * Keys by the authenticated PERSON (res.locals.actorUserId, set by
 * requireAuth / requireApiKey) — must run AFTER requireAuth. Before SEC-2 it
 * keyed by res.locals.userId, which is the company: one member could use up
 * the whole team's budget (and a login throttle was shared by the team).
 * The company-wide ceiling on AI spending is the monthly cap (aiBudget.ts).
 */
export function userRateLimiter(opts: LimiterOptions) {
  return rateLimit(base(opts, (req: Request, res: Response) => bucketPart(String(res.locals.actorUserId || res.locals.userId || req.ip || "unknown"))));
}

/**
 * The widget's public key is readable by anyone on the customer's site. A hard
 * per-key limit let a stranger switch off a company's widget for an hour by
 * spending its budget. This one never blocks: past the limit it sets
 * `res.locals.aiDegraded`, and the route saves the request without calling
 * the AI (the visitor sees the widget's own local estimate). The hard limit
 * stays per source IP.
 */
export function widgetKeySoftLimiter(opts: LimiterOptions) {
  return rateLimit({
    ...base(opts, (req: Request) => {
      const apiKey = req.headers["x-api-key"] || req.query.apiKey;
      return bucketPart(apiKey ? String(apiKey) : req.ip || "unknown");
    }),
    handler: (_req, res, next) => {
      res.locals.aiDegraded = "key_hourly";
      next();
    },
  });
}

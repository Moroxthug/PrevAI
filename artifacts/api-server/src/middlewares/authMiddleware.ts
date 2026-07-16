import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

declare global {
  namespace Express {
    interface Locals {
      userId: string;
      userEmail: string;
      userName: string;
    }
  }
}

// Generico su P: se restasse fisso al default di Request, TypeScript
// unificherebbe il tipo di req.params sull'intera catena di handler al
// valore più generico (string | string[]) ogni volta che questo middleware
// precede un handler con parametri di rotta letterali (es.
// router.get("/foo/:id", requireAuth, (req) => req.params.id)), nascondendo
// il tipo reale inferito dalla stringa di rotta.
export async function requireAuth<P = Record<string, string>>(req: Request<P>, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.locals.userId = session.user.id;
    res.locals.userEmail = session.user.email;
    res.locals.userName = session.user.name;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getUserId(res: Response): string {
  return res.locals.userId;
}

export function getUserEmail(res: Response): string {
  return res.locals.userEmail ?? "";
}

export function getUserName(res: Response): string {
  return res.locals.userName ?? "";
}

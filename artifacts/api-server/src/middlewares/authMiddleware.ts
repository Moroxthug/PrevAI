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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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

import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { appConfig, participants, users } from "@shared/schema";
import { souvenirExpiry } from "@shared/participant-card";
import { db } from "./db";

export function accountRevision(account: { passwordHash: string; roles: string }) {
  return createHash("sha256").update(JSON.stringify([account.passwordHash, account.roles])).digest("base64url");
}

export async function legacyVisitorExpired() {
  const [config] = await db.select({ eventClosedAt: appConfig.eventClosedAt }).from(appConfig).orderBy(appConfig.id).limit(1);
  return Boolean(config?.eventClosedAt && souvenirExpiry(config.eventClosedAt) <= new Date());
}

export const validateSessionAccount: RequestHandler = async (req, _res, next) => {
  const current = req.session?.user;
  const visitor = req.session?.visitor;

  if (current) {
    const [account] = await db.select({
      passwordHash: users.passwordHash,
      roles: users.roles,
    }).from(users).where(eq(users.id, current.id)).limit(1);
    if (account && req.session.staffRevision === accountRevision(account)) return next();
  } else if (visitor) {
    const [participant] = await db.select({ secretCode: participants.secretCode })
      .from(participants).where(and(eq(participants.id, visitor.participantId), isNull(participants.deletedAt))).limit(1);
    if (participant?.secretCode && participant.secretCode === visitor.secretCode && !await legacyVisitorExpired()) return next();
  } else {
    return next();
  }

  req.session.regenerate(err => next(err));
};

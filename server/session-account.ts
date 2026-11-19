import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { participants, users } from "@shared/schema";
import { db } from "./db";

export function accountRevision(account: { passwordHash: string; roles: string }) {
  return createHash("sha256").update(JSON.stringify([account.passwordHash, account.roles])).digest("base64url");
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
      .from(participants).where(eq(participants.id, visitor.participantId)).limit(1);
    if (participant?.secretCode && participant.secretCode === visitor.secretCode) return next();
  } else {
    return next();
  }

  req.session.regenerate(err => next(err));
};

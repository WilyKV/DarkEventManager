import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import {
  eventBackupExtension, eventBackupMaxBytes, eventBackupPassphraseMax, eventBackupPassphraseMin, eventBackupPath,
} from "@shared/event-backup";
import { requireRole } from "./auth-middleware";
import { inspectEventBackup, InvalidEventBackup, readEventBackup, restoreEventBackup } from "./event-backup-data";
import { childLogger } from "./logger";

const logger = childLogger("event-backup");
const deriveKey = promisify(pbkdf2);
const header = Buffer.from("DARKEVENT-BACKUP-V1\n", "ascii");
const saltBytes = 16;
const ivBytes = 12;
const tagBytes = 16;
const envelopeBytes = header.length + saltBytes + ivBytes + tagBytes;
const passphraseSchema = z.string().min(eventBackupPassphraseMin).max(eventBackupPassphraseMax);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: eventBackupMaxBytes, fields: 1, fieldSize: 2048, files: 1, parts: 3 },
}).single("file");

async function backupKey(passphrase: string, salt: Buffer) {
  return deriveKey(passphrase, salt, 600_000, 32, "sha256");
}

async function encryptBackup(plain: Buffer, passphrase: string) {
  const salt = randomBytes(saltBytes);
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv("aes-256-gcm", await backupKey(passphrase, salt), iv);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, salt, iv, cipher.getAuthTag(), body]);
}

async function decodeUpload(req: Request) {
  const phrase = passphraseSchema.safeParse(req.body?.passphrase);
  if (!phrase.success || !req.file) throw new InvalidEventBackup("Choisissez un fichier et saisissez sa phrase de sauvegarde.");
  const file = req.file.buffer;
  if (file.length <= envelopeBytes || !file.subarray(0, header.length).equals(header)) {
    throw new InvalidEventBackup("Choisissez un fichier de sauvegarde DarkEventManager.");
  }
  const salt = file.subarray(header.length, header.length + saltBytes);
  const iv = file.subarray(header.length + saltBytes, envelopeBytes - tagBytes);
  const tag = file.subarray(envelopeBytes - tagBytes, envelopeBytes);
  try {
    const decipher = createDecipheriv("aes-256-gcm", await backupKey(phrase.data, salt), iv);
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(file.subarray(envelopeBytes)), decipher.final()]);
    return inspectEventBackup(JSON.parse(plain.toString("utf8")));
  } catch (error) {
    if (error instanceof InvalidEventBackup) throw error;
    throw new InvalidEventBackup("La phrase est incorrecte ou le fichier est endommagé.");
  }
}

function sendBackupError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidEventBackup) return res.status(400).json({ message: error.message });
  // A database error can contain the query parameters and confidential backup records.
  logger.error({ type: error instanceof Error ? error.name : "UnknownError" }, action);
  return res.status(500).json({ message: action });
}

export function registerEventBackupRoutes(app: Express) {
  const admin = requireRole("admin");

  app.post(`${eventBackupPath}/export`, admin, async (req, res) => {
    const passphrase = passphraseSchema.safeParse(req.body?.passphrase);
    if (!passphrase.success) {
      return res.status(400).json({ message: `Choisissez une phrase d’au moins ${eventBackupPassphraseMin} caractères.` });
    }
    try {
      const backup = await readEventBackup();
      const plain = Buffer.from(JSON.stringify(backup), "utf8");
      if (plain.length + envelopeBytes >= eventBackupMaxBytes) {
        return res.status(413).json({ message: "La sauvegarde dépasse la taille de fichier prise en charge." });
      }
      const contents = await encryptBackup(plain, passphrase.data);
      res.set("Cache-Control", "no-store")
        .attachment(`darkevent-${backup.createdAt.slice(0, 10)}${eventBackupExtension}`)
        .type("application/octet-stream").send(contents);
    } catch (error) {
      sendBackupError(res, error, "Impossible de créer la sauvegarde.");
    }
  });

  app.post(`${eventBackupPath}/verify`, admin, upload, async (req, res) => {
    try {
      const { summary } = await decodeUpload(req);
      res.json(summary);
    } catch (error) {
      sendBackupError(res, error, "Impossible de vérifier la sauvegarde.");
    }
  });

  app.post(`${eventBackupPath}/restore`, admin, upload, async (req, res) => {
    try {
      const { backup, summary } = await decodeUpload(req);
      await restoreEventBackup(backup);
      req.session.destroy(error => {
        if (error) logger.warn("La session de restauration a expiré.");
        res.json(summary);
      });
    } catch (error) {
      sendBackupError(res, error, "Impossible de restaurer la sauvegarde. Les données du serveur ont été conservées.");
    }
  });
}

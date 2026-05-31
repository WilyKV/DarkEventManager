/**
 * Tests TDD — Red Phase
 *
 * SEC-HARDENING / LOW-1
 * Complétude de .env.example : toutes les variables requises par le code
 * doivent être documentées dans .env.example.
 *
 * Variables manquantes à ajouter (raison de l'échec attendu) :
 *   - WEBSOCKET_SECRET  (server/websocket-secret-config.ts)
 *   - QR_ENCRYPTION_KEY (server/qr-config.ts ou équivalent)
 *   - QR_ENCRYPTION_IV  (idem)
 *
 * Chacune de ces trois variables doit également être accompagnée d'un commentaire
 * expliquant comment générer une valeur sécurisée, par exemple :
 *   # Générer avec : openssl rand -hex 32
 *
 * Ces tests échoueront tant que .env.example n'est pas mis à jour.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Chargement du fichier .env.example
// ---------------------------------------------------------------------------

const ENV_EXAMPLE_PATH = path.resolve(
  import.meta.dirname,
  "..",
  ".env.example"
);

let envExampleContent = "";

beforeAll(async () => {
  envExampleContent = await readFile(ENV_EXAMPLE_PATH, "utf-8");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Vérifie qu'une variable d'environnement est présente dans .env.example.
 * Accepte aussi bien la forme active (`VAR=valeur`) que commentée (`# VAR=valeur`).
 */
function isVariablePresent(content: string, varName: string): boolean {
  // Forme active : début de ligne, optionnellement précédée d'espaces, puis VAR=
  const activePattern = new RegExp(`^\\s*${varName}\\s*=`, "m");
  // Forme commentée : # optionnel + espaces + VAR=
  const commentedPattern = new RegExp(`^#\\s*${varName}\\s*=`, "m");
  return activePattern.test(content) || commentedPattern.test(content);
}

/**
 * Vérifie qu'une variable est accompagnée d'un commentaire de génération.
 * On cherche `openssl rand` dans les lignes précédant la variable (dans un rayon de 5 lignes).
 */
function hasGenerationComment(content: string, varName: string): boolean {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Trouver la ligne de la variable
    if (new RegExp(`^#?\\s*${varName}\\s*=`).test(line)) {
      // Chercher un commentaire de génération dans les 5 lignes précédentes
      const start = Math.max(0, i - 5);
      const context = lines.slice(start, i + 1).join("\n");
      if (/openssl\s+rand/i.test(context)) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe(".env.example — complétude des variables d'environnement", () => {

  // -------------------------------------------------------------------------
  // 1. Variables déjà présentes (régression — ne doivent pas disparaître)
  // -------------------------------------------------------------------------

  describe("variables existantes (régression)", () => {

    it("should contain NODE_ENV", () => {
      expect(isVariablePresent(envExampleContent, "NODE_ENV")).toBe(true);
    });

    it("should contain DATABASE_URL", () => {
      expect(isVariablePresent(envExampleContent, "DATABASE_URL")).toBe(true);
    });

    it("should contain SESSION_SECRET", () => {
      expect(isVariablePresent(envExampleContent, "SESSION_SECRET")).toBe(true);
    });

    it("should contain SMTP_HOST", () => {
      expect(isVariablePresent(envExampleContent, "SMTP_HOST")).toBe(true);
    });

    it("should contain SMTP_PORT", () => {
      expect(isVariablePresent(envExampleContent, "SMTP_PORT")).toBe(true);
    });

    it("should contain SMTP_SECURE", () => {
      expect(isVariablePresent(envExampleContent, "SMTP_SECURE")).toBe(true);
    });

    it("should contain SMTP_USER", () => {
      expect(isVariablePresent(envExampleContent, "SMTP_USER")).toBe(true);
    });

    it("should contain SMTP_PASS", () => {
      expect(isVariablePresent(envExampleContent, "SMTP_PASS")).toBe(true);
    });

    it("should contain EMAIL_FROM", () => {
      expect(isVariablePresent(envExampleContent, "EMAIL_FROM")).toBe(true);
    });

    it("should contain EMAIL_FROM_NAME", () => {
      expect(isVariablePresent(envExampleContent, "EMAIL_FROM_NAME")).toBe(true);
    });

    it("should contain DEV_EMAIL_OVERRIDE", () => {
      expect(isVariablePresent(envExampleContent, "DEV_EMAIL_OVERRIDE")).toBe(true);
    });

  });

  // -------------------------------------------------------------------------
  // 2. Variables manquantes à ajouter (Red Phase — ces tests échouent)
  // -------------------------------------------------------------------------

  describe("variables manquantes à documenter (RED — à corriger)", () => {

    it("should contain WEBSOCKET_SECRET", () => {
      // WEBSOCKET_SECRET est utilisée dans server/websocket-secret-config.ts
      // Si absente, un random est généré à chaque démarrage, cassant les sessions WS multi-instances.
      expect(isVariablePresent(envExampleContent, "WEBSOCKET_SECRET")).toBe(true);
    });

    it("should contain QR_ENCRYPTION_KEY", () => {
      // QR_ENCRYPTION_KEY est utilisée pour le chiffrement AES-256-CBC des QR codes.
      // La valeur par défaut hardcodée est un risque de sécurité en production.
      expect(isVariablePresent(envExampleContent, "QR_ENCRYPTION_KEY")).toBe(true);
    });

    it("should contain QR_ENCRYPTION_IV", () => {
      // QR_ENCRYPTION_IV (vecteur d'initialisation AES).
      // Doit être unique et secret, pas hardcodé.
      expect(isVariablePresent(envExampleContent, "QR_ENCRYPTION_IV")).toBe(true);
    });

    it("should contain PORT", () => {
      // PORT est documenté dans CLAUDE.md comme variable d'env supportée.
      expect(isVariablePresent(envExampleContent, "PORT")).toBe(true);
    });

  });

  // -------------------------------------------------------------------------
  // 3. Variables critiques avec instruction de génération (Red Phase)
  // -------------------------------------------------------------------------

  describe("instructions de génération pour les variables cryptographiques (RED — à corriger)", () => {

    it("should have a generation comment (openssl rand) near WEBSOCKET_SECRET", () => {
      // Chaque variable cryptographique doit être accompagnée d'une instruction de génération.
      // Exemple attendu dans .env.example :
      //   # Générer avec : openssl rand -hex 32
      //   WEBSOCKET_SECRET=
      expect(hasGenerationComment(envExampleContent, "WEBSOCKET_SECRET")).toBe(true);
    });

    it("should have a generation comment (openssl rand) near QR_ENCRYPTION_KEY", () => {
      expect(hasGenerationComment(envExampleContent, "QR_ENCRYPTION_KEY")).toBe(true);
    });

    it("should have a generation comment (openssl rand) near QR_ENCRYPTION_IV", () => {
      expect(hasGenerationComment(envExampleContent, "QR_ENCRYPTION_IV")).toBe(true);
    });

  });

  // -------------------------------------------------------------------------
  // 4. Le fichier .env.example est lisible et non vide
  // -------------------------------------------------------------------------

  describe("santé du fichier .env.example", () => {

    it("should be a non-empty file", () => {
      expect(envExampleContent.length).toBeGreaterThan(0);
    });

    it("should contain at least 10 variable declarations", () => {
      // Compte les lignes avec une déclaration VAR= (active ou commentée)
      const declarationCount = (envExampleContent.match(/^#?\s*[A-Z_]+=.*/gm) ?? []).length;
      expect(declarationCount).toBeGreaterThanOrEqual(10);
    });

  });

});

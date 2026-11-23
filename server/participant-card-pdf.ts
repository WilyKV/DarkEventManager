import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { cardArtwork, cardAssets, cardLayout, cardTheme, printedCardName, souvenirPath, type PrintableCard } from "@shared/participant-card";

export const printModes = ["complete", "front", "back"] as const;
export type PrintMode = typeof printModes[number];
const pt = (mm: number) => mm * 72 / 25.4;
const { width, height, nameX, nameWidth, nameCenterY, namePanelY, namePanelHeight, mealBoxSize, qrX, qrY, qrSize, codeY } = cardLayout;

async function findCardAsset(file: string) {
  // esbuild emits the production server beside Vite’s public directory.
  for (const path of [`./public/${cardAssets}/${file}`, `../client/public/${cardAssets}/${file}`]) {
    try {
      const url = new URL(path, import.meta.url);
      await access(url);
      return fileURLToPath(url);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Ressource de carte introuvable : ${file}`);
}

function backdrop(doc: PDFKit.PDFDocument, side: "front" | "back", theme: ReturnType<typeof cardTheme>, artwork?: string) {
  const gradient = doc.linearGradient(0, 0, pt(width), pt(height))
    .stop(0, "#0d0b11").stop(0.58, theme.dark).stop(1, "#100b12");
  doc.rect(0, 0, pt(width), pt(height)).fill(gradient);
  if (theme.zombie && artwork) {
    doc.save();
    doc.rect(0, 0, pt(width), pt(height)).clip();
    doc.image(artwork, 0, pt(side === "front" ? -9 : 0), { width: pt(width) });
    doc.restore();
  }
  doc.polygon([0, pt(43)], [pt(width), pt(42)], [pt(width), pt(height)], [0, pt(height)]).fill("#100b12");
  doc.rect(0, pt(54), pt(width), pt(1)).fill(theme.accent);
}

function template(doc: PDFKit.PDFDocument, side: "front" | "back", theme: ReturnType<typeof cardTheme>, artwork?: string) {
  backdrop(doc, side, theme, artwork);
  doc.fillColor("#ffffff").font("CardBold").fontSize(12)
    .text("ZOMB’IN THE DARK", pt(6), pt(5), { lineBreak: false });
  doc.fillColor(theme.light).fontSize(7)
    .text(theme.label, pt(6), pt(11), { lineBreak: false, characterSpacing: 1.1 });

  if (side === "front") {
    doc.roundedRect(pt(4.5), pt(namePanelY), pt(48.5), pt(namePanelHeight), pt(2)).fill("#ffffff");
    doc.rect(pt(4.5), pt(namePanelY + 2), pt(0.6), pt(namePanelHeight - 4)).fill(theme.accent);
    doc.roundedRect(pt(54.5), pt(12.5), pt(25), pt(25), pt(2)).fill("#ffffff");
    doc.fillColor("#ffffff").font("CardBold").fontSize(7)
      .text("Mon espace souvenir", pt(51), pt(39), { width: pt(32), align: "center" });
    doc.roundedRect(pt(6), pt(44.25), pt(mealBoxSize), pt(mealBoxSize), pt(0.45)).fill("#ffffff");
    doc.fillColor("#ffffff").font("CardBold").fontSize(8).text("Repas", pt(13.5), pt(45.5), { lineBreak: false });
    doc.fillColor("#ffffff").font("CardRegular").text("N° de passage", pt(28), pt(45.5), { lineBreak: false });
    doc.roundedRect(pt(49), pt(45), pt(14), pt(4), pt(0.45)).fill("#ffffff");
    return;
  }

  doc.fillColor("#ffffff").font("CardBold").fontSize(10)
    .text("CODE D’ACCÈS", pt(13), pt(19), { width: pt(59), align: "center" });
  doc.roundedRect(pt(13), pt(24), pt(59), pt(11), pt(2)).fill("#ffffff");
  doc.fillColor("#ffffff").font("CardRegular").fontSize(8).text(
    "Scannez le QR au recto, puis saisissez ce code.\nEspace disponible jusqu’à 3 mois après la clôture.",
    pt(5), pt(44), { width: pt(75), align: "center", lineGap: 2 });
}

function printName(doc: PDFKit.PDFDocument, name: string) {
  let size = 17;
  doc.font("CardBold").fontSize(size);
  while (size > 8 && doc.widthOfString(name) > pt(nameWidth)) doc.fontSize(--size);
  const lineHeight = doc.currentLineHeight();
  doc.fillColor("#101828").text(name, pt(nameX), pt(nameCenterY) - lineHeight / 2, {
    width: pt(nameWidth), height: lineHeight + 0.1, ellipsis: true,
  });
}

export async function renderParticipantCards(cards: readonly PrintableCard[], origin: string, mode: PrintMode) {
  const doc = new PDFDocument({ size: [pt(width), pt(height)], margin: 0, autoFirstPage: false });
  const parts: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => parts.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(parts)));
  });
  const sides = mode === "complete" ? ["front", "back"] as const : [mode];
  const entries = cards.length ? cards : [undefined];
  try {
    const [regular, bold, artwork] = await Promise.all([
      findCardAsset("OpenSans-Regular.ttf"),
      findCardAsset("OpenSans-Bold.ttf"),
      (mode === "complete" || !cards.length) && (!cards.length || cards.some(card => cardTheme(card.type).zombie))
        ? findCardAsset(cardArtwork) : undefined,
    ]);
    doc.registerFont("CardRegular", regular);
    doc.registerFont("CardBold", bold);
    for (const card of entries) {
      const theme = cardTheme(card?.type ?? "zombie");
      for (const side of sides) {
        doc.addPage();
        if (mode === "complete" || !card) template(doc, side, theme, artwork);
        if (!card) continue;
        if (side === "front") {
          printName(doc, printedCardName(card));
          const url = new URL(`${souvenirPath}/${card.token}`, origin).href;
          const qr = await QRCode.toBuffer(url, { width: 360, margin: 4, errorCorrectionLevel: "M" });
          doc.image(qr, pt(qrX), pt(qrY), { width: pt(qrSize), height: pt(qrSize) });
        } else {
          const code = `${card.code.slice(0, 5)} ${card.code.slice(5)}`;
          doc.fillColor("#101828").font("CardBold").fontSize(16);
          doc.text(code, (pt(width) - doc.widthOfString(code)) / 2, pt(codeY), { lineBreak: false });
        }
      }
    }
    doc.end();
    return await output;
  } catch (error) {
    doc.end();
    throw error;
  }
}

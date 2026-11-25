import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { a4CardBleed, cardAssets, cardHasMealBox, cardLayout, cardScheduleFields, cardScheduleLabel, cardScheduleValue, cardSheet, cardSheetPosition, cardTheme, printedCardName, souvenirCodeHint, souvenirPath, type CardPrintLayout, type PrintableCard } from "@shared/participant-card";

export const printModes = ["complete", "front", "back"] as const;
export type PrintMode = typeof printModes[number];
const pt = (mm: number) => mm * 72 / 25.4;
const { width, height, nameX, nameWidth, nameCenterY, namePanelY, namePanelHeight, mealBoxSize, mealBoxY, staffMealBoxY, makeupBoxY, makeupBoxHeight, makeupBoxWidth, qrX, qrY, qrSize, codeY, scheduleY, scheduleHeight } = cardLayout;

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

function backdrop(doc: PDFKit.PDFDocument, theme: ReturnType<typeof cardTheme>, bleed: { x: number; y: number }, artwork?: string) {
  const gradient = doc.linearGradient(0, 0, pt(width), pt(height))
    .stop(0, "#0d0b11").stop(0.58, theme.dark).stop(1, "#100b12");
  const background = () => doc.rect(pt(-bleed.x), pt(-bleed.y), pt(width + 2 * bleed.x), pt(height + 2 * bleed.y));
  background().fill(gradient);
  if (artwork) {
    doc.save();
    background().clip();
    doc.image(artwork, pt(-bleed.x), pt(-bleed.y), {
      cover: [pt(width + 2 * bleed.x), pt(height + 2 * bleed.y)], align: "center", valign: "center",
    });
    doc.restore();
  }
}

function template(doc: PDFKit.PDFDocument, side: "front" | "back", theme: ReturnType<typeof cardTheme>, bleed: { x: number; y: number }, hasQr: boolean, type: string, artwork?: string) {
  backdrop(doc, theme, bleed, artwork);
  doc.fillColor("#ffffff").font("CardBold").fontSize(12)
    .text("ZOMB’IN THE DARK", pt(6), pt(5), { lineBreak: false });
  doc.fillColor(theme.light).fontSize(7)
    .text(theme.label, pt(6), pt(11), { lineBreak: false, characterSpacing: 1.1 });

  if (side === "front") {
    doc.roundedRect(pt(4.5), pt(namePanelY), pt(48.5), pt(namePanelHeight), pt(2)).fill("#ffffff");
    doc.rect(pt(4.5), pt(namePanelY + 2), pt(0.6), pt(namePanelHeight - 4)).fill(theme.accent);
    if (hasQr) {
      doc.roundedRect(pt(54.5), pt(12.5), pt(25), pt(25), pt(2)).fill("#ffffff");
      doc.fillColor("#ffffff").font("CardBold").fontSize(7)
        .text("Mon espace souvenir", pt(51), pt(39), { width: pt(32), align: "center" });
    }
    for (const field of cardScheduleFields(type)) {
      doc.roundedRect(pt(field.x), pt(scheduleY), pt(field.width), pt(scheduleHeight), pt(0.8)).fill("#ffffff");
      doc.fillColor("#334155").font("CardBold").fontSize(5.5)
        .text(cardScheduleLabel(field, type), pt(field.x), pt(scheduleY + 0.5), { width: pt(field.width), align: "center", lineBreak: false });
    }
    if (cardHasMealBox(type)) {
      const mealY = type === "staff" ? staffMealBoxY : mealBoxY;
      doc.roundedRect(pt(6), pt(mealY), pt(mealBoxSize), pt(mealBoxSize), pt(0.45)).fill("#ffffff");
      doc.fillColor("#ffffff").font("CardBold").fontSize(8).text("Repas", pt(13.5), pt(mealY + 1.25), { lineBreak: false });
    }
    if (theme.zombie) {
      doc.fillColor("#ffffff").font("CardRegular").text("Maquillage", pt(28), pt(45.5), { lineBreak: false });
      doc.roundedRect(pt(49), pt(makeupBoxY), pt(makeupBoxWidth), pt(makeupBoxHeight), pt(0.45)).fill("#ffffff");
    }
    return;
  }

  doc.fillColor("#ffffff").font("CardBold").fontSize(10)
    .text("CODE D’ACCÈS", pt(13), pt(19), { width: pt(59), align: "center" });
  doc.roundedRect(pt(13), pt(24), pt(59), pt(11), pt(2)).fill("#ffffff");
  doc.fillColor("#334155").font("CardRegular").fontSize(6.25)
    .text(souvenirCodeHint, pt(13), pt(24.45), { width: pt(59), align: "center" });
  if (hasQr) {
    doc.fillColor("#ffffff").font("CardRegular").fontSize(8).text(
      "Scannez le QR au recto, puis saisissez ce code.\nEspace disponible jusqu’à 3 mois après la clôture.",
      pt(5), pt(44), { width: pt(75), align: "center", lineGap: 2 });
  }
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

function trimMarks(doc: PDFKit.PDFDocument) {
  const horizontalStart = a4CardBleed.x + 0.15;
  const horizontalEnd = a4CardBleed.x + 0.9;
  const verticalStart = a4CardBleed.y + 0.15;
  const verticalEnd = a4CardBleed.y + 0.45;
  doc.lineWidth(0.35).strokeColor("#222222");
  for (const x of [0, width]) {
    const dx = x === 0 ? -1 : 1;
    for (const y of [0, height]) {
      doc.moveTo(pt(x + dx * horizontalStart), pt(y)).lineTo(pt(x + dx * horizontalEnd), pt(y));
    }
    doc.moveTo(pt(x), pt(-verticalStart)).lineTo(pt(x), pt(-verticalEnd));
    doc.moveTo(pt(x), pt(height + verticalStart)).lineTo(pt(x), pt(height + verticalEnd));
  }
  doc.stroke();
}

export async function renderParticipantCards(cards: readonly PrintableCard[], origin: string, mode: PrintMode, layout: CardPrintLayout = "card") {
  const a4 = layout === "a4";
  const page = a4 ? cardSheet : cardLayout;
  const doc = new PDFDocument({ size: [pt(page.width), pt(page.height)], margin: 0, autoFirstPage: false });
  const parts: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => parts.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(parts)));
  });
  const sides = mode === "complete" ? ["front", "back"] as const : [mode];
  const capacity = a4 ? cardSheet.capacity : 1;
  const entries = cards.length ? cards : Array.from({ length: capacity }, () => undefined);
  try {
    const artworkNames = mode === "complete" || !cards.length
      ? new Set(entries.flatMap(card => cardTheme(card?.type ?? "zombie").artwork ?? []))
      : new Set<string>();
    const [regular, bold, resolvedArtwork] = await Promise.all([
      findCardAsset("OpenSans-Regular.ttf"),
      findCardAsset("OpenSans-Bold.ttf"),
      Promise.all(Array.from(artworkNames, async name => [name, await findCardAsset(name)] as const)),
    ]);
    const artworkByName = new Map<string, string>(resolvedArtwork);
    doc.registerFont("CardRegular", regular);
    doc.registerFont("CardBold", bold);
    for (let start = 0; start < entries.length; start += capacity) {
      const sheet = entries.slice(start, start + capacity);
      for (const side of sides) {
        doc.addPage();
        for (let index = 0; index < sheet.length; index++) {
          const card = sheet[index];
          doc.save();
          if (a4) {
            const { x, y } = cardSheetPosition(index, side);
            doc.translate(pt(x), pt(y));
          }
          if (mode === "complete" || !card) {
            const type = card?.type ?? "zombie";
            const theme = cardTheme(type);
            template(doc, side, theme, a4 ? a4CardBleed : { x: 0, y: 0 }, Boolean(card), type,
              theme.artwork ? artworkByName.get(theme.artwork) : undefined);
            if (a4) trimMarks(doc);
          }
          if (card && side === "front") {
            printName(doc, printedCardName(card));
            if (mode === "complete") {
              for (const field of cardScheduleFields(card.type)) {
                const value = cardScheduleValue(card, field.key);
                if (value) doc.fillColor("#101828").font("CardBold").fontSize(9)
                  .text(value, pt(field.x), pt(scheduleY + 3), { width: pt(field.width), align: "center", lineBreak: false });
              }
            }
            const url = new URL(`${souvenirPath}/${card.token}`, origin).href;
            const qr = await QRCode.toBuffer(url, { width: 360, margin: 4, errorCorrectionLevel: "M" });
            doc.image(qr, pt(qrX), pt(qrY), { width: pt(qrSize), height: pt(qrSize) });
          } else if (card) {
            const code = `${card.code.slice(0, 5)} ${card.code.slice(5)}`;
            doc.fillColor("#101828").font("CardBold").fontSize(16);
            doc.text(code, (pt(width) - doc.widthOfString(code)) / 2, pt(codeY), { lineBreak: false });
          }
          doc.restore();
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

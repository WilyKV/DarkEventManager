import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { a4CardBleed, calibratedCardSheet, cardAssets, cardFieldIcons, cardHasMealBox, cardLayout, cardScheduleFields, cardBriefingTime, cardSheet, cardSheetOffset, cardSheetPosition, cardTheme, printedCardName, souvenirCodeHint, souvenirPath, souvenirRecoveryPath, type CardPrintLayout, type PrintableCard } from "@shared/participant-card";

export const printModes = ["complete", "front", "back"] as const;
export type PrintMode = typeof printModes[number];
const pt = (mm: number) => mm * 72 / 25.4;
const { width, height, nameX, nameWidth, nameCenterY, namePanelY, namePanelHeight, mealBoxSize, mealBoxY, staffMealBoxY, qrX, qrY, qrSize, codeY, linkY, scheduleY, scheduleHeight, scheduleSideLabelWidth } = cardLayout;

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

function fieldIcon(doc: PDFKit.PDFDocument, field: keyof typeof cardFieldIcons, x: number, y: number, w: number, h: number) {
  const size = Math.min(w, h) * 0.62;
  doc.save().translate(pt(x + (w - size) / 2), pt(y + (h - size) / 2)).scale(pt(size) / 24)
    .lineWidth(1.8).lineCap("round").lineJoin("round").strokeOpacity(0.2)
    .path(cardFieldIcons[field]).stroke("#0f172a").restore();
}

function template(doc: PDFKit.PDFDocument, side: "front" | "back", theme: ReturnType<typeof cardTheme>, bleed: { x: number; y: number }, recovery: boolean, type: string, artwork?: string) {
  backdrop(doc, theme, bleed, artwork);
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
    for (const field of cardScheduleFields(type)) {
      doc.roundedRect(pt(field.x), pt(scheduleY), pt(field.width), pt(scheduleHeight), pt(0.8)).fill("#ffffff");
      const labelX = field.x - scheduleSideLabelWidth;
      const centerX = pt(labelX + scheduleSideLabelWidth / 2);
      const centerY = pt(scheduleY + scheduleHeight / 2);
      doc.roundedRect(pt(labelX), pt(scheduleY), pt(scheduleSideLabelWidth), pt(scheduleHeight), pt(0.8)).fill("#100b12");
      doc.save().rotate(-90, { origin: [centerX, centerY] });
      doc.fillColor("#ffffff").font("CardBold").fontSize(5.2);
      doc.text(field.label, centerX - doc.widthOfString(field.label) / 2, centerY - doc.currentLineHeight() / 2, { lineBreak: false });
      doc.restore();
      if (field.key !== "briefing") fieldIcon(doc, field.key, field.x, scheduleY, field.width, scheduleHeight);
    }
    if (cardHasMealBox(type)) {
      const mealY = type === "staff" ? staffMealBoxY : mealBoxY;
      doc.roundedRect(pt(6), pt(mealY), pt(mealBoxSize), pt(mealBoxSize), pt(0.45)).fill("#ffffff");
      fieldIcon(doc, "meal", 6, mealY, mealBoxSize, mealBoxSize);
    }
    return;
  }

  doc.fillColor("#ffffff").font("CardBold").fontSize(10)
    .text("CODE D’ACCÈS", pt(13), pt(19), { width: pt(59), align: "center" });
  doc.roundedRect(pt(13), pt(24), pt(59), pt(11), pt(2)).fill("#ffffff");
  doc.fillColor("#334155").font("CardRegular").fontSize(6.25)
    .text(souvenirCodeHint, pt(13), pt(24.45), { width: pt(59), align: "center" });
  doc.fillColor("#ffffff").font("CardRegular").fontSize(8).text(
    recovery
      ? "Scannez le QR au recto, puis indiquez ce code,\nvos nom et prénom et votre profil."
      : "Scannez le QR au recto, puis saisissez ce code.\nEspace disponible jusqu’à 3 mois après la clôture.",
    pt(5), pt(44), { width: pt(75), align: "center", lineGap: 2 });
}

function printCardLink(doc: PDFKit.PDFDocument, url: string) {
  doc.font("CardRegular").fontSize(6.5);
  const maxWidth = pt(74);
  const size = Math.min(6.5, 6.5 * maxWidth / doc.widthOfString(url));
  doc.roundedRect(pt(5), pt(linkY - 0.45), pt(75), pt(3.15), pt(0.5)).fill("#100b12");
  doc.fillColor("#ffffff").fontSize(size).text(url, pt(5), pt(linkY), {
    width: pt(75), align: "center", lineBreak: false, link: url,
  });
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

function alignmentMark(doc: PDFKit.PDFDocument, side: "front" | "back", calibrated: boolean) {
  const offset = cardSheetOffset(side, calibrated);
  const x = (side === "front" ? 10 : cardSheet.width - 10) + offset.x;
  const y = 15 + offset.y;
  doc.save().translate(pt(x), pt(y)).lineWidth(0.4).strokeColor("#222222");
  doc.moveTo(pt(-3), 0).lineTo(pt(3), 0);
  doc.moveTo(0, pt(-5)).lineTo(0, pt(5));
  for (let mm = -4; mm <= 4; mm++) {
    if (mm !== 0) doc.moveTo(pt(-0.55), pt(mm)).lineTo(pt(0.55), pt(mm));
  }
  for (const mm of [-2, -1, 1, 2]) {
    doc.moveTo(pt(mm), pt(-0.55)).lineTo(pt(mm), pt(0.55));
  }
  doc.stroke().restore();
}

export async function renderParticipantCards(cards: readonly PrintableCard[], origin: string, mode: PrintMode, layout: CardPrintLayout = "card", templateType = "zombie") {
  const a4 = layout !== "card";
  const calibrated = layout === "a4-calibrated";
  const sheetLayout = calibrated ? calibratedCardSheet : cardSheet;
  const page = a4 ? sheetLayout : cardLayout;
  const doc = new PDFDocument({ pdfVersion: "1.7", size: [pt(page.width), pt(page.height)], margin: 0, autoFirstPage: false });
  // PDFKit serializes and closes this catalog reference when the document ends.
  const { _root } = doc as PDFKit.PDFDocument & { _root: { data: { ViewerPreferences?: PDFKit.PDFKitReference } } };
  _root.data.ViewerPreferences = doc.ref({
    PrintScaling: "None",
    ...(a4 && mode === "complete" && { Duplex: "DuplexFlipLongEdge" }),
  });
  const parts: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => parts.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(parts)));
  });
  const sides = mode === "complete" ? ["front", "back"] as const : [mode];
  const capacity = a4 ? sheetLayout.capacity : 1;
  const entries = cards.length ? cards : Array.from({ length: capacity }, () => undefined);
  const recoveryUrl = new URL(souvenirRecoveryPath, origin).href;
  const qrOptions = { width: 360, margin: 4, errorCorrectionLevel: "M" } as const;
  const recoveryQr = cards.length ? undefined : await QRCode.toBuffer(recoveryUrl, qrOptions);
  try {
    const artworkNames = mode === "complete" || !cards.length
      ? new Set(entries.flatMap(card => cardTheme(card?.type ?? templateType).artwork ?? []))
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
        if (a4) alignmentMark(doc, side, calibrated);
        for (let index = 0; index < sheet.length; index++) {
          const card = sheet[index];
          doc.save();
          if (a4) {
            const { x, y } = cardSheetPosition(index, side, calibrated);
            doc.translate(pt(x), pt(y));
          }
          if (mode === "complete" || !card) {
            const type = card?.type ?? templateType;
            const theme = cardTheme(type);
            template(doc, side, theme, a4 ? a4CardBleed : { x: 0, y: 0 }, !card, type,
              theme.artwork ? artworkByName.get(theme.artwork) : undefined);
            if (a4) trimMarks(doc);
          }
          if (side === "front") {
            if (card) printName(doc, printedCardName(card));
            if (mode === "complete" && card) {
              const field = cardScheduleFields(card.type).find(field => field.key === "briefing");
              const time = cardBriefingTime(card.briefingTime);
              if (field && time) doc.fillColor("#101828").font("CardBold").fontSize(9)
                .text(time, pt(field.x), pt(scheduleY + 4.1), { width: pt(field.width), align: "center", lineBreak: false });
            }
            const url = card ? new URL(`${souvenirPath}/${card.token}`, origin).href : recoveryUrl;
            const qr = recoveryQr ?? await QRCode.toBuffer(url, qrOptions);
            if (mode === "complete" || !card) printCardLink(doc, url);
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

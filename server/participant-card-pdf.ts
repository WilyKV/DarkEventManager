import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { souvenirPath, type PrintableCard } from "@shared/participant-card";

export const printModes = ["complete", "front", "back"] as const;
export type PrintMode = typeof printModes[number];
const pt = (mm: number) => mm * 72 / 25.4;
const accents: Record<string, string> = { zombie: "#941c32", survivant: "#17558d", staff: "#176246" };

function template(doc: PDFKit.PDFDocument, side: "front" | "back", accent: string) {
  doc.rect(0, 0, pt(85), pt(55)).fill("#ffffff");
  doc.rect(pt(3), pt(3), pt(79), pt(2)).fill(accent);
  doc.fillColor("#172033").font("Helvetica-Bold").fontSize(9)
    .text("ZOMB’IN THE DARK", pt(6), pt(8), { lineBreak: false });
  if (side === "front") {
    doc.roundedRect(pt(55), pt(13), pt(24), pt(24), pt(2)).lineWidth(0.6).stroke("#d2d7e1");
    doc.fillColor("#384458").font("Helvetica").fontSize(7)
      .text("Mon espace souvenir", pt(51), pt(39), { width: pt(32), align: "center" });
    doc.rect(pt(6), pt(44), pt(4), pt(4)).stroke("#172033");
    doc.font("Helvetica-Bold").fontSize(8).text("Repas", pt(12), pt(45), { lineBreak: false });
    doc.font("Helvetica").text("N° de passage", pt(28), pt(45), { lineBreak: false });
    doc.moveTo(pt(48), pt(48)).lineTo(pt(62), pt(48)).stroke("#8793a7");
  } else {
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(12)
      .text("CODE D’ACCÈS", pt(6), pt(17), { width: pt(73), align: "center" });
    doc.roundedRect(pt(13), pt(24), pt(59), pt(11), pt(2)).stroke("#8793a7");
    doc.fillColor("#384458").font("Helvetica").fontSize(8).text(
      "Scannez le QR au recto, puis saisissez ce code.\nEspace disponible jusqu’à 3 mois après la clôture.",
      pt(5), pt(40), { width: pt(75), align: "center", lineGap: 2 });
  }
}

function printName(doc: PDFKit.PDFDocument, name: string, y: number) {
  let size = 15;
  doc.font("Helvetica-Bold").fontSize(size);
  while (size > 8 && doc.widthOfString(name) > pt(46)) doc.fontSize(--size);
  doc.fillColor("#101828").text(name, pt(6), pt(y), { width: pt(46), height: pt(12), ellipsis: true });
}

export async function renderParticipantCards(cards: readonly PrintableCard[], origin: string, mode: PrintMode) {
  const doc = new PDFDocument({ size: [pt(85), pt(55)], margin: 0, autoFirstPage: false });
  const parts: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => parts.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(parts)));
  });
  const sides = mode === "complete" ? ["front", "back"] as const : [mode];
  const entries = cards.length ? cards : [undefined];
  try {
    for (const card of entries) {
      const accent = accents[card?.type ?? "zombie"] ?? accents.zombie;
      for (const side of sides) {
        doc.addPage();
        if (mode === "complete" || !card) template(doc, side, accent);
        if (!card) continue;
        if (side === "front") {
          printName(doc, card.firstName, 18);
          printName(doc, card.lastName, 29);
          const url = new URL(`${souvenirPath}/${card.token}`, origin).href;
          const qr = await QRCode.toBuffer(url, { width: 360, margin: 4, errorCorrectionLevel: "M" });
          doc.image(qr, pt(55.5), pt(13.5), { width: pt(23), height: pt(23) });
        } else {
          const code = `${card.code.slice(0, 5)} ${card.code.slice(5)}`;
          doc.fillColor("#101828").font("Courier-Bold").fontSize(16);
          doc.text(code, (pt(85) - doc.widthOfString(code)) / 2, pt(27), { lineBreak: false });
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

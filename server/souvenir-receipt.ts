import PDFDocument from "pdfkit";
import type { SouvenirSummary } from "@shared/participant-card";

const formatEuro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;

export function renderSouvenirReceipt(summary: SouvenirSummary): Promise<Buffer> {
  const lines = summary.purchases?.lines.filter(line => line.paid) ?? [];
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(22).fillColor("#171019").text("Zomb’in The Dark");
  doc.fontSize(16).text("Relevé des achats réglés");
  doc.moveDown().font("Helvetica").fontSize(11).text(`${summary.firstName} ${summary.lastName}`);
  if (summary.eventDay) doc.text(`Événement du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(summary.eventDay))}`);
  for (const category of ["boutique", "repas"] as const) {
    const entries = lines.filter(line => line.category === category);
    if (!entries.length) continue;
    doc.moveDown().font("Helvetica-Bold").fontSize(13).text(category === "boutique" ? "Boutique" : "Repas");
    doc.font("Helvetica").fontSize(11);
    for (const line of entries) {
      doc.text(`${line.quantity} × ${line.name} · ${formatEuro(line.unitCents)} / unité · ${formatEuro(line.totalCents)}`, { paragraphGap: 5 });
    }
  }
  doc.moveDown().font("Helvetica-Bold").fontSize(14).text(`Total payé  ${formatEuro(lines.reduce((sum, line) => sum + line.totalCents, 0))}`);
  doc.moveDown().font("Helvetica").fontSize(9).text("Récapitulatif des achats enregistrés pendant l’événement.");
  doc.end();
  return output;
}

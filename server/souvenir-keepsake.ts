import PDFDocument from "pdfkit";
import type { SouvenirSummary } from "@shared/participant-card";
import type { EventReview, KeepsakeSection } from "@shared/souvenir-engagement";

export function renderSouvenirKeepsake(summary: SouvenirSummary, sections: Set<KeepsakeSection>, photo: string | null, review?: EventReview) {
  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "Souvenir · Zomb’in The Dark" } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk));
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);
  });
  const accent = summary.type === "staff" ? "#155e52" : summary.type === "survivant" ? "#204478" : "#9d2343";
  const width = doc.page.width - 100;

  doc.roundedRect(50, 50, width, 102, 14).fill(accent);
  doc.fillColor("#fff4ea").font("Helvetica-Bold").fontSize(26).text("ZOMB’IN THE DARK", 70, 74);
  doc.font("Helvetica").fontSize(13).text("Carnet souvenir", 70, 112);
  doc.x = 50;
  doc.y = 177;

  function title(text: string) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.moveDown(0.65).fillColor(accent).font("Helvetica-Bold").fontSize(16).text(text);
    doc.moveDown(0.25).fillColor("#251f29").font("Helvetica").fontSize(11);
  }
  if (sections.has("identity")) {
    title("Votre profil");
    doc.text(`${summary.firstName} ${summary.lastName}`);
    doc.text(({ zombie: "Zombie", survivant: "Survivant", staff: "Staff" } as Record<string, string>)[summary.type] ?? summary.type);
  }
  if (sections.has("photo") && photo) {
    if (doc.y > doc.page.height - 340) doc.addPage();
    title("Votre photo");
    const y = doc.y;
    doc.image(Buffer.from(photo, "base64"), 50, y, { fit: [width, 245], align: "center", valign: "center" });
    doc.y = y + 251;
  }
  if (sections.has("participation")) {
    title("Votre participation");
    if (summary.wave) doc.text(`${summary.type === "staff" ? "Attribution" : "Vague"} · ${summary.wave}`);
    if (summary.type !== "staff" && summary.squad !== null) doc.text(`${summary.type === "zombie" ? "Squad" : "Équipe"} n° ${summary.squad}`);
    if (summary.type !== "staff" && summary.squadSize) doc.text(`${summary.squadSize} membre(s)`);
    if (summary.arrivedAt) doc.text(`Arrivée · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(summary.arrivedAt))}`);
    if (summary.type !== "staff" && summary.gameStart) doc.text(`Début du jeu · ${summary.gameStart}`);
    if (summary.gameEnd) doc.text(`${summary.type === "staff" ? "Fin de l’attribution" : "Fin du jeu"} · ${summary.gameEnd}`);
  }
  if (sections.has("purchases") && summary.purchases) {
    title("Repas et achats");
    doc.text(summary.purchases.freeMealClaimed ? "Repas offert enregistré comme pris." : "Aucun repas offert enregistré comme pris.");
    for (const line of summary.purchases.lines) {
      doc.text(`${line.quantity} × ${line.name} · ${(line.totalCents / 100).toFixed(2).replace(".", ",")} EUR · ${line.paid ? "Réglé" : "Non réglé"}`);
    }
  }
  if (sections.has("review") && review) {
    title("Votre avis");
    doc.text(`${String(review.halfStars / 2).replace(".", ",")} / 5`);
    if (review.comment) doc.text(review.comment);
  }
  if (sections.has("event")) {
    title("La soirée");
    if (summary.eventDay) doc.text(new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(summary.eventDay)));
    if (summary.highlights) doc.text(`${summary.highlights.zombies} zombies · ${summary.highlights.survivors} survivants`);
  }
  doc.end();
  return done;
}

import { jsPDF } from "jspdf";

export function generateReportPdf(title: string, headers: string[], rows: Array<Array<string | number>>) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = 277 / headers.length;
  let y = 28;
  const heading = () => { doc.setFontSize(14); doc.text(title, 10, 12); doc.setFontSize(7); headers.forEach((value, i) => doc.text(doc.splitTextToSize(value, width - 2), 10 + i * width, 21)); };
  heading();
  for (const row of rows) {
    const cells = row.map(value => doc.splitTextToSize(String(value ?? ""), width - 2));
    const height = Math.max(...cells.map(cell => cell.length), 1) * 3.2 + 3;
    if (y + height > 195) { doc.addPage(); heading(); y = 28; }
    cells.forEach((cell, i) => doc.text(cell, 10 + i * width, y)); y += height;
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

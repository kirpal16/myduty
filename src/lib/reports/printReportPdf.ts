"use client";

import type { PrintOfficer, PrintReport } from "./printReport";

/**
 * The same printed report as a PDF, for the one place `window.print()` does
 * not work: an app added to an iPhone's home screen. The PDF is handed to the
 * iOS Share sheet (Print / Save to Files), so the officer never leaves the app.
 * Laid out to match the printed page: letterhead, title, officer details box,
 * then the table.
 *
 * jsPDF is loaded on demand and only on that platform — nobody else's bundle
 * carries it. `preloadPdfLib()` warms it (and the logo) up ahead of the tap,
 * so the share still happens inside the tap's user gesture, which iOS requires.
 */

type PdfLib = {
  jsPDF: typeof import("jspdf").jsPDF;
  autoTable: typeof import("jspdf-autotable").default;
  /** The letterhead logo as a data URL, or null if it could not be loaded. */
  logo: string | null;
};

let libPromise: Promise<PdfLib> | null = null;

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/Gujarat-police.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function preloadPdfLib(): Promise<PdfLib> {
  libPromise ??= Promise.all([import("jspdf"), import("jspdf-autotable"), loadLogo()]).then(
    ([pdf, table, logo]) => ({ jsPDF: pdf.jsPDF, autoTable: table.default, logo }),
  );
  return libPromise;
}

// The PDF's built-in font has no arrow glyph; everything else is plain Latin.
const pdfText = (s: string) => s.replace(/→/g, "->");

export async function buildReportPdf(
  report: PrintReport,
  officer: PrintOfficer | null,
): Promise<Blob> {
  const { jsPDF, autoTable, logo } = await preloadPdfLib();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 14;
  const right = pageW - 14;

  // Letterhead: logo, organisation, period.
  let y = 14;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", left, y - 2, 16, 16);
    } catch {
      // A logo that will not embed is not worth failing the report over.
    }
  }
  const textLeft = logo ? left + 20 : left;
  doc.setFont("times", "bold");
  doc.setFontSize(17);
  doc.text("GUJARAT POLICE", textLeft, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pdfText(officer?.department ?? "Duty & Roster Records"), textLeft, y + 10.5);

  doc.setFontSize(8);
  doc.text("REPORT PERIOD", right, y + 3, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText(report.periodLabel), right, y + 8.5, { align: "right" });

  // Double rule under the letterhead.
  y += 17;
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  doc.setLineWidth(0.2);
  doc.line(left, y + 1, right, y + 1);

  // Title, underlined.
  y += 10;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  const title = report.title.toUpperCase();
  doc.text(title, pageW / 2, y, { align: "center" });
  const titleW = doc.getTextWidth(title);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - titleW / 2, y + 1.2, pageW / 2 + titleW / 2, y + 1.2);

  // Officer details box, two columns.
  const details: [string, string][] = officer
    ? [
        ["Officer Name", officer.name],
        ["Post", officer.post ?? "—"],
        ...(officer.department ? ([["Department", officer.department]] as [string, string][]) : []),
        ...(officer.employeeCode ? ([["Employee Code", officer.employeeCode]] as [string, string][]) : []),
        ...(officer.posting ? ([["Posting", officer.posting]] as [string, string][]) : []),
        ["Report Month", report.periodLabel],
      ]
    : [
        ["Officers", "All Officers"],
        ["Report Month", report.periodLabel],
      ];
  y += 7;
  const rowsInBox = Math.ceil(details.length / 2);
  const boxH = rowsInBox * 6 + 4;
  doc.setLineWidth(0.3);
  doc.rect(left, y, right - left, boxH);
  const colW = (right - left) / 2;
  doc.setFontSize(10);
  details.forEach(([label, value], i) => {
    const cx = left + 4 + (i % 2) * colW;
    const cy = y + 6 + Math.floor(i / 2) * 6;
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, cx, cy);
    doc.setFont("helvetica", "normal");
    doc.text(pdfText(value), cx + 30, cy, { maxWidth: colW - 36 });
  });
  y += boxH + 6;

  autoTable(doc, {
    startY: y,
    head: [["#", ...report.columns.map((c) => pdfText(c.label).toUpperCase())]],
    body: report.rows.map((row, i) => [
      String(i + 1),
      ...report.columns.map((c) => pdfText(row[c.key] ?? "—")),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8, textColor: 0, lineColor: [68, 68, 68], lineWidth: 0.2 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      ...Object.fromEntries(
        report.columns
          .map((c, i) => [i + 1, c.align === "right" ? { halign: "right" as const } : null] as const)
          .filter(([, s]) => s !== null),
      ),
    },
    margin: { left, right: 14, top: 14, bottom: 14 },
  });

  return doc.output("blob");
}

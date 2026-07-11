/**
 * Server-only file parsing for the Import wizard. Excel and CSV parse to
 * structured rows deterministically (no AI needed — spreadsheets already
 * have columns). Word and PDF only yield raw text — turning that into
 * structured rows is Luv's job (see lib/luv/import-assist.ts), not this
 * module's (Vendor Management — Next Iteration, 2026-07-10).
 */
import ExcelJS from "exceljs";

export type ParsedTable = { headers: string[]; rows: Record<string, string>[] };

export async function parseExcelFile(buffer: Buffer): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, i) => {
      if (!header) return;
      const cell = row.getCell(i + 1);
      const value = cell.value == null ? "" : String(cell.text ?? cell.value).trim();
      record[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows };
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Server-only file parsing for the Import wizard. Excel and CSV parse to
 * structured rows deterministically (no AI needed — spreadsheets already
 * have columns). Word and PDF only yield raw text — turning that into
 * structured rows is Luv's job (see lib/luv/import-assist.ts), not this
 * module's (Vendor Management — Next Iteration, 2026-07-10).
 */
import ExcelJS from "exceljs";

export type ParsedTable = { headers: string[]; rows: Record<string, string>[] };

// Every date field this app imports (Event Date, Inquiry Date, etc.) is a
// plain calendar date, never a date+time — format with UTC getters, not
// toISOString()/toString(), so a date typed in Excel never shifts a day
// depending on the server's local timezone, and never renders as the raw
// `Date.toString()` blob ("Fri Oct 23 2026 20:00:00 GMT-0400 (Eastern...)").
function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value == null) return "";
  if (cell.value instanceof Date) {
    const d = cell.value;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(cell.text ?? cell.value).trim();
}

export async function parseExcelFile(buffer: Buffer): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    // Same stringification as data cells — a hyperlink-type header cell
    // used to render as the literal text "[object Object]".
    headers[colNumber - 1] = cellToString(cell);
  });

  const rows: Record<string, string>[] = [];
  // includeEmpty: true — without it, ExcelJS's default eachRow only visits
  // rows its internal model considers to have a populated cell, which some
  // spreadsheet tools' export quirks (styling-only cells, sparse writes)
  // can cause it to misjudge, silently dropping otherwise-real data rows.
  // Iterating every row up to the sheet's own row count and checking for
  // real content ourselves (via hasValue below) is the robust version of
  // the same "skip blank rows" intent.
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, i) => {
      if (!header) return;
      const cell = row.getCell(i + 1);
      const value = cellToString(cell);
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

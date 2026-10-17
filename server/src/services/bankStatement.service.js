import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";
import * as mupdf from "mupdf";

const require = createRequire(import.meta.url);
const PDFJS = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");

/* ============================================================
   HEADER AND FIELD ALIASES
   ============================================================ */

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const headerAliases = {
  transactionDate: [
    "date", "transactiondate", "transactiondatetime",
    "valuedate", "valuedatetime", "postingdate", "txndate",
  ],
  transactionReference: [
    "reference", "ref", "referencenumber", "refnumber",
    "transactionreference", "transactionref",
    "transactionid", "transactionnumber", "transactionno",
    "txnreference", "txnref", "txnid", "rrn", "bankreference",
    "authcode", "authc", "chqno", "chequeno",
  ],
  senderName: [
    "sender", "sendername", "payer", "payername",
    "customername", "originator", "originatorname", "fromname",
    "senderna",
  ],
  senderAccount: [
    "senderaccount", "senderaccountnumber", "payeraccount",
    "fromaccount", "debitaccount", "senderacc",
  ],
  receiverName: [
    "receiver", "receivername", "beneficiary",
    "beneficiaryname", "recipient", "recipientname", "toname",
  ],
  receiverAccount: [
    "receiveraccount", "receiveraccountnumber",
    "beneficiaryaccount", "toaccount", "creditaccount", "receiveracc",
  ],
  type: [
    "type", "txntype", "crdr", "drcr", "trxtype", "entrytype",
  ],
  debit: [
    "debit", "debitamount", "withdraw", "withdrawal", "dr",
  ],
  credit: [
    "credit", "creditamount", "deposit", "depositamount", "cr", "paidamount",
  ],
  amount: [
    "amount", "transactionamount", "netamount",
  ],
  balance: [
    "balance", "runningbalance", "closingbalance", "ledgerbalance", "bal",
  ],
  description: [
    "description", "narration", "details",
    "transactiondetails", "particulars", "remarks", "remark", "category",
  ],
};

function getFieldKey(header) {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(headerAliases)) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

function mapHeaders(headers) {
  const columns = {};
  headers.forEach((header, index) => {
    const field = getFieldKey(header);
    if (field && columns[field] === undefined) {
      columns[field] = index;
    }
  });
  return columns;
}

function isValidHeader(columns) {
  return (
    columns.transactionDate !== undefined &&
    (columns.amount !== undefined ||
      columns.credit !== undefined ||
      columns.debit !== undefined)
  );
}

/* ============================================================
   DATE & AMOUNT NORMALIZERS
   ============================================================ */

const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function parseDate(value, context = {}) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && value > 20000 && value < 100000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const m = String(parsed.m).padStart(2, "0");
    const d = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${m}-${d}`;
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();

  // YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // DD-Mon-YYYY or Mon DD, YYYY
  const textMonthMatch = text.match(/\b(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})\b/);
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, "0");
    const mNum = MONTH_NAMES[textMonthMatch[2].toLowerCase()];
    if (mNum) {
      const m = String(mNum).padStart(2, "0");
      return `${textMonthMatch[3]}-${m}-${d}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const localMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (localMatch) {
    const first = Number(localMatch[1]);
    const second = Number(localMatch[2]);
    const year = localMatch[3];

    // Standard Ethiopian / International banking: DD/MM/YYYY
    let day = first;
    let month = second;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Truncated date with day ellipsis like "2026-10-..." or OCR variant "202610."
  const truncMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/]\.{1,}/);
  if (truncMatch) {
    const year = truncMatch[1];
    const month = truncMatch[2].padStart(2, "0");
    let day = "01";
    if (context.rowIndex && context.rowIndex >= 1 && context.rowIndex <= 31) {
      day = String(context.rowIndex).padStart(2, "0");
    }
    return `${year}-${month}-${day}`;
  }

  // OCR date without separator e.g. "202610." or "202610"
  const ocrDateMatch = text.match(/\b(20\d{2})[-/.\s]?(0[1-9]|1[0-2])(?:[-/.\s]?(\d{1,2}|\.{1,3}))?/);
  if (ocrDateMatch) {
    const year = ocrDateMatch[1];
    const month = ocrDateMatch[2].padStart(2, "0");
    let day = ocrDateMatch[3] && /^\d{1,2}$/.test(ocrDateMatch[3])
      ? ocrDateMatch[3].padStart(2, "0")
      : context.rowIndex && context.rowIndex >= 1 && context.rowIndex <= 31
      ? String(context.rowIndex).padStart(2, "0")
      : "01";
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.abs(value) : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  let text = value.trim();
  // Strip currency symbols ($ € £ ETB Birr USD etc)
  text = text.replace(/(?:ETB|BIRR|USD|EUR|GBP|\$|€|£)/gi, "").trim();

  // Negative indicator: (100.00) or -100.00
  const isNegative = /^\(.*\)$/.test(text) || text.startsWith("-");

  // Remove commas, spaces, trailing ellipsis
  text = text.replace(/,/g, "").replace(/\.{2,}/g, "").replace(/[^0-9.-]/g, "").trim();
  if (!text || !/\d/.test(text)) return null;

  const num = parseFloat(text);
  if (!Number.isFinite(num)) return null;

  return Math.abs(num);
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function detectCurrency(text) {
  if (/USD|\$/i.test(text)) return "USD";
  if (/EUR|€/i.test(text)) return "EUR";
  if (/GBP|£/i.test(text)) return "GBP";
  return "ETB";
}

/* ============================================================
   LAYOUT-AWARE PDF EXTRACTION (TIER 1)
   ============================================================ */

async function extractPdfSpatial(buffer) {
  const doc = await PDFJS.getDocument(buffer);
  const totalPages = doc.numPages;

  let allLines = [];
  let rawTextAccumulator = "";
  let detectedCurrency = "ETB";
  let statementPeriod = null;
  let bankNameCandidate = null;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items || [];

    // Bucket items by Y coordinate with baseline tolerance ±3.5pt
    const lineBuckets = [];
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = item.transform[5];
      const x = item.transform[4];
      let bucket = lineBuckets.find((b) => Math.abs(b.y - y) <= 3.5);
      if (!bucket) {
        bucket = { y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push({ x, str: item.str, width: item.width || 0 });
    }

    // Sort buckets top-to-bottom
    lineBuckets.sort((a, b) => b.y - a.y);

    for (const bucket of lineBuckets) {
      bucket.items.sort((a, b) => a.x - b.x);

      // Group into cells based on horizontal distance
      const cells = [];
      let currentCell = "";
      let lastX = null;
      let lastW = null;

      for (const it of bucket.items) {
        if (!it.str) continue;
        if (lastX !== null) {
          const gap = it.x - (lastX + lastW);
          if (gap > 7) {
            if (currentCell.trim()) cells.push(currentCell.trim());
            currentCell = it.str;
          } else if (gap > 1.8) {
            currentCell += " " + it.str;
          } else {
            currentCell += it.str;
          }
        } else {
          currentCell = it.str;
        }
        lastX = it.x;
        lastW = it.width;
      }
      if (currentCell.trim()) cells.push(currentCell.trim());

      const fullText = cells.join("   ");
      rawTextAccumulator += fullText + "\n";
      allLines.push({ pageNum, y: bucket.y, cells, fullText });

      // Currency check
      if (/\$|USD/i.test(fullText)) detectedCurrency = "USD";
      else if (/EUR|€/i.test(fullText)) detectedCurrency = "EUR";
      else if (/ETB|BIRR/i.test(fullText)) detectedCurrency = "ETB";

      // Bank name check
      if (!bankNameCandidate) {
        const bankMatch = fullText.match(
          /\b([A-Za-z\s&.-]{3,40}\s+BANK|BANK\s+OF\s+[A-Za-z\s&.-]{3,30}|CBE|TELEBIRR)\b/i
        );
        if (bankMatch) bankNameCandidate = bankMatch[1].trim();
      }

      // Period check
      if (!statementPeriod) {
        const pMatch = fullText.match(
          /(?:statement\s+period|period)\s*[:\-]?\s*([A-Za-z0-9\s,\-_/]+)/i
        );
        if (pMatch) statementPeriod = pMatch[1].trim();
      }
    }
  }

  // Parse transaction rows from structured lines
  const transactions = [];
  let skippedRows = 0;

  for (let idx = 0; idx < allLines.length; idx++) {
    const { cells, fullText } = allLines[idx];

    // Ignore known non-transaction lines
    if (
      /statement\s+period|swift\s+code|account\s+holder|account\s+no|page\s+\d+\s+of\s+\d+|official\s+account\s+statement|corporate\s+&\s+financial/i.test(
        fullText
      )
    ) {
      continue;
    }
    // Ignore header lines
    if (/^\s*#?\s*(?:txn\s+date|date|transaction\s+date)\b/i.test(fullText)) {
      continue;
    }

    // Check for row index like "01" or "1"
    const rowIdxMatch = fullText.match(/^\s*0?(\d{1,3})\b/);
    const rowIndex = rowIdxMatch ? parseInt(rowIdxMatch[1], 10) : null;

    // Check for date
    const dateStr = parseDate(fullText, { rowIndex });
    const isTruncatedDate = /\b\d{4}[-/]\d{1,2}[-/]\.{2,}/.test(fullText);

    // Look for monetary amounts (with currency symbol or decimal / thousands separator)
    const amountMatches =
      fullText.match(
        /(?:[$€£]|ETB|BIRR|USD|EUR)\s*\(?-?\d[\d,]*(?:\.\d+|\.{2,})?\)?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d+\.\d{2}\b/gi
      ) || [];
    const parsedAmounts = amountMatches
      .map(parseAmount)
      .filter((v) => v !== null && v > 0);

    if (!dateStr || parsedAmounts.length === 0) {
      continue;
    }

    // Look for reference: e.g. TXN-902183, REF123456, FT24..., 10-20 char alphanumeric
    let reference = null;
    const refMatch = fullText.match(
      /\b(TXN-[A-Za-z0-9_-]+|REF-[A-Za-z0-9_-]+|FT\d{10,20}[A-Za-z0-9]*|[A-Z]{2,4}\d{6,20})\b/i
    );
    if (refMatch) {
      reference = refMatch[1].trim();
    } else {
      // Look for long numeric reference/account or alphanumeric code
      const candidateRefs = fullText.match(/\b[A-Za-z0-9]{8,25}\b/g) || [];
      for (const cand of candidateRefs) {
        if (!/^(COMPLETED|PENDING|PAYROLL|UTILITIES|SOFTWARE|SUPPLIES|INVESTMENT|STATEMENT|FINANCIAL)$/i.test(cand)) {
          if (/[A-Za-z]/.test(cand) && /\d/.test(cand)) {
            reference = cand;
            break;
          }
        }
      }
    }

    // Determine Debit / Credit
    const isDebit =
      /\b(DR|DEBIT|WITHDRAWAL|PAYMENT)\b/i.test(fullText) &&
      !/\b(CR\b|CREDIT|DEPOSIT)/i.test(fullText);
    const isCredit =
      /\b(CR|CREDIT|DEPOSIT)\b/i.test(fullText) || !isDebit;

    // Transaction amount is usually the first monetary figure on the line
    const txAmount = parsedAmounts[0] || 0;
    // Balance is usually the last large monetary figure
    const balance =
      parsedAmounts.length >= 2 ? parsedAmounts[parsedAmounts.length - 1] : null;

    const warnings = [];
    let confidence = 0.95;

    if (isTruncatedDate) {
      warnings.push(`Day was truncated in PDF statement; inferred ${dateStr} from row index.`);
      confidence -= 0.08;
    }
    if (!reference) {
      warnings.push("No transaction reference extracted; requires manual review.");
      confidence -= 0.15;
    }
    if (txAmount <= 0) {
      warnings.push("Amount could not be extracted confidently.");
      confidence -= 0.25;
    }

    // Extract sender & receiver details from cells
    let senderName = null;
    let senderAccount = null;
    let receiverName = null;
    let receiverAccount = null;

    for (const cell of cells) {
      if (/^\d{8,16}$/.test(cell)) {
        if (!senderAccount) senderAccount = cell;
        else if (!receiverAccount) receiverAccount = cell;
      }
    }

    transactions.push({
      tempId: `row-${transactions.length + 1}`,
      rowIndex,
      transactionDate: dateStr,
      reference,
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      debit: isDebit ? txAmount : 0,
      credit: isCredit ? txAmount : 0,
      amount: txAmount,
      balance,
      currency: detectedCurrency,
      confidence: Math.round(confidence * 100) / 100,
      needsReview: warnings.length > 0 || confidence < 0.9,
      warnings,
      description: cleanText(cells.slice(2).join(" ")) || cleanText(fullText),
    });
  }

  return {
    transactions,
    skippedRows,
    totalRows: transactions.length + skippedRows,
    rawText: rawTextAccumulator,
    currency: detectedCurrency,
    bankName: bankNameCandidate,
  };
}

/* ============================================================
   OCR FALLBACK VIA MUPDF + TESSERACT (TIER 3)
   ============================================================ */

let ocrWorkerInstance = null;

async function getOcrWorker() {
  if (!ocrWorkerInstance) {
    ocrWorkerInstance = await createWorker("eng");
  }
  return ocrWorkerInstance;
}

export async function extractPdfOcr(buffer) {
  let doc;
  try {
    doc = mupdf.Document.openDocument(buffer, "application/pdf");
  } catch (err) {
    if (/password/i.test(err.message)) {
      throw new Error("The PDF is password-protected or encrypted. Please upload an unencrypted bank statement.");
    }
    throw new Error(`Failed to read PDF for OCR: ${err.message}`);
  }

  const pageCount = Math.min(doc.countPages(), 15);
  const worker = await getOcrWorker();

  let combinedOcrText = "";
  let totalConfidence = 0;
  let ocrPagesCount = 0;

  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    const page = doc.loadPage(pageIdx);
    // Render at 2.0x scale (144 DPI)
    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
    const pngBuffer = Buffer.from(pixmap.asPNG());

    const result = await worker.recognize(pngBuffer);
    const pageText = result.data.text || "";
    const pageConf = result.data.confidence || 0;

    combinedOcrText += pageText + "\n";
    totalConfidence += pageConf;
    ocrPagesCount++;
  }

  const avgOcrConfidence = ocrPagesCount > 0 ? totalConfidence / ocrPagesCount : 0;
  const lines = combinedOcrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const transactions = [];
  const detectedCurrency = detectCurrency(combinedOcrText);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Skip headers and non-transaction lines
    if (
      /statement\s+period|swift\s+code|account\s+holder|page\s+\d+|official\s+account/i.test(
        line
      )
    ) {
      continue;
    }

    // Look for row index or date
    const rowIdxMatch = line.match(/^\s*0?(\d{1,3})\b/);
    const rowIndex = rowIdxMatch ? parseInt(rowIdxMatch[1], 10) : null;

    const dateStr = parseDate(line, { rowIndex });
    const isTruncatedDate = /\b\d{4}[-/]\d{1,2}[-/]\.{2,}/.test(line);

    const amountMatches =
      line.match(
        /(?:[$€£]|ETB|BIRR|USD|EUR)\s*\(?-?\d[\d,]*(?:\.\d+|\.{1,3})?\)?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d+\.\d{2}\b/gi
      ) || [];
    const parsedAmounts = amountMatches
      .map(parseAmount)
      .filter((v) => v !== null && v > 0);

    if (!dateStr || parsedAmounts.length === 0) {
      continue;
    }

    let reference = null;
    const refMatch = line.match(
      /\b(TXN-[A-Za-z0-9_-]+|REF-[A-Za-z0-9_-]+|FT\d{10,20}[A-Za-z0-9]*|[A-Z]{2,4}\d{6,20})\b/i
    );
    if (refMatch) {
      reference = refMatch[1].trim();
    } else {
      const candidates = line.match(/\b[A-Za-z0-9]{8,25}\b/g) || [];
      for (const cand of candidates) {
        if (!/^(COMPLETED|PENDING|PAYROLL|UTILITIES|SOFTWARE|SUPPLIES|INVESTMENT)$/i.test(cand)) {
          if (/[A-Za-z]/.test(cand) && /\d/.test(cand)) {
            reference = cand;
            break;
          }
        }
      }
    }

    const isDebit =
      /\b(DR|DEBIT)\b/i.test(line) && !/\b(CR\b|CREDIT)/i.test(line);
    const isCredit = /\b(CR|CREDIT)\b/i.test(line) || !isDebit;

    const txAmount = parsedAmounts[0] || 0;
    const balance =
      parsedAmounts.length >= 2 ? parsedAmounts[parsedAmounts.length - 1] : null;

    const warnings = [];
    let confidence = Math.min(0.85, (avgOcrConfidence / 100) * 0.95);

    warnings.push("Extracted via Optical Character Recognition (OCR). Verify details before approval.");
    if (isTruncatedDate) {
      warnings.push(`Day inferred (${dateStr}) from row #${rowIndex}.`);
      confidence -= 0.08;
    }
    if (!reference) {
      warnings.push("No reference found by OCR.");
      confidence -= 0.15;
    }

    transactions.push({
      tempId: `ocr-row-${transactions.length + 1}`,
      rowIndex,
      transactionDate: dateStr,
      reference,
      senderName: null,
      senderAccount: null,
      receiverName: null,
      receiverAccount: null,
      debit: isDebit ? txAmount : 0,
      credit: isCredit ? txAmount : 0,
      amount: txAmount,
      balance,
      currency: detectedCurrency,
      confidence: Math.round(confidence * 100) / 100,
      needsReview: true,
      warnings,
      description: cleanText(line),
    });
  }

  return {
    transactions,
    skippedRows: 0,
    totalRows: transactions.length,
    rawText: combinedOcrText,
    currency: detectedCurrency,
    avgOcrConfidence,
  };
}

/* ============================================================
   EXCEL & CSV EXTRACTION (TIER 4)
   ============================================================ */

function extractExcel(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  if (!workbook.SheetNames.length) {
    throw new Error("The Excel file does not contain a worksheet.");
  }

  let headerIndex = -1;
  let columns = {};
  let selectedRows = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,
      defval: "",
    });

    for (let index = 0; index < Math.min(rows.length, 30); index++) {
      const candidate = mapHeaders(rows[index]);
      if (isValidHeader(candidate)) {
        headerIndex = index;
        columns = candidate;
        selectedRows = rows;
        break;
      }
    }
    if (headerIndex !== -1) break;
  }

  if (headerIndex === -1) {
    throw new Error(
      "Could not identify date and amount columns. Check the Excel column headings."
    );
  }

  const transactions = [];
  let skippedRows = 0;
  let totalRows = 0;

  for (let index = headerIndex + 1; index < selectedRows.length; index++) {
    const row = selectedRows[index];
    if (!row.some((value) => String(value ?? "").trim())) continue;
    if (isValidHeader(mapHeaders(row))) continue;

    totalRows++;

    const dateVal = parseDate(row[columns.transactionDate]);
    const debitVal = columns.debit !== undefined ? parseAmount(row[columns.debit]) : null;
    const creditVal = columns.credit !== undefined ? parseAmount(row[columns.credit]) : null;
    const amountVal = columns.amount !== undefined ? parseAmount(row[columns.amount]) : null;

    let debit = debitVal || 0;
    let credit = creditVal || 0;
    let amount = amountVal || credit || debit || 0;

    if (creditVal && !debitVal && !amountVal) amount = creditVal;
    else if (debitVal && !creditVal && !amountVal) amount = debitVal;

    if (!dateVal || amount <= 0) {
      skippedRows++;
      continue;
    }

    const reference =
      columns.transactionReference !== undefined
        ? cleanText(row[columns.transactionReference])
        : null;

    const balance =
      columns.balance !== undefined
        ? parseAmount(row[columns.balance])
        : null;

    const warnings = [];
    if (!reference) warnings.push("No transaction reference in spreadsheet.");

    transactions.push({
      tempId: `excel-row-${transactions.length + 1}`,
      transactionDate: dateVal,
      reference,
      senderName:
        columns.senderName !== undefined ? cleanText(row[columns.senderName]) : null,
      senderAccount:
        columns.senderAccount !== undefined ? cleanText(row[columns.senderAccount]) : null,
      receiverName:
        columns.receiverName !== undefined ? cleanText(row[columns.receiverName]) : null,
      receiverAccount:
        columns.receiverAccount !== undefined ? cleanText(row[columns.receiverAccount]) : null,
      debit,
      credit,
      amount,
      balance,
      currency: "ETB",
      confidence: reference ? 0.98 : 0.88,
      needsReview: warnings.length > 0,
      warnings,
      description:
        columns.description !== undefined ? cleanText(row[columns.description]) : null,
    });
  }

  return { transactions, skippedRows, totalRows, currency: "ETB" };
}

/* ============================================================
   MAIN ENTRY POINT: extractBankStatement
   ============================================================ */

export async function extractBankStatement(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = await fs.promises.readFile(filePath);

  if (extension === ".xlsx" || extension === ".xls" || extension === ".csv") {
    const result = extractExcel(buffer);
    return {
      ...result,
      extractionMethod: "excel-table",
    };
  }

  if (extension === ".pdf") {
    // Check if PDF is encrypted / corrupt before proceeding
    let textResult = null;
    try {
      textResult = await extractPdfSpatial(buffer);
    } catch (err) {
      if (/password|encrypted/i.test(err.message)) {
        throw new Error("The PDF is password-protected or encrypted. Please upload an unencrypted bank statement.");
      }
      console.warn("Spatial PDF parsing encountered an error, attempting OCR fallback:", err.message);
    }

    // If spatial parsing extracted valid transactions, return them immediately
    if (textResult && textResult.transactions && textResult.transactions.length > 0) {
      return {
        success: true,
        extractionMethod: "pdf-table",
        rowsFound: textResult.totalRows,
        currency: textResult.currency || "ETB",
        transactions: textResult.transactions,
        skippedRows: textResult.skippedRows || 0,
        rawTextPreview: textResult.rawText?.slice(0, 1500) || "",
      };
    }

    // If no transactions found or text is sparse, trigger OCR fallback!
    console.log("PDF text extraction found 0 transactions. Engaging OCR fallback via MuPDF + Tesseract...");

    try {
      const ocrResult = await extractPdfOcr(buffer);

      if (ocrResult.transactions && ocrResult.transactions.length > 0) {
        return {
          success: true,
          extractionMethod: "ocr",
          rowsFound: ocrResult.totalRows,
          currency: ocrResult.currency || "ETB",
          transactions: ocrResult.transactions,
          skippedRows: ocrResult.skippedRows || 0,
          rawTextPreview: ocrResult.rawText?.slice(0, 1500) || "",
          ocrConfidence: ocrResult.avgOcrConfidence,
        };
      }
    } catch (ocrErr) {
      console.error("OCR Fallback failed:", ocrErr.message);
      if (/password|encrypted/i.test(ocrErr.message)) {
        throw ocrErr;
      }
    }

    // Both text and OCR failed to find transactions in this document
    throw new Error(
      "No bank transactions could be identified in the uploaded document. Ensure the file is an official bank statement containing transaction dates and amounts."
    );
  }

  throw new Error("Unsupported bank statement file type. Please upload a PDF, XLS, or XLSX file.");
}

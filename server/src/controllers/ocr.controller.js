import fs from "fs";
import path from "path";

import prisma from "../config/database.js";
import { processReceiptOCR } from "../services/ocr.service.js";

/**
 * Try to extract a monetary amount from OCR text.
 *
 * Examples:
 * 12,600.00
 * 12,600
 * ETB 12,600.00
 * 12600.00
 */
const extractAmount = (text) => {
  if (!text) return null;

  const normalizedText = text.replace(/\s+/g, " ");

  const amountPatterns = [
    /(?:ETB|BIRR|AMOUNT|TOTAL)[^\d]{0,20}([\d,]+\.\d{2})/i,
    /([\d,]+\.\d{2})\s*(?:ETB|BIRR)/i,
    /([\d,]+\.\d{2})/,
  ];

  for (const pattern of amountPatterns) {
    const match = normalizedText.match(pattern);

    if (match?.[1]) {
      const amount = Number(match[1].replace(/,/g, ""));

      if (!Number.isNaN(amount)) {
        return amount;
      }
    }
  }

  return null;
};

/**
 * Extract bank name from OCR text.
 *
 * We deliberately avoid inventing a bank name.
 * If OCR gives a line containing BANK, we use that line.
 */
const extractBankName = (text) => {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const bankLine = lines.find((line) =>
    /\bBANK\b/i.test(line)
  );

  if (!bankLine) return null;

  return bankLine
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Extract sender name.
 *
 * Looks for patterns such as:
 * FROM AMANUEL SISAY
 * FROM: AMANUEL SISAY
 * SENDER: AMANUEL SISAY
 */
const extractSenderName = (text) => {
  if (!text) return null;

  const patterns = [
    /\bFROM\s*[:\-]?\s*([A-Z][A-Z\s.'-]{2,})/i,
    /\bSENDER\s*[:\-]?\s*([A-Z][A-Z\s.'-]{2,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanExtractedValue(match[1]);
    }
  }

  return null;
};

/**
 * Extract receiver name.
 *
 * Looks for:
 * TO ...
 * RECEIVER ...
 * BENEFICIARY ...
 */
const extractReceiverName = (text) => {
  if (!text) return null;

  const patterns = [
    /\bTO\s*[:\-]?\s*([A-Z][A-Z\s.'-]{2,})/i,
    /\bRECEIVER\s*[:\-]?\s*([A-Z][A-Z\s.'-]{2,})/i,
    /\bBENEFICIARY\s*[:\-]?\s*([A-Z][A-Z\s.'-]{2,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanExtractedValue(match[1]);
    }
  }

  return null;
};

/**
 * Extract account number.
 *
 * This is intentionally conservative because OCR can easily
 * mistake dates, transaction IDs, and phone numbers for accounts.
 */
const extractAccount = (text, type) => {
  if (!text) return null;

  const patterns =
    type === "sender"
      ? [
          /\bSENDER\s+ACCOUNT\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
          /\bFROM\s+ACCOUNT\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
        ]
      : [
          /\bRECEIVER\s+ACCOUNT\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
          /\bTO\s+ACCOUNT\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
          /\bACCOUNT\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
        ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanExtractedValue(match[1]);
    }
  }

  return null;
};

/**
 * Extract transaction/reference number.
 *
 * We only use explicit labels to avoid accidentally
 * treating random numbers as transaction references.
 */
const extractTransactionReference = (text) => {
  if (!text) return null;

  const patterns = [
    /\bTRANSACTION\s*(?:REFERENCE|REF|ID|NO|NUMBER)\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
    /\bREFERENCE\s*(?:NO|NUMBER|ID)?\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
    /\bTXN\s*(?:NO|NUMBER|ID)?\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
    /\bTRX\s*(?:NO|NUMBER|ID)?\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanExtractedValue(match[1]);
    }
  }

  return null;
};

/**
 * Extract a transaction date.
 *
 * Supports common formats:
 * 10/10/2026
 * 10-10-2026
 * 2026/10/10
 * 2026-10-10
 */
const extractTransactionDate = (text) => {
  if (!text) return null;

  const patterns = [
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    let year;
    let month;
    let day;

    if (match[1].length === 4) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }

    const date = new Date(
      Date.UTC(year, month - 1, day)
    );

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
  }

  return null;
};

/**
 * Clean OCR output.
 */
const cleanExtractedValue = (value) => {
  if (!value) return null;

  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,\-|]+/, "")
    .replace(/[\s:;,\-|]+$/, "")
    .trim();
};

/**
 * Extract structured information from raw OCR text.
 *
 * The OCR provider gives us the raw text.
 * This function converts that text into the fields
 * required by OCRData.
 */
const extractStructuredData = (rawText) => {
  const text = rawText || "";

  return {
    transactionReference:
      extractTransactionReference(text),

    senderName:
      extractSenderName(text),

    senderAccount:
      extractAccount(text, "sender"),

    receiverName:
      extractReceiverName(text),

    receiverAccount:
      extractAccount(text, "receiver"),

    amount:
      extractAmount(text),

    transactionDate:
      extractTransactionDate(text),

    bankName:
      extractBankName(text),
  };
};

export const processOCR = async (req, res) => {
  try {
    const { receiptId } = req.params;

    // -------------------------------------------------------
    // 1. Find receipt
    // -------------------------------------------------------

    const receipt = await prisma.receipt.findUnique({
      where: {
        id: receiptId,
      },
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    // -------------------------------------------------------
    // 2. Prevent duplicate OCR processing
    // -------------------------------------------------------

    if (receipt.ocrProcessed) {
      return res.status(409).json({
        success: false,
        message: "Receipt has already been processed",
      });
    }

    // -------------------------------------------------------
    // 3. Build absolute image path
    // -------------------------------------------------------

    const relativeImagePath = receipt.imageUrl
      .replace(/^\/+/, "")
      .replace(/\//g, path.sep);

    const imagePath = path.join(
      process.cwd(),
      relativeImagePath
    );

    console.log("OCR IMAGE PATH:", imagePath);

    // -------------------------------------------------------
    // 4. Make sure image exists
    // -------------------------------------------------------

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        message: "Receipt image file not found",
        imagePath,
      });
    }

    // -------------------------------------------------------
    // 5. Mark receipt as processing
    // -------------------------------------------------------

    await prisma.receipt.update({
      where: {
        id: receipt.id,
      },
      data: {
        status: "PROCESSING",
      },
    });

    // -------------------------------------------------------
    // 6. Send image to OCR service
    // -------------------------------------------------------

    const ocrResult = await processReceiptOCR(imagePath);

    console.log("RAW OCR RESULT:", ocrResult);

    // -------------------------------------------------------
    // 7. Get raw OCR text
    // -------------------------------------------------------

    const rawText = ocrResult?.rawText || "";

    // -------------------------------------------------------
    // 8. Extract structured fields from raw text
    // -------------------------------------------------------

    const extractedData = extractStructuredData(rawText);

    console.log(
      "STRUCTURED OCR DATA:",
      extractedData
    );

    // -------------------------------------------------------
    // 9. Prefer structured values from OCR service if they
    //    already exist.
    //
    //    Otherwise use our raw-text extraction.
    // -------------------------------------------------------

    const transactionReference =
      ocrResult?.transactionReference ||
      extractedData.transactionReference;

    const senderName =
      ocrResult?.senderName ||
      extractedData.senderName;

    const senderAccount =
      ocrResult?.senderAccount ||
      extractedData.senderAccount;

    const receiverName =
      ocrResult?.receiverName ||
      extractedData.receiverName;

    const receiverAccount =
      ocrResult?.receiverAccount ||
      extractedData.receiverAccount;

    const amount =
      ocrResult?.amount ??
      extractedData.amount;

    const transactionDate =
      ocrResult?.transactionDate ||
      extractedData.transactionDate;

    const bankName =
      ocrResult?.bankName ||
      extractedData.bankName;

    const confidence =
      ocrResult?.confidence ?? null;

    // -------------------------------------------------------
    // 10. Save OCR data
    // -------------------------------------------------------

    const ocrData = await prisma.oCRData.create({
      data: {
        receiptId: receipt.id,

        transactionReference,

        senderName,

        senderAccount,

        receiverName,

        receiverAccount,

        amount,

        transactionDate,

        bankName,

        rawText,

        confidence,

        processedAt: new Date(),
      },
    });

    // -------------------------------------------------------
    // 11. Mark receipt as processed
    // -------------------------------------------------------

    const updatedReceipt =
      await prisma.receipt.update({
        where: {
          id: receipt.id,
        },

        data: {
          status: "PROCESSED",
          ocrProcessed: true,
        },

        include: {
          ocrData: true,
        },
      });

    // -------------------------------------------------------
    // 12. Return result to frontend
    // -------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Receipt OCR processed successfully",

      receipt: updatedReceipt,

      ocrData,
    });
  } catch (error) {
    console.error(
      "OCR controller error:",
      error
    );

    // -------------------------------------------------------
    // If OCR fails, mark receipt back to UPLOADED
    // -------------------------------------------------------

    try {
      if (req.params.receiptId) {
        await prisma.receipt.update({
          where: {
            id: req.params.receiptId,
          },

          data: {
            status: "UPLOADED",
          },
        });
      }
    } catch (updateError) {
      console.error(
        "Failed to reset receipt status:",
        updateError
      );
    }

    return res.status(500).json({
      success: false,

      message:
        "Failed to process receipt",

      error: error.message,
    });
  }
};
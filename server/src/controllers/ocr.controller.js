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

    // 1. Find receipt and its payment, membership and Equb
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: {
          include: {
            membership: {
              include: {
                equb: true,
              },
            },
            allocations: {
              include: {
                period: true,
              },
            },
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    if (receipt.ocrProcessed) {
      return res.status(409).json({
        success: false,
        message: "Receipt has already been processed",
      });
    }

    if (!receipt.payment) {
      return res.status(400).json({
        success: false,
        message: "Receipt has no associated payment",
      });
    }

    // 2. Build and validate the image path
    const relativeImagePath = receipt.imageUrl
      .replace(/^\/+/, "")
      .replace(/\//g, path.sep);

    const imagePath = path.join(
      process.cwd(),
      relativeImagePath
    );

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        message: "Receipt image file not found",
      });
    }

    // 3. Mark receipt as processing
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { status: "PROCESSING" },
    });

    // 4. Run OCR
    const ocrResult = await processReceiptOCR(imagePath);
    const rawText = ocrResult?.rawText || "";

    const extractedData = extractStructuredData(rawText);

    // 5. Extract receipt information
    const transactionReference =
      ocrResult?.transactionReference ||
      extractedData.transactionReference ||
      null;

    const senderName =
      ocrResult?.senderName ||
      extractedData.senderName ||
      null;

    const senderAccount =
      ocrResult?.senderAccount ||
      extractedData.senderAccount ||
      null;

    const receiverName =
      ocrResult?.receiverName ||
      extractedData.receiverName ||
      null;

    const receiverAccount =
      ocrResult?.receiverAccount ||
      extractedData.receiverAccount ||
      null;

    const rawAmount =
      ocrResult?.amount ??
      extractedData.amount ??
      null;

    const transactionDate =
      ocrResult?.transactionDate ||
      extractedData.transactionDate ||
      null;

    const bankName =
      ocrResult?.bankName ||
      extractedData.bankName ||
      null;

    const confidence =
      ocrResult?.confidence ?? null;

    // Convert amounts such as "ETB 9,000.00" to 9000
    let amount = null;

    if (
      typeof rawAmount === "number" &&
      Number.isFinite(rawAmount)
    ) {
      amount = rawAmount;
    } else if (
      typeof rawAmount === "string" &&
      rawAmount.trim()
    ) {
      const normalizedAmount = Number(
        rawAmount.replace(/,/g, "").replace(/[^\d.-]/g, "")
      );

      if (Number.isFinite(normalizedAmount)) {
        amount = normalizedAmount;
      }
    }

    const payment = receipt.payment;
    const membership = payment.membership;
    const equb = membership.equb;

    // 6. Calculate the contribution for one period
    const amountPerPeriod =
      Number(equb.contributionAmount) *
      Number(membership.shares);

    let allocationPeriods = [];
    let reviewReason = null;

    // 7. Validate the OCR amount
    if (
      amount === null ||
      amount <= 0 ||
      !Number.isFinite(amountPerPeriod) ||
      amountPerPeriod <= 0
    ) {
      reviewReason =
        "OCR could not determine a valid payment amount.";
    } else {
      const periodsNeeded = Math.round(
        amount / amountPerPeriod
      );

      // Only automatically allocate complete contributions
      if (
        periodsNeeded < 1 ||
        Math.abs(
          amount - periodsNeeded * amountPerPeriod
        ) > 0.01
      ) {
        reviewReason =
          "The OCR amount does not match a whole number of period contributions.";
      } else {
        // 8. Find the last verified period for this membership
        const verifiedPayments =
          await prisma.payment.findMany({
            where: {
              membershipId: membership.id,
              status: "VERIFIED",
            },
            include: {
              allocations: {
                include: {
                  period: true,
                },
              },
            },
          });

        let lastVerifiedPeriodNumber = 0;

        for (const verifiedPayment of verifiedPayments) {
          for (const allocation of verifiedPayment.allocations) {
            lastVerifiedPeriodNumber = Math.max(
              lastVerifiedPeriodNumber,
              allocation.period.periodNumber
            );
          }
        }

        // 9. Find periods already reserved by other payments.
        // Rejected payments do not reserve periods.
        const otherPayments =
          await prisma.payment.findMany({
            where: {
              membershipId: membership.id,
              id: { not: payment.id },
              status: { not: "REJECTED" },
            },
            include: {
              allocations: true,
            },
          });

        const occupiedPeriodIds = new Set(
          otherPayments.flatMap((otherPayment) =>
            otherPayment.allocations.map(
              (allocation) => allocation.periodId
            )
          )
        );

        // 10. Load future periods in order
        const periods = await prisma.paymentPeriod.findMany({
          where: {
            equbId: equb.id,
            periodNumber: {
              gt: lastVerifiedPeriodNumber,
            },
          },
          orderBy: {
            periodNumber: "asc",
          },
        });

        // Allocate consecutively. Never skip a blocked period.
        for (let i = 1; i <= periodsNeeded; i++) {
          const expectedPeriodNumber =
            lastVerifiedPeriodNumber + i;

          const nextPeriod = periods.find(
            (period) =>
              period.periodNumber === expectedPeriodNumber
          );

          if (!nextPeriod) {
            reviewReason =
              "There are not enough consecutive future periods.";
            break;
          }

          if (
            !["OPEN", "UPCOMING"].includes(nextPeriod.status)
          ) {
            reviewReason =
              `Period ${expectedPeriodNumber} is not eligible for automatic allocation.`;
            break;
          }

          if (occupiedPeriodIds.has(nextPeriod.id)) {
            reviewReason =
              `Period ${expectedPeriodNumber} already has another payment.`;
            break;
          }

          allocationPeriods.push(nextPeriod);
        }
      }
    }

    // 11. Save OCR data and update allocations atomically
    const result = await prisma.$transaction(async (tx) => {
      const ocrData = await tx.oCRData.create({
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

      let allocationsCreated = false;

      if (!reviewReason) {
        // Replace old allocations only when a complete,
        // valid allocation plan is ready.
        await tx.paymentAllocation.deleteMany({
          where: {
            paymentId: payment.id,
          },
        });

        for (const period of allocationPeriods) {
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              periodId: period.id,
              amount: amountPerPeriod,
            },
          });
        }

        allocationsCreated = true;
      }

      // Unclear amounts require manual review.
      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: reviewReason
            ? "NEEDS_REVIEW"
            : "PENDING",
        },
      });

         const updatedReceipt = await tx.receipt.update({
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

      // Fetch the allocations actually saved in the database.
      const savedAllocations = await tx.paymentAllocation.findMany({
        where: {
          paymentId: payment.id,
        },
        include: {
          period: {
            select: {
              id: true,
              periodNumber: true,
              equbId: true,
            },
          },
        },
        orderBy: {
          period: {
            periodNumber: "asc",
          },
        },
      });

      const actualAllocatedCents = savedAllocations.reduce(
        (total, allocation) =>
          total + Math.round(Number(allocation.amount) * 100),
        0
      );

      const actualAllocatedAmount = actualAllocatedCents / 100;

      const expectedAllocatedAmount =
        allocationsCreated * amountPerPeriod;

      const hasCorrectAllocations =
        savedAllocations.length === allocationsCreated &&
        Math.abs(actualAllocatedAmount - expectedAllocatedAmount) < 0.01;

      return {
        ocrData,
        payment: updatedPayment,
        receipt: updatedReceipt,
        allocationsCreated,
        savedAllocations,
        actualAllocatedAmount,
        hasCorrectAllocations,
      };
    });

    // 12. Return the actual result.
    return res.status(200).json({
      success: true,
      message: result.hasCorrectAllocations
        ? "OCR completed and payment periods allocated successfully."
        : "OCR completed, but the saved allocations require manual review.",
      receipt: result.receipt,
      ocrData: result.ocrData,
      payment: result.payment,
      allocationsCreated: result.allocationsCreated,
      actualAllocationCount: result.savedAllocations.length,
      actualAllocatedAmount: result.actualAllocatedAmount,
      hasCorrectAllocations: result.hasCorrectAllocations,
      allocatedPeriods: result.savedAllocations.map((allocation) => ({
        periodId: allocation.period.id,
        periodNumber: allocation.period.periodNumber,
        amount: Number(allocation.amount),
      })),
      reviewReason: reviewReason || null,
    });
  } catch (error) {
    console.error("OCR controller error:", error);

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
      message: "Failed to process receipt",
      error: error.message,
    });
  }
};
import fs from "fs";
import path from "path";
import prisma from "../config/database.js";
import { extractBankStatement } from "../services/bankStatement.service.js";

async function removeUploadedFile(filePath) {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not remove uploaded file:", error.message);
    }
  }
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

async function getAuthorizedImport(importId, userId) {
  const statementImport = await prisma.bankStatementImport.findUnique({
    where: { id: importId },
    include: {
      equb: {
        select: {
          id: true,
          name: true,
          createdById: true,
        },
      },
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      transactions: {
        orderBy: { transactionDate: "desc" },
      },
    },
  });

  if (!statementImport) {
    return { error: "NOT_FOUND" };
  }

  if (statementImport.equb.createdById !== userId) {
    return { error: "FORBIDDEN" };
  }

  return { statementImport };
}

// ============================================================
// UPLOAD AND EXTRACT BANK STATEMENT (PREVIEW WORKFLOW)
// POST /api/equbs/:equbId/bank-statements
// ============================================================

export const uploadBankStatement = async (req, res) => {
  let importId = null;
  const file = req.file;

  try {
    const equb = req.bankStatementEqub;
    const userId = req.user.userId;
    const bankName = String(req.body?.bankName || "").trim();

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Upload a file using the multipart field name "statement".',
      });
    }

    if (!bankName) {
      await removeUploadedFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Bank name is required.",
      });
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const source =
      extension === ".xls" || extension === ".xlsx" || extension === ".csv"
        ? "EXCEL"
        : "BANK_STATEMENT";

    // Create the import record in UPLOADED status
    const statementImport = await prisma.bankStatementImport.create({
      data: {
        equbId: equb.id,
        uploadedById: userId,
        originalFileName: file.originalname,
        storageKey: `bank-statements/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
        source,
        status: "UPLOADED",
      },
    });

    importId = statementImport.id;

    // Run extraction pipeline (Spatial text parsing -> Heuristics -> OCR fallback)
    const extraction = await extractBankStatement(file.path);

    if (!extraction.transactions || extraction.transactions.length === 0) {
      await prisma.bankStatementImport.update({
        where: { id: statementImport.id },
        data: {
          status: "FAILED",
          errorMessage: "No bank transactions could be identified in the uploaded statement.",
          processedAt: new Date(),
        },
      });

      return res.status(422).json({
        success: false,
        message: "No bank transactions could be identified in the uploaded statement.",
        importId: statementImport.id,
        extractionMethod: extraction.extractionMethod,
      });
    }

    // Check existing bank transactions for potential duplicate references
    const referencesToCheck = extraction.transactions
      .map((t) => t.reference)
      .filter(Boolean);

    let existingRefs = new Set();
    if (referencesToCheck.length > 0) {
      const existingTxns = await prisma.bankTransaction.findMany({
        where: {
          equbId: equb.id,
          transactionReference: { in: referencesToCheck },
        },
        select: { transactionReference: true },
      });
      existingRefs = new Set(existingTxns.map((t) => t.transactionReference));
    }

    // Annotate preview transactions with duplicate warnings and initial approval status
    const annotatedTransactions = extraction.transactions.map((tx, idx) => {
      const isDuplicate = tx.reference ? existingRefs.has(tx.reference) : false;
      const warnings = [...(tx.warnings || [])];

      if (isDuplicate) {
        warnings.push(`Reference ${tx.reference} already exists in this Equb's bank transactions.`);
      }

      return {
        ...tx,
        tempId: tx.tempId || `row-${idx + 1}`,
        bankName,
        isDuplicate,
        warnings,
        needsReview: tx.needsReview || isDuplicate,
        decision: isDuplicate ? "REJECT" : "APPROVE",
      };
    });

    // Save previewData into the BankStatementImport record
    const updatedImport = await prisma.bankStatementImport.update({
      where: { id: statementImport.id },
      data: {
        status: "UPLOADED",
        transactionCount: extraction.rowsFound || annotatedTransactions.length,
        previewData: {
          extractionMethod: extraction.extractionMethod,
          currency: extraction.currency,
          bankName,
          transactions: annotatedTransactions,
          rawTextPreview: extraction.rawTextPreview || null,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Statement extracted successfully (${extraction.extractionMethod}). Review and approve transactions before saving.`,
      importId: updatedImport.id,
      import: updatedImport,
      extractionMethod: extraction.extractionMethod,
      currency: extraction.currency || "ETB",
      rowsFound: extraction.rowsFound || annotatedTransactions.length,
      transactions: annotatedTransactions,
      summary: {
        rowsFound: extraction.rowsFound || annotatedTransactions.length,
        transactionsPreviewed: annotatedTransactions.length,
        rowsSkipped: extraction.skippedRows || 0,
        potentialDuplicates: annotatedTransactions.filter((t) => t.isDuplicate).length,
        needingReview: annotatedTransactions.filter((t) => t.needsReview).length,
      },
    });
  } catch (error) {
    console.error("Upload Bank Statement Error:", error);

    if (importId) {
      try {
        await prisma.bankStatementImport.update({
          where: { id: importId },
          data: {
            status: "FAILED",
            errorMessage: error.message,
            processedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Failed to update import status:", updateError);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process the bank statement.",
      error: error.message,
      importId,
    });
  }
};

// ============================================================
// GET PREVIEW TRANSACTIONS FOR AN IMPORT
// GET /api/bank-statement-imports/:importId/preview
// ============================================================

export const getBankStatementImportPreview = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can view import previews.",
      });
    }

    const result = await getAuthorizedImport(req.params.importId, req.user.userId);

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Bank statement import not found.",
      });
    }

    if (result.error === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this import.",
      });
    }

    const { statementImport } = result;
    const previewData = statementImport.previewData || {};

    return res.status(200).json({
      success: true,
      importId: statementImport.id,
      status: statementImport.status,
      originalFileName: statementImport.originalFileName,
      extractionMethod: previewData.extractionMethod || "Unknown",
      currency: previewData.currency || "ETB",
      transactions: previewData.transactions || [],
      summary: {
        rowsFound: statementImport.transactionCount,
        importedCount: statementImport.importedCount,
        failedCount: statementImport.failedCount,
      },
    });
  } catch (error) {
    console.error("Get Bank Statement Import Preview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve import preview.",
    });
  }
};

// ============================================================
// CONFIRM AND PERSIST REVIEWED TRANSACTIONS
// POST /api/bank-statement-imports/:importId/confirm
// ============================================================

export const confirmBankStatementImport = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can approve statement transactions.",
      });
    }

    const { importId } = req.params;
    const { transactions, bankName } = req.body || {};

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of reviewed transactions to confirm.",
      });
    }

    const result = await getAuthorizedImport(importId, req.user.userId);

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Bank statement import not found.",
      });
    }

    if (result.error === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to confirm transactions for this Equb.",
      });
    }

    const { statementImport } = result;

    if (statementImport.status === "COMPLETED") {
      return res.status(409).json({
        success: false,
        message: "This statement import has already been completed. Transactions cannot be resubmitted.",
      });
    }

    const equbId = statementImport.equbId;
    const effectiveBankName =
      String(bankName || statementImport.previewData?.bankName || "Bank Statement").trim();

    // Mark import status as PROCESSING
    await prisma.bankStatementImport.update({
      where: { id: importId },
      data: { status: "PROCESSING" },
    });

    let savedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    let invalidCount = 0;
    const savedTransactions = [];
    const duplicateReferences = [];
    const rejectedReferences = [];

    // Execute in a database transaction
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < transactions.length; index++) {
        const item = transactions[index];
        const decision = String(item.decision || "APPROVE").toUpperCase();

        if (decision === "REJECT") {
          rejectedCount++;
          if (item.reference) rejectedReferences.push(item.reference);
          continue;
        }

        // Validate date
        const parsedDate = item.transactionDate ? new Date(item.transactionDate) : null;
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
          invalidCount++;
          continue;
        }

        // Validate amount
        const amount = Number(item.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          invalidCount++;
          continue;
        }

        // Determine reference
        const hasRef = Boolean(item.reference && String(item.reference).trim());
        const transactionReference = hasRef
          ? String(item.reference).trim()
          : `NOREF-${statementImport.id}-${index + 1}`;

        // Check for duplicate reference in this Equb
        if (hasRef) {
          const existing = await tx.bankTransaction.findFirst({
            where: {
              equbId,
              transactionReference,
            },
            select: { id: true },
          });

          if (existing) {
            duplicateCount++;
            duplicateReferences.push(transactionReference);
            continue;
          }
        }

        // Build description with metadata
        const descriptionParts = [
          cleanText(item.description),
          item.currency && item.currency !== "ETB" ? `[Currency: ${item.currency}]` : null,
          item.balance ? `[Balance: ${item.balance}]` : null,
          item.debit > 0 ? `[Debit: ${item.debit}]` : null,
          item.credit > 0 ? `[Credit: ${item.credit}]` : null,
          !hasRef ? "[No reference in statement]" : null,
        ].filter(Boolean);

        const created = await tx.bankTransaction.create({
          data: {
            equbId,
            statementImportId: statementImport.id,
            transactionReference,
            bankName: effectiveBankName,
            senderName: cleanText(item.senderName),
            senderAccount: cleanText(item.senderAccount),
            receiverName: cleanText(item.receiverName),
            receiverAccount: cleanText(item.receiverAccount),
            amount,
            transactionDate: parsedDate,
            description: descriptionParts.join(" ").slice(0, 4000) || null,
            status: item.needsReview ? "SUSPICIOUS" : "UNMATCHED",
            reviewStatus: "APPROVED",
            reviewedById: req.user.userId,
            reviewedAt: new Date(),
            reviewReason: "Approved by administrator during statement review",
            source: statementImport.source,
          },
        });

        savedCount++;
        savedTransactions.push(created);
      }

      const totalFailed = duplicateCount + rejectedCount + invalidCount;
      let finalStatus = "COMPLETED";

      if (savedCount === 0 && transactions.length > 0) {
        finalStatus = rejectedCount === transactions.length ? "COMPLETED_WITH_ERRORS" : "FAILED";
      } else if (totalFailed > 0) {
        finalStatus = "COMPLETED_WITH_ERRORS";
      }

      const errorMessages = [];
      if (duplicateCount > 0) {
        errorMessages.push(`${duplicateCount} duplicate reference(s) skipped.`);
      }
      if (rejectedCount > 0) {
        errorMessages.push(`${rejectedCount} transaction(s) rejected by admin.`);
      }
      if (invalidCount > 0) {
        errorMessages.push(`${invalidCount} row(s) had invalid dates or amounts.`);
      }

      await tx.bankStatementImport.update({
        where: { id: statementImport.id },
        data: {
          status: finalStatus,
          importedCount: savedCount,
          failedCount: totalFailed,
          errorMessage: errorMessages.length > 0 ? errorMessages.join(" ") : null,
          processedAt: new Date(),
          previewData: {
            ...(statementImport.previewData || {}),
            confirmedAt: new Date().toISOString(),
            savedCount,
            rejectedCount,
            duplicateCount,
            invalidCount,
            duplicateReferences,
            rejectedReferences,
          },
        },
      });
    });

    const finalImport = await prisma.bankStatementImport.findUnique({
      where: { id: importId },
      include: {
        transactions: {
          orderBy: { transactionDate: "desc" },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully processed review: ${savedCount} saved, ${duplicateCount} skipped as duplicate, ${rejectedCount} rejected.`,
      results: {
        approved: savedCount,
        saved: savedCount,
        rejected: rejectedCount,
        duplicates: duplicateCount,
        failed: duplicateCount + rejectedCount + invalidCount,
        importStatus: finalImport.status,
      },
      import: finalImport,
      savedTransactions,
    });
  } catch (error) {
    console.error("Confirm Bank Statement Import Error:", error);

    try {
      await prisma.bankStatementImport.update({
        where: { id: req.params.importId },
        data: {
          status: "FAILED",
          errorMessage: error.message,
          processedAt: new Date(),
        },
      });
    } catch (e) {
      // Ignore secondary error
    }

    return res.status(500).json({
      success: false,
      message: "Failed to persist reviewed transactions.",
      error: error.message,
    });
  }
};

// ============================================================
// LIST STATEMENT IMPORTS FOR AN EQUb
// GET /api/equbs/:equbId/bank-statements
// ============================================================

export const getBankStatementImports = async (req, res) => {
  try {
    const equbId = req.bankStatementEqub.id;

    const imports = await prisma.bankStatementImport.findMany({
      where: { equbId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: imports.length,
      imports,
    });
  } catch (error) {
    console.error("Get Bank Statement Imports Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bank statement imports.",
    });
  }
};

// ============================================================
// GET ONE IMPORT AND ITS TRANSACTIONS
// GET /api/bank-statement-imports/:importId
// ============================================================

export const getBankStatementImportDetails = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can view import details.",
      });
    }

    const result = await getAuthorizedImport(
      req.params.importId,
      req.user.userId
    );

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Bank statement import not found.",
      });
    }

    if (result.error === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this import.",
      });
    }

    return res.status(200).json({
      success: true,
      import: result.statementImport,
    });
  } catch (error) {
    console.error("Get Bank Statement Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bank statement details.",
    });
  }
};

// ============================================================
// LIST TRANSACTIONS FOR AN EQUb
// GET /api/equbs/:equbId/bank-transactions
// ============================================================

export const getBankTransactions = async (req, res) => {
  try {
    const equbId = req.bankStatementEqub.id;
    const allowedStatuses = [
      "UNMATCHED",
      "MATCHED",
      "DUPLICATE",
      "SUSPICIOUS",
      "REVERSED",
    ];

    const requestedStatus = req.query.status;

    if (
      requestedStatus &&
      !allowedStatuses.includes(requestedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction status filter.",
      });
    }

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        equbId,
        ...(requestedStatus ? { status: requestedStatus } : {}),
      },
      orderBy: [
        { transactionDate: "desc" },
        { importedAt: "desc" },
      ],
      take: 200,
      include: {
        statementImport: {
          select: {
            id: true,
            originalFileName: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Get Bank Transactions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bank transactions.",
    });
  }
};

// ============================================================
// MATCH A BANK TRANSACTION TO A PAYMENT AND VERIFY IT
// POST /api/bank-transactions/:transactionId/match
// ============================================================

export const matchBankTransaction = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can match transactions.",
      });
    }

    const { transactionId } = req.params;
    const { paymentId, periodId, reason } = req.body || {};
    const userId = req.user.userId;

    if (!paymentId || !periodId) {
      return res.status(400).json({
        success: false,
        message: "Both paymentId and periodId are required.",
      });
    }

    const bankTransaction = await prisma.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { equb: true },
    });

    if (!bankTransaction) {
      return res.status(404).json({
        success: false,
        message: "Bank transaction not found.",
      });
    }

    if (bankTransaction.equb.createdById !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to match transactions for this Equb.",
      });
    }

    if (
      !["UNMATCHED", "SUSPICIOUS"].includes(bankTransaction.status) ||
      bankTransaction.matchedPaymentId
    ) {
      return res.status(409).json({
        success: false,
        message: "This bank transaction is not available for matching.",
      });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: {
          include: {
            period: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    if (payment.status === "VERIFIED") {
      return res.status(409).json({
        success: false,
        message: "This payment is already verified. It cannot be counted again.",
      });
    }

    if (payment.status === "REJECTED") {
      return res.status(409).json({
        success: false,
        message: "This payment was rejected. Review its status before matching it.",
      });
    }

    const allocation = payment.allocations.find(
      (item) =>
        item.periodId === periodId &&
        item.period.equbId === bankTransaction.equbId
    );

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: "The selected payment is not allocated to that period in this Equb.",
      });
    }

    const bankAmount = Number(bankTransaction.amount);
    const allocatedAmount = Number(allocation.amount);

    if (Math.abs(bankAmount - allocatedAmount) > 0.009) {
      return res.status(400).json({
        success: false,
        message: "The bank transaction amount does not match the period allocation.",
        bankAmount,
        allocatedAmount,
      });
    }

    const alreadyMatched = await prisma.bankTransaction.findFirst({
      where: {
        matchedPaymentId: payment.id,
        status: "MATCHED",
      },
      select: { id: true },
    });

    if (alreadyMatched) {
      return res.status(409).json({
        success: false,
        message: "Another bank transaction is already matched to this payment.",
      });
    }

    const verificationReason =
      String(reason || "").trim() ||
      `Matched against bank statement import ${bankTransaction.statementImportId || "without an import record"}.`;

    const txResult = await prisma.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { notIn: ["VERIFIED", "REJECTED"] },
        },
        data: {
          status: "VERIFIED",
          paidAmount: bankTransaction.amount,
          paymentDate: bankTransaction.transactionDate,
          referenceNumber: bankTransaction.transactionReference.startsWith("NOREF-")
            ? payment.referenceNumber
            : bankTransaction.transactionReference,
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new Error(
          "The payment status changed while this transaction was being matched. Refresh and try again."
        );
      }

      const transactionUpdate = await tx.bankTransaction.updateMany({
        where: {
          id: bankTransaction.id,
          status: { in: ["UNMATCHED", "SUSPICIOUS"] },
          matchedPaymentId: null,
        },
        data: {
          status: "MATCHED",
          matchedPaymentId: payment.id,
        },
      });

      if (transactionUpdate.count !== 1) {
        throw new Error(
          "The bank transaction has already been matched. Refresh and try again."
        );
      }

      const verification = await tx.paymentVerification.create({
        data: {
          paymentId: payment.id,
          reviewerId: userId,
          decision: "VERIFIED",
          reason: verificationReason,
          verifiedAmount: bankTransaction.amount,
        },
      });

      const updatedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });

      const updatedTransaction = await tx.bankTransaction.findUnique({
        where: { id: bankTransaction.id },
      });

      return {
        payment: updatedPayment,
        bankTransaction: updatedTransaction,
        verification,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Bank transaction matched and payment verified.",
      ...txResult,
    });
  } catch (error) {
    console.error("Match Bank Transaction Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to match bank transaction.",
    });
  }
};

// ============================================================
// FLAG A TRANSACTION FOR MANUAL REVIEW
// POST /api/bank-transactions/:transactionId/flag
// ============================================================

export const flagBankTransaction = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can flag transactions.",
      });
    }

    const { transactionId } = req.params;
    const reason = String(req.body?.reason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "A reason is required.",
      });
    }

    const transaction = await prisma.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { equb: true },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Bank transaction not found.",
      });
    }

    if (transaction.equb.createdById !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this transaction.",
      });
    }

    if (transaction.status === "MATCHED") {
      return res.status(409).json({
        success: false,
        message: "A matched transaction cannot be flagged this way.",
      });
    }

    const updatedTransaction = await prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUSPICIOUS",
        description: [
          transaction.description,
          `[Admin review: ${reason}]`,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 4000),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Transaction flagged for manual review.",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Flag Bank Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to flag transaction.",
    });
  }
};

// ============================================================
// APPROVE ONE BANK TRANSACTION
// POST /api/bank-transactions/:transactionId/approve
// ============================================================

export const approveBankTransaction = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can approve transactions.",
      });
    }

    const transaction = await prisma.bankTransaction.findUnique({
      where: { id: req.params.transactionId },
      include: { equb: true },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Bank transaction not found.",
      });
    }

    if (transaction.equb.createdById !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this transaction.",
      });
    }

    if (transaction.status === "MATCHED" || transaction.matchedPaymentId) {
      return res.status(409).json({
        success: false,
        message: "This transaction has already been matched.",
      });
    }

    if (transaction.reviewStatus === "REJECTED") {
      return res.status(409).json({
        success: false,
        message: "A rejected transaction cannot be approved.",
      });
    }

    const updatedTransaction = await prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: {
        reviewStatus: "APPROVED",
        reviewedById: req.user.userId,
        reviewedAt: new Date(),
        reviewReason: String(req.body?.reason || "Approved by administrator").trim(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Bank transaction approved for matching.",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Approve Bank Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve bank transaction.",
    });
  }
};

// ============================================================
// REJECT ONE BANK TRANSACTION
// POST /api/bank-transactions/:transactionId/reject
// ============================================================

export const rejectBankTransaction = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can reject transactions.",
      });
    }

    const reason = String(req.body?.reason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide a rejection reason.",
      });
    }

    const transaction = await prisma.bankTransaction.findUnique({
      where: { id: req.params.transactionId },
      include: { equb: true },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Bank transaction not found.",
      });
    }

    if (transaction.equb.createdById !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this transaction.",
      });
    }

    if (transaction.status === "MATCHED" || transaction.matchedPaymentId) {
      return res.status(409).json({
        success: false,
        message: "A matched transaction cannot be rejected.",
      });
    }

    const updatedTransaction = await prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: {
        reviewStatus: "REJECTED",
        reviewedById: req.user.userId,
        reviewedAt: new Date(),
        reviewReason: reason,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Bank transaction rejected.",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Reject Bank Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject bank transaction.",
    });
  }
};

// ============================================================
// BULK REVIEW BANK TRANSACTIONS
// POST /api/bank-transactions/bulk-review
// ============================================================

export const bulkReviewBankTransactions = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can review transactions.",
      });
    }

    const { transactionIds, action } = req.body || {};
    const reason = String(req.body?.reason || "").trim();

    if (
      !Array.isArray(transactionIds) ||
      transactionIds.length === 0 ||
      transactionIds.some((id) => typeof id !== "string" || !id.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a non-empty transactionIds array.",
      });
    }

    if (new Set(transactionIds).size !== transactionIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate transaction IDs were provided.",
      });
    }

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be "APPROVE" or "REJECT".',
      });
    }

    if (action === "REJECT" && !reason) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required.",
      });
    }

    const transactions = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds } },
      include: { equb: true },
    });

    if (transactions.length !== transactionIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more transactions were not found.",
      });
    }

    const unauthorized = transactions.some(
      (transaction) => transaction.equb.createdById !== req.user.userId
    );

    if (unauthorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review every selected transaction.",
      });
    }

    const blocked = transactions.filter(
      (transaction) =>
        transaction.status === "MATCHED" ||
        transaction.matchedPaymentId ||
        (action === "APPROVE" && transaction.reviewStatus === "REJECTED")
    );

    if (blocked.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Some selected transactions are already matched or cannot be approved. No transactions were changed.",
        blockedTransactionIds: blocked.map((transaction) => transaction.id),
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = [];

      for (const transaction of transactions) {
        const update = await tx.bankTransaction.updateMany({
          where: {
            id: transaction.id,
            matchedPaymentId: null,
            status: { not: "MATCHED" },
            ...(action === "APPROVE"
              ? { reviewStatus: { not: "REJECTED" } }
              : {}),
          },
          data: {
            reviewStatus: action === "APPROVE" ? "APPROVED" : "REJECTED",
            reviewedById: req.user.userId,
            reviewedAt: new Date(),
            reviewReason:
              action === "APPROVE"
                ? reason || "Bulk approved by administrator"
                : reason,
          },
        });

        if (update.count !== 1) {
          throw new Error(
            "A transaction changed while the bulk review was processing. Refresh and try again."
          );
        }

        updated.push(transaction.id);
      }

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: `${result.length} transactions ${action === "APPROVE" ? "approved" : "rejected"}.`,
      count: result.length,
      transactionIds: result,
    });
  } catch (error) {
    console.error("Bulk Review Bank Transactions Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to review bank transactions.",
    });
  }
};
import express from "express";

import { protect } from "../middleware/auth.middleware.js";

import {
  requireEqubBankStatementAdmin,
  uploadBankStatement as uploadBankStatementFile,
} from "../middleware/bankStatementUpload.middleware.js";

import {
  uploadBankStatement,
  getBankStatementImports,
  getBankStatementImportDetails,
  getBankStatementImportPreview,
  confirmBankStatementImport,
  getBankTransactions,
  matchBankTransaction,
  flagBankTransaction,
  approveBankTransaction,
  rejectBankTransaction,
  bulkReviewBankTransactions,
} from "../controllers/bankStatement.controller.js";

const router = express.Router();

// Upload and extract an official bank statement for review.
router.post(
  "/equbs/:equbId/bank-statements",
  protect,
  requireEqubBankStatementAdmin,
  uploadBankStatementFile,
  uploadBankStatement
);

// List statement imports for an Equb.
router.get(
  "/equbs/:equbId/bank-statements",
  protect,
  requireEqubBankStatementAdmin,
  getBankStatementImports
);

// List extracted/approved transactions for an Equb.
router.get(
  "/equbs/:equbId/bank-transactions",
  protect,
  requireEqubBankStatementAdmin,
  getBankTransactions
);

// View one import and its transactions.
router.get(
  "/bank-statement-imports/:importId",
  protect,
  getBankStatementImportDetails
);

// Get preview data for an import.
router.get(
  "/bank-statement-imports/:importId/preview",
  protect,
  getBankStatementImportPreview
);

// Confirm and save reviewed transactions for an import.
router.post(
  "/bank-statement-imports/:importId/confirm",
  protect,
  confirmBankStatementImport
);

// Approve one transaction for payment matching.
router.post(
  "/bank-transactions/:transactionId/approve",
  protect,
  approveBankTransaction
);

// Reject one transaction from further matching.
router.post(
  "/bank-transactions/:transactionId/reject",
  protect,
  rejectBankTransaction
);

// Approve or reject multiple transactions in one request.
router.post(
  "/bank-transactions/bulk-review",
  protect,
  bulkReviewBankTransactions
);

// Manually match an approved transaction to a payment.
router.post(
  "/bank-transactions/:transactionId/match",
  protect,
  matchBankTransaction
);

// Flag a transaction for further investigation.
router.post(
  "/bank-transactions/:transactionId/flag",
  protect,
  flagBankTransaction
);

export default router;

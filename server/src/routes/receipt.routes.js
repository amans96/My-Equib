import express from "express";

import {
  uploadReceipt,
  getPaymentPeriodDetails,
  processOCR,
  approvePayment,
  rejectPayment,
} from "../controllers/receipt.controller.js";

import { protect } from "../middleware/auth.middleware.js";

import {
  uploadReceipt as uploadReceiptFile,
} from "../middleware/receiptUpload.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| MEMBER
|--------------------------------------------------------------------------
*/

// Upload receipt
// POST /api/payment-periods/:periodId/receipts
router.post(
  "/payment-periods/:periodId/receipts",
  (req, res, next) => {
    console.log("1. RECEIPT ROUTE REACHED");
    next();
  },
  protect,
  (req, res, next) => {
    console.log("2. AUTHENTICATION PASSED");
    next();
  },
  uploadReceiptFile,
  (req, res, next) => {
    console.log("3. UPLOAD MIDDLEWARE PASSED");
    console.log("Uploaded file:", req.file);
    next();

    
  },
  uploadReceipt
);

/*
|--------------------------------------------------------------------------
| ADMIN
|--------------------------------------------------------------------------
*/

// Get payment period details
// GET /api/payment-periods/:periodId
router.get(
  "/payment-periods/:periodId",
  protect,
  getPaymentPeriodDetails
);

// Process OCR
// POST /api/receipts/:receiptId/ocr
router.post(
  "/receipts/:receiptId/ocr",
  protect,
  processOCR
);

// Approve payment
// POST /api/receipts/:receiptId/approve
router.post(
  "/receipts/:receiptId/approve",
  protect,
  approvePayment
);

// Reject payment
// POST /api/receipts/:receiptId/reject
router.post(
  "/receipts/:receiptId/reject",
  protect,
  rejectPayment
);

export default router;
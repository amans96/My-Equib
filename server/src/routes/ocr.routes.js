import express from "express";

import { processOCR } from "../controllers/ocr.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/receipts/:receiptId/ocr",
  protect,
  processOCR
);

export default router;
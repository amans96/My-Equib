import fs from "fs";
import { createWorker } from "tesseract.js";
import { parseReceiptText } from "./receipt-parser.service.js";

let worker = null;

const getWorker = async () => {
  if (!worker) {
    console.log("Starting Tesseract OCR worker...");

    worker = await createWorker("eng");

    console.log("Tesseract OCR worker ready");
  }

  return worker;
};

export const processReceiptOCR = async (imagePath) => {
  try {
    console.log("Starting Tesseract OCR for:", imagePath);

    if (!fs.existsSync(imagePath)) {
      throw new Error("Receipt image file does not exist");
    }

    const ocrWorker = await getWorker();

    const result = await ocrWorker.recognize(imagePath);

    const rawText = result.data.text?.trim() || "";

    const ocrConfidence = result.data.confidence ?? null;

    console.log("OCR completed successfully");
    console.log("OCR confidence:", ocrConfidence);

   const parsedReceipt = parseReceiptText(rawText);

return {
  ...parsedReceipt,
  confidence: ocrConfidence,
  ocrConfidence,
  parserConfidence: parsedReceipt.parserConfidence,
};
  } catch (error) {
    console.error("OCR service error:", error);

    throw error;
  }
};
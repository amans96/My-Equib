import { fileTypeFromFile } from "file-type";
import fs from "fs/promises";

const allowedTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const validateReceiptFile = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Receipt image is required",
    });
  }

  try {
    const detectedType = await fileTypeFromFile(req.file.path);

    if (!detectedType) {
      await fs.unlink(req.file.path);

      return res.status(400).json({
        message: "The uploaded file is not a valid image",
      });
    }

    const expectedMimeType = allowedTypes[detectedType.ext];

    if (
      !expectedMimeType ||
      detectedType.mime !== expectedMimeType
    ) {
      await fs.unlink(req.file.path);

      return res.status(400).json({
        message: "Invalid receipt image format",
      });
    }

    req.file.detectedMimeType = detectedType.mime;
    req.file.detectedExtension = detectedType.ext;

    next();
  } catch (error) {
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {
        // File may already have been removed
      }
    }

    console.error("Receipt file validation error:", error);

    return res.status(400).json({
      message: "Could not validate the uploaded receipt",
    });
  }
};
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import prisma from "../config/database.js";

const uploadDirectory = path.resolve(
  process.cwd(),
  "private-uploads",
  "bank-statements"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = [".pdf", ".xls", ".xlsx"];

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return callback(
        new Error("Only PDF, XLS, and XLSX files are allowed.")
      );
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("The uploaded file type is not supported.")
      );
    }

    callback(null, true);
  },
});

// ADMINs can manage bank statements only for Equbs they created.
// SUPER_ADMIN remains read-only for this feature.
export const requireEqubBankStatementAdmin = async (
  req,
  res,
  next
) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Equb administrators can manage bank statements.",
      });
    }

    const { equbId } = req.params;

    const equb = await prisma.equb.findUnique({
      where: { id: equbId },
      select: {
        id: true,
        name: true,
        createdById: true,
      },
    });

    if (!equb) {
      return res.status(404).json({
        success: false,
        message: "Equb not found.",
      });
    }

    if (equb.createdById !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to manage this Equb's bank statements.",
      });
    }

    req.bankStatementEqub = equb;
    next();
  } catch (error) {
    console.error("Bank statement authorization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to authorize bank statement access.",
    });
  }
};

export const uploadBankStatement = (req, res, next) => {
  upload.single("statement")(req, res, (error) => {
    if (!error) {
      return next();
    }

    const isFileSizeError = error.code === "LIMIT_FILE_SIZE";

    return res.status(400).json({
      success: false,
      message: isFileSizeError
        ? "The statement file must not exceed 15 MB."
        : error.message || "Failed to upload the statement file.",
    });
  });
};
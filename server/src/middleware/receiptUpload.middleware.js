import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads/receipts");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const filename = `receipt-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}`;

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only JPG, PNG, and WEBP receipt images are allowed"),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadReceipt = (req, res, next) => {
  console.log("=== RECEIPT UPLOAD DEBUG ===");
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Content-Length:", req.headers["content-length"]);

  upload.single("receipt")(req, res, (err) => {
    if (err) {
      console.error("MULTER ERROR:", err.message);

      return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        success: false,
        message: err.message,
      });
    }

    console.log("Uploaded file:", req.file);
    console.log("Request body:", req.body);
    console.log("============================");

    next();
  });
};
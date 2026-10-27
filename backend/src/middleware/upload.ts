// src/middleware/upload.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// Store uploaded files securely in persistent storage or local uploads folder
export const UPLOAD_DIR =
  process.env.PERSISTENT_STORAGE_DIR ||
  path.resolve(process.cwd(), "uploads", "evidence");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function isPersistentStorageConfigured(): boolean {
  return Boolean(
    process.env.PERSISTENT_STORAGE_DIR ||
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET
  );
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate safe, unguessable filename with safe extension
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
      return cb(new Error("Only PDF, JPEG, and PNG files are allowed"));
    }
    cb(null, true);
  },
});

/**
 * Validate actual file signature (magic numbers) to prevent file-extension spoofing
 */
export async function validateFileSignature(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const filePath = req.file.path;
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; // JPEG SOI marker
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a; // PNG signature

    if (!isPdf && !isJpeg && !isPng) {
      // Remove invalid file from storage immediately
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        message: "Invalid file signature: content does not match allowed PDF, JPEG, or PNG formats",
      });
    }

    next();
  } catch (err) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error("File signature validation error:", err);
    return res.status(500).json({ message: "Failed to validate file signature" });
  }
}

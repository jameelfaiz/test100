// src/middleware/chatbotUpload.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request } from "express";

export const CHATBOT_UPLOAD_BASE = path.resolve(
  process.cwd(),
  "uploads",
  "chatbot_attachments"
);

if (!fs.existsSync(CHATBOT_UPLOAD_BASE)) {
  fs.mkdirSync(CHATBOT_UPLOAD_BASE, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const userId = (req.session as any)?.userId || "anonymous";
    const userDir = path.join(CHATBOT_UPLOAD_BASE, String(userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "image/jpeg",
  "image/png",
]);

const allowedExtensions = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
]);

export const chatbotUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return cb(
        new Error(
          "Unsupported file type. Only PDF, DOCX, TXT, PNG, and JPEG documents are permitted."
        )
      );
    }
    cb(null, true);
  },
});

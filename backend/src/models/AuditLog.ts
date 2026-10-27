// src/models/AuditLog.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  employeeId: string; // User._id as string
  role: string;
  investigationId?: string;
  complaintId?: string;
  previousStatus?: string;
  newStatus?: string;
  details?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    employeeId: { type: String, required: true },
    role: { type: String, required: true },
    investigationId: { type: String },
    complaintId: { type: String },
    previousStatus: { type: String },
    newStatus: { type: String },
    details: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

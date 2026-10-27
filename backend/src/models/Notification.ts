// src/models/Notification.ts
import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  collegeId: string;
  applicationId?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  isRead?: boolean;
  link: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    collegeId: { type: String, required: true, index: true },
    applicationId: { type: String },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      default: "GENERAL",
    },
    read: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: "/institution/dashboard" },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Notification =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);

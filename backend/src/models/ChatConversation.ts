import mongoose, { Document, Schema } from "mongoose";

export interface IChatConversation extends Document {
  userId: string;
  institutionId?: mongoose.Types.ObjectId;
  userRole: string;
  title: string;
  status: "active" | "archived";
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatConversationSchema = new Schema<IChatConversation>(
  {
    userId: { type: String, required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution" },
    userRole: { type: String, required: true },
    title: { type: String, required: true, default: "New Conversation" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const ChatConversation = mongoose.model<IChatConversation>(
  "ChatConversation",
  ChatConversationSchema
);

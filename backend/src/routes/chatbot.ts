// src/routes/chatbot.ts
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth";
import { chatbotUpload } from "../middleware/chatbotUpload";
import { HandbookClause } from "../models/HandbookClause";
import { ChatConversation } from "../models/ChatConversation";
import { ChatMessage } from "../models/ChatMessage";
import {
  detectUserIntent,
  retrieveRelevantClauses,
  resolveUserPortalContext,
  extractAndAnalyzeAttachment,
  generateChatbotResponse,
  checkTopicAllowed,
  resolveContextualQuery,
} from "../services/chatbotService";

const router = Router();

// ── GET /api/chatbot/status ────────────────────────────────────────────────
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const apiKey =
      process.env.AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY;

    const totalClauses = await HandbookClause.countDocuments();

    res.json({
      active: true,
      modelConfigured: Boolean(apiKey),
      provider: process.env.AI_PROVIDER || (apiKey ? "Google Gemini / OpenAI" : "None"),
      model: process.env.AI_MODEL || (apiKey ? "gemini-1.5-flash / gpt-4o-mini" : "APH Grounded Engine"),
      handbookClausesIndexed: totalClauses,
      userRole: session?.role || "UNKNOWN",
    });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch chatbot status", error: err.message });
  }
});

// ── POST /api/chatbot/query ────────────────────────────────────────────────
router.post("/query", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;
    const userRole = session.role;
    const { message, conversationId, clientContext, attachment } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "A message string is required." });
    }

    // 1. Manage Conversation
    let conversation;
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await ChatConversation.findOne({ _id: conversationId, userId });
    }

    if (!conversation) {
      conversation = await ChatConversation.create({
        userId,
        userRole,
        title: message.slice(0, 45) + (message.length > 45 ? "..." : ""),
      });
    }

    // 2. Load previous messages for conversational context
    const previousMessages = conversation
      ? await ChatMessage.find({ conversationId: conversation._id, userId })
          .sort({ createdAt: -1 })
          .limit(6)
      : [];
    const history = previousMessages
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    // 3. Lightweight Intent Detection BEFORE handbook search or LLM calls
    const intentResult = detectUserIntent(message, history);

    // 3a. Handle Pure Greetings (hi, hello, etc.) -> 0 handbook retrieval, 0 citations
    if (intentResult.intent === "GREETING") {
      const greetingReply =
        intentResult.reply || "Hello! How can I help you with AICTE procedures or the portal today?";

      const userMsg = await ChatMessage.create({
        conversationId: conversation._id,
        userId,
        role: "user",
        content: message,
        portalContext: {
          portal: clientContext?.portal || "Portal",
          route: clientContext?.route || "/",
        },
        attachments: attachment ? [attachment] : [],
      });

      const assistantMsg = await ChatMessage.create({
        conversationId: conversation._id,
        userId,
        role: "assistant",
        content: greetingReply,
        citations: [],
        isRefusal: false,
        modelConfigured: true,
        portalContext: {
          portal: clientContext?.portal || "Portal",
          route: clientContext?.route || "/",
          stage: "Greeting",
        },
      });

      conversation.lastMessageAt = new Date();
      await conversation.save();

      return res.json({
        conversationId: conversation._id,
        userMessageId: userMsg._id,
        messageId: assistantMsg._id,
        content: greetingReply,
        citations: [],
        isRefusal: false,
        modelConfigured: true,
      });
    }

    // 3b. Handle Basic Conversation (thank you, okay, bye, etc.) -> 0 handbook retrieval, 0 citations
    if (intentResult.intent === "BASIC_CONVERSATION") {
      const basicReply =
        intentResult.reply || "You're welcome! Let me know if you need any assistance with AICTE procedures or the portal.";

      const userMsg = await ChatMessage.create({
        conversationId: conversation._id,
        userId,
        role: "user",
        content: message,
        portalContext: {
          portal: clientContext?.portal || "Portal",
          route: clientContext?.route || "/",
        },
        attachments: attachment ? [attachment] : [],
      });

      const assistantMsg = await ChatMessage.create({
        conversationId: conversation._id,
        userId,
        role: "assistant",
        content: basicReply,
        citations: [],
        isRefusal: false,
        modelConfigured: true,
        portalContext: {
          portal: clientContext?.portal || "Portal",
          route: clientContext?.route || "/",
          stage: "Conversation",
        },
      });

      conversation.lastMessageAt = new Date();
      await conversation.save();

      return res.json({
        conversationId: conversation._id,
        userMessageId: userMsg._id,
        messageId: assistantMsg._id,
        content: basicReply,
        citations: [],
        isRefusal: false,
        modelConfigured: true,
      });
    }

    // 3c. Handle Unrelated / Off-Topic -> EXACTLY "It is not under my coverage"
    if (intentResult.intent === "UNRELATED" || !intentResult.allowed) {
      const refusalText = "It is not under my coverage";

      const userMsg = await ChatMessage.create({
        conversationId: conversation._id,
        userId,
        role: "user",
        content: message,
        portalContext: {
          portal: clientContext?.portal || "Portal",
          route: clientContext?.route || "/",
        },
        attachments: attachment ? [attachment] : [],
      });

      const assistantMsg = await ChatMessage.create({
        conversationId: conversation._id,
        userId,
        role: "assistant",
        content: refusalText,
        citations: [],
        isRefusal: true,
        modelConfigured: true,
        portalContext: {
          portal: clientContext?.portal || "Portal",
          route: clientContext?.route || "/",
          stage: "Refusal",
        },
      });

      conversation.lastMessageAt = new Date();
      await conversation.save();

      return res.json({
        conversationId: conversation._id,
        userMessageId: userMsg._id,
        messageId: assistantMsg._id,
        content: refusalText,
        citations: [],
        isRefusal: true,
        modelConfigured: true,
      });
    }

    // 4. Save User Message for substantive AICTE inquiry
    const userMsg = await ChatMessage.create({
      conversationId: conversation._id,
      userId,
      role: "user",
      content: message,
      portalContext: {
        portal: clientContext?.portal || "Portal",
        route: clientContext?.route || "/",
      },
      attachments: attachment ? [attachment] : [],
    });

    // 5. Context-aware follow-up resolution and clause retrieval
    const { resolvedQuery } = resolveContextualQuery(message, history);
    const clauses = await retrieveRelevantClauses(resolvedQuery || message, 4);

    // 6. Gather Authenticated Live Portal Context
    const portalContext = await resolveUserPortalContext(session, clientContext);

    // 7. Generate Grounded AI / Dynamic Response with history
    const responsePayload = await generateChatbotResponse({
      userQuery: message,
      portalContext,
      clauses,
      history,
      attachmentData: attachment
        ? {
            filename: attachment.originalName,
            snippet: attachment.extractedSnippet || "",
            findings: attachment.findings || [],
          }
        : undefined,
    });

    // 8. Save Assistant Message
    const assistantMsg = await ChatMessage.create({
      conversationId: conversation._id,
      userId,
      role: "assistant",
      content: responsePayload.content,
      citations: responsePayload.citations,
      isRefusal: responsePayload.isRefusal,
      modelConfigured: responsePayload.modelConfigured,
      portalContext: {
        portal: portalContext.portal,
        route: portalContext.currentRoute,
        stage: portalContext.workflowStage,
        applicationId: portalContext.applicationNumber,
      },
    });

    // Update conversation timestamp
    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.json({
      conversationId: conversation._id,
      userMessageId: userMsg._id,
      messageId: assistantMsg._id,
      content: responsePayload.content,
      citations: responsePayload.citations,
      isRefusal: responsePayload.isRefusal,
      modelConfigured: responsePayload.modelConfigured,
    });
  } catch (err: any) {
    console.error("Chatbot query processing error:", err);
    res.status(500).json({ message: "Internal chatbot processing error", error: err.message });
  }
});

// ── POST /api/chatbot/attach ────────────────────────────────────────────────
router.post(
  "/attach",
  requireAuth,
  chatbotUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No document attached." });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileSize = req.file.size;

      const analysis = await extractAndAnalyzeAttachment(filePath, originalName, mimeType);

      res.json({
        filename: req.file.filename,
        originalName,
        fileType: mimeType,
        fileSize,
        extractedSnippet: analysis.extractedSnippet,
        findings: analysis.findings,
      });
    } catch (err: any) {
      console.error("Chatbot document attachment error:", err);
      res.status(500).json({ message: "Failed to process attached document", error: err.message });
    }
  }
);

// ── GET /api/chatbot/conversations ──────────────────────────────────────────
router.get("/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const conversations = await ChatConversation.find({
      userId: session.userId,
      status: "active",
    })
      .sort({ lastMessageAt: -1 })
      .limit(20);

    res.json({ conversations });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to list conversations", error: err.message });
  }
});

// ── GET /api/chatbot/conversations/:id ──────────────────────────────────────
router.get("/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const conversationId = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      userId: session.userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await ChatMessage.find({ conversationId }).sort({ createdAt: 1 });

    res.json({ conversation, messages });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to load messages", error: err.message });
  }
});

// ── POST /api/chatbot/conversations/new ─────────────────────────────────────
router.post("/conversations/new", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const conversation = await ChatConversation.create({
      userId: session.userId,
      userRole: session.role,
      title: "New Conversation",
    });

    res.json({ conversation });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create conversation", error: err.message });
  }
});

// ── DELETE /api/chatbot/conversations/:id ──────────────────────────────────
router.delete("/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const conversationId = String(req.params.id);

    await ChatMessage.deleteMany({ conversationId, userId: session.userId });
    await ChatConversation.deleteOne({ _id: conversationId, userId: session.userId });

    res.json({ success: true, message: "Conversation deleted" });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to delete conversation", error: err.message });
  }
});

// ── GET /api/chatbot/handbook/search ────────────────────────────────────────
router.get("/handbook/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "");
    const clauses = await retrieveRelevantClauses(q, 10);
    res.json({ count: clauses.length, clauses });
  } catch (err: any) {
    res.status(500).json({ message: "Handbook search error", error: err.message });
  }
});

export default router;

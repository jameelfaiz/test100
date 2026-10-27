"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Send,
  Paperclip,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

interface Citation {
  clauseNumber: string;
  chapter: string;
  year: string;
  pageNumber?: string;
  pdfPageNumber?: string | number;
  title: string;
  excerpt: string;
  requirementType?: string;
}

interface Attachment {
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  extractedSnippet?: string;
  findings?: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  attachment?: Attachment;
  isRefusal?: boolean;
  timestamp: string;
}

interface AicteAssistantProps {
  portalRole: "INSTITUTION" | "AICTE_FD_EMPLOYEE" | "PGRC_EMPLOYEE" | "VIGILANCE_EMPLOYEE";
}

export default function AicteAssistant({ portalRole }: AicteAssistantProps) {
  const pathname = usePathname();

  // ── Window and Visibility State ───────────────────────────────────────────
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [modelConfigured, setModelConfigured] = useState<boolean>(true);
  const [activeClauseDetails, setActiveClauseDetails] = useState<Citation | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>("");

  const getCookieToken = () => {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : "";
  };

  // ── Attachment State ──────────────────────────────────────────────────────
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Drag and Position State ───────────────────────────────────────────────
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });
  const hasMovedRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ── Initial Setup & Position Restore ──────────────────────────────────────
  useEffect(() => {
    // Restore or initialize floating icon coordinates
    const saved = localStorage.getItem("aicte_assistant_icon_pos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const clampedX = Math.min(Math.max(10, parsed.x), window.innerWidth - 70);
          const clampedY = Math.min(Math.max(10, parsed.y), window.innerHeight - 70);
          setPosition({ x: clampedX, y: clampedY });
        }
      } catch (e) {
        // ignore
      }
    }

    if (position.x === -1) {
      setPosition({
        x: Math.max(10, window.innerWidth - 80),
        y: Math.max(10, window.innerHeight - 84),
      });
    }

    // Check backend status
    fetch("/api/chatbot/status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setModelConfigured(Boolean(data.modelConfigured));
        }
      })
      .catch(() => {});

    // Fetch CSRF token
    fetch("/api/auth/csrf-token", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
      })
      .catch(() => {});

    // Restore open state from session
    const savedOpen = sessionStorage.getItem("aicte_assistant_open");
    if (savedOpen === "true") {
      setIsOpen(true);
    }
  }, []);

  // Update bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(Math.max(10, prev.x), window.innerWidth - 70),
        y: Math.min(Math.max(10, prev.y), window.innerHeight - 70),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  // ── Drag Handlers ─────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true;
      const newX = Math.min(Math.max(10, dragStartRef.current.posX + dx), window.innerWidth - 70);
      const newY = Math.min(Math.max(10, dragStartRef.current.posY + dy), window.innerHeight - 70);
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (hasMovedRef.current) {
      localStorage.setItem("aicte_assistant_icon_pos", JSON.stringify(position));
    } else {
      // It was a click, not a drag!
      toggleOpen();
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      sessionStorage.setItem("aicte_assistant_open", String(next));
      if (next) setIsMinimized(false);
      return next;
    });
  };

  // ── Attachment Upload Handler ─────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size exceeds 10MB maximum limit.");
      return;
    }

    setUploadError(null);
    setUploadingAttachment(true);

    const formData = new FormData();
    formData.append("file", file);

    const activeToken = csrfToken || getCookieToken();

    try {
      const res = await fetch("/api/chatbot/attach", {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrf-token": activeToken,
          "X-XSRF-TOKEN": activeToken,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Upload failed");
      }

      const data = await res.json();
      setPendingAttachment({
        filename: data.filename,
        originalName: data.originalName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        extractedSnippet: data.extractedSnippet,
        findings: data.findings,
      });
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload document");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePendingAttachment = () => {
    setPendingAttachment(null);
    setUploadError(null);
  };

  // ── Send Message Handler ──────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text && !pendingAttachment) return;
    if (loading) return;

    const userMessage: Message = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      attachment: pendingAttachment || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    const sentAttachment = pendingAttachment;
    setPendingAttachment(null);
    setLoading(true);

    const activeToken = csrfToken || getCookieToken();

    try {
      const res = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": activeToken,
          "X-XSRF-TOKEN": activeToken,
        },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          conversationId,
          attachment: sentAttachment,
          clientContext: {
            portal: getPortalTitle(portalRole),
            route: pathname,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      setModelConfigured(Boolean(data.modelConfigured));

      const assistantMessage: Message = {
        id: data.messageId || `asst_${Date.now()}`,
        role: "assistant",
        content: data.content,
        citations: data.citations,
        isRefusal: data.isRefusal,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content:
            "⚠️ An error occurred while retrieving official AICTE regulations. Please ensure the backend server is reachable.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setPendingAttachment(null);
    setUploadError(null);
  };

  const getPortalTitle = (role: string) => {
    switch (role) {
      case "INSTITUTION":
        return "Institution Portal";
      case "AICTE_FD_EMPLOYEE":
        return "FD Employee Portal";
      case "PGRC_EMPLOYEE":
        return "PGRC Employee Portal";
      case "VIGILANCE_EMPLOYEE":
        return "Vigilance Employee Portal";
      default:
        return "AICTE Portal";
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Movable Floating Circular Icon ─────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          left: position.x >= 0 ? `${position.x}px` : undefined,
          top: position.y >= 0 ? `${position.y}px` : undefined,
          right: position.x < 0 ? "24px" : undefined,
          bottom: position.y < 0 ? "24px" : undefined,
          zIndex: 9999,
          touchAction: "none",
        }}
        className="select-none"
      >
        <button
          type="button"
          id="aicte-assistant-floating-btn"
          aria-label="Open AICTE AI Assistant"
          title="AICTE AI Assistant (Drag to reposition)"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`w-14 h-14 rounded-full bg-blue-950 text-white shadow-xl flex items-center justify-center border-2 border-amber-400 hover:scale-105 transition-transform duration-150 cursor-grab active:cursor-grabbing relative ${
            isOpen ? "ring-4 ring-blue-500/30" : ""
          }`}
        >
          <Bot size={26} className="text-white drop-shadow" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-blue-950 rounded-full animate-pulse" />
        </button>
      </div>

      {/* ── Compact Chat Panel ────────────────────────────────────────────── */}
      {isOpen && (
        <div
          id="aicte-assistant-panel"
          className="fixed z-[9998] bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden font-sans transition-all duration-150 inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-20 sm:w-[450px] max-w-[calc(100vw-24px)]"
          style={{
            height: isMinimized ? "54px" : "min(600px, calc(100dvh - 96px))",
            maxHeight: "calc(100dvh - 24px)",
          }}
        >
          {/* Header */}
          <div className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between border-b border-blue-900 select-none shrink-0 sticky top-0 z-20 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-800 border border-amber-400/80 flex items-center justify-center">
                <Bot size={18} className="text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-wide flex items-center gap-1.5 leading-tight">
                  <span>AICTE AI Assistant</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-blue-800 text-blue-200 rounded font-mono">
                    APH 24-27
                  </span>
                </div>
                <div className="text-[11px] text-blue-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span>{getPortalTitle(portalRole)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleStartNewChat}
                title="New Chat Conversation"
                className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-md transition"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-md transition"
              >
                {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={toggleOpen}
                title="Close Assistant"
                className="p-1.5 text-blue-200 hover:text-rose-300 hover:bg-blue-900 rounded-md transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Configuration Incomplete Alert (if LLM key missing) */}
              {!modelConfigured && (
                <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-[11px] text-amber-800 flex items-center gap-1.5 shrink-0">
                  <AlertCircle size={13} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>Rule-Grounded Mode:</strong> Answers are retrieved directly from verified AICTE Handbook clauses in MongoDB.
                  </span>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 space-y-3.5 bg-slate-50 text-slate-800 text-xs">
                {messages.length === 0 ? (
                  <div className="text-center py-6 px-3 space-y-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-900 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <Sparkles size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm">
                        Welcome to the AICTE AI Assistant
                      </h4>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        I am your official regulatory assistant, equipped with the complete AICTE Approval Process Handbook (2024–27 & 2023–24).
                      </p>
                    </div>

                    <div className="pt-2 text-left space-y-2">
                      <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        Suggested Inquiries:
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendMessage("What is the AICTE LoA process?")
                        }
                        className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 transition shadow-2xs text-[11px]"
                      >
                        🏛️ What is the AICTE LoA process?
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendMessage("What are the mandatory documents required for approval under Clause 6.1?")
                        }
                        className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 transition shadow-2xs text-[11px]"
                      >
                        📄 Mandatory documents required for LoA / EoA
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendMessage("What are the rules and procedure for Joint FDR release under Clause 6.46?")
                        }
                        className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 transition shadow-2xs text-[11px]"
                      >
                        🏦 Procedure for 10-year Joint FDR release (Clause 6.46)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendMessage("What is my current portal stage and what should I do next?")
                        }
                        className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 transition shadow-2xs text-[11px]"
                      >
                        🧭 What is my current workflow stage & next step?
                      </button>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`w-full flex flex-col min-w-0 ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Attached file card (if user uploaded) */}
                      {msg.attachment && (
                        <div className="mb-1.5 p-2 bg-slate-200 border border-slate-300 rounded-lg text-[11px] max-w-[85%] flex items-center gap-2">
                          <FileText size={16} className="text-blue-900 shrink-0" />
                          <div className="truncate font-medium text-slate-800">
                            {msg.attachment.originalName}
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            ({Math.round(msg.attachment.fileSize / 1024)} KB)
                          </span>
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap min-w-0 shadow-xs ${
                          msg.role === "user"
                            ? "bg-blue-950 text-white rounded-br-xs"
                            : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Regulatory Citations Pills */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 w-full max-w-[92%] space-y-1.5 min-w-0">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <span>📖</span>
                            <span>Verified AICTE Citations:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((c, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveClauseDetails(c)}
                                className="inline-flex items-center gap-1.5 max-w-full text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 font-medium px-2.5 py-1 rounded-md transition shadow-2xs text-left"
                                title={`Click to view: ${c.title}`}
                              >
                                <span className="font-semibold shrink-0">{c.clauseNumber}</span>
                                <span className="text-[10px] text-blue-700 truncate">
                                  (Page {c.pageNumber || "N/A"}{c.pdfPageNumber ? `, PDF ${c.pdfPageNumber}` : ""})
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <span
                        className={`text-[9px] text-slate-400 mt-1 px-1.5 ${
                          msg.role === "user" ? "text-right self-end" : "text-left self-start"
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  ))
                )}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-2 px-1">
                    <div className="w-2 h-2 rounded-full bg-blue-950 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-blue-950 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-blue-950 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                    <span className="text-[11px] text-slate-400 ml-1">
                      Searching official AICTE handbook regulations...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Clause Detail Drawer (if opened) */}
              {activeClauseDetails && (
                <div className="bg-blue-50/90 border-t border-blue-200 p-3 max-h-48 overflow-y-auto text-xs shrink-0 relative animate-in slide-in-from-bottom-2">
                  <button
                    type="button"
                    onClick={() => setActiveClauseDetails(null)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-700"
                  >
                    <X size={14} />
                  </button>
                  <div className="font-bold text-blue-950 pr-5">
                    {activeClauseDetails.clauseNumber}: {activeClauseDetails.title}
                  </div>
                  <div className="text-[10px] text-blue-700 font-medium mt-0.5">
                    {activeClauseDetails.chapter} • Page {activeClauseDetails.pageNumber || "N/A"} •{" "}
                    {activeClauseDetails.year}
                  </div>
                  <div className="mt-1.5 text-slate-700 text-[11px] leading-relaxed">
                    {activeClauseDetails.excerpt}
                  </div>
                  {activeClauseDetails.requirementType && (
                    <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-blue-200 text-blue-900">
                      {activeClauseDetails.requirementType}
                    </span>
                  )}
                </div>
              )}

              {/* Pending Attachment Card */}
              {pendingAttachment && (
                <div className="bg-slate-100 border-t border-slate-200 px-3 py-2 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={16} className="text-blue-950 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">
                      {pendingAttachment.originalName}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      ({Math.round(pendingAttachment.fileSize / 1024)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removePendingAttachment}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded"
                    title="Remove attachment"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="bg-rose-50 border-t border-rose-200 px-3 py-1.5 text-[11px] text-rose-700 flex items-center justify-between shrink-0">
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)}>
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div className="p-2.5 bg-white border-t border-slate-200 shrink-0 sticky bottom-0 z-20">
                <div className="flex items-end gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-blue-900 focus-within:ring-1 focus-within:ring-blue-900">
                  {/* File Attachment Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                    className="hidden"
                  />
                  <button
                    type="button"
                    id="aicte-assistant-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment || loading}
                    title="Attach document (PDF, DOCX, TXT, PNG, JPG - max 10MB)"
                    className="p-1.5 text-slate-500 hover:text-blue-950 hover:bg-slate-200 rounded-lg transition shrink-0 disabled:opacity-40"
                  >
                    <Paperclip size={16} />
                  </button>

                  {/* Text Input */}
                  <textarea
                    rows={1}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      uploadingAttachment
                        ? "Processing document..."
                        : "Ask about handbook rules, LoA/EoA, FDR..."
                    }
                    disabled={loading || uploadingAttachment}
                    className="flex-1 bg-transparent border-0 outline-none resize-none text-xs text-slate-800 placeholder-slate-400 py-1 max-h-24 leading-normal"
                  />

                  {/* Send Button */}
                  <button
                    type="button"
                    id="aicte-assistant-send-btn"
                    onClick={() => handleSendMessage()}
                    disabled={(!inputMessage.trim() && !pendingAttachment) || loading || uploadingAttachment}
                    title="Send message"
                    className="p-1.5 bg-blue-950 text-white rounded-lg hover:bg-blue-900 disabled:opacity-40 disabled:hover:bg-blue-950 transition shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </div>

                <div className="mt-1 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                  <span>AICTE Official Approval Process Assistant</span>
                  <span>•</span>
                  <span>Non-official guidance</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

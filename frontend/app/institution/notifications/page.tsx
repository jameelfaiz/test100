"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  Bell,
  ChevronRight,
  FileCheck,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  RefreshCw,
  X,
  Download,
  FileText,
} from "lucide-react";

const apiBase = "/api";

interface NotificationItem {
  _id?: string;
  id?: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  read?: boolean;
  link?: string;
  metadata?: any;
  applicationId?: string;
  collegeId?: string;
  createdAt?: string;
  date?: string;
}

const TYPE_ICONS: Record<string, any> = {
  DOCUMENT_VERIFIED: FileCheck,
  DOCUMENT_NOT_VERIFIED: XCircle,
  LOA_ISSUED: ShieldCheck,
  EOA_ISSUED: ShieldCheck,
  LOD_ISSUED: ShieldAlert,
  EOD_ISSUED: ShieldAlert,
  DEPOSIT_INSTRUCTIONS: DollarSign,
  DEPOSIT_UPDATED: DollarSign,
  FDR_MATURITY_REMINDER: Bell,
  DEPOSIT_DOCUMENT_VERIFIED: FileCheck,
  DEPOSIT_DOCUMENT_DEFICIENT: XCircle,
  DEPOSIT_VERIFICATION_LETTER: FileCheck,
  RELEASE_APPROVED: ShieldCheck,
  RELEASE_DECLINED: XCircle,
  GENERAL: Bell,
};

const TYPE_COLORS: Record<string, { border: string; bg: string; iconColor: string }> = {
  DOCUMENT_VERIFIED: { border: "border-l-emerald-500", bg: "bg-emerald-50/40", iconColor: "text-emerald-600" },
  DOCUMENT_NOT_VERIFIED: { border: "border-l-rose-500", bg: "bg-rose-50/40", iconColor: "text-rose-600" },
  LOA_ISSUED: { border: "border-l-blue-600", bg: "bg-blue-50/40", iconColor: "text-blue-700" },
  EOA_ISSUED: { border: "border-l-blue-600", bg: "bg-blue-50/40", iconColor: "text-blue-700" },
  LOD_ISSUED: { border: "border-l-amber-500", bg: "bg-amber-50/40", iconColor: "text-amber-600" },
  EOD_ISSUED: { border: "border-l-amber-500", bg: "bg-amber-50/40", iconColor: "text-amber-600" },
  DEPOSIT_INSTRUCTIONS: { border: "border-l-indigo-500", bg: "bg-indigo-50/40", iconColor: "text-indigo-600" },
  DEPOSIT_UPDATED: { border: "border-l-indigo-500", bg: "bg-indigo-50/40", iconColor: "text-indigo-600" },
  FDR_MATURITY_REMINDER: { border: "border-l-amber-500", bg: "bg-amber-50/50", iconColor: "text-amber-700" },
  DEPOSIT_DOCUMENT_VERIFIED: { border: "border-l-emerald-500", bg: "bg-emerald-50/40", iconColor: "text-emerald-600" },
  DEPOSIT_DOCUMENT_DEFICIENT: { border: "border-l-rose-500", bg: "bg-rose-50/40", iconColor: "text-rose-600" },
  DEPOSIT_VERIFICATION_LETTER: { border: "border-l-emerald-500", bg: "bg-emerald-50/40", iconColor: "text-emerald-600" },
  RELEASE_APPROVED: { border: "border-l-emerald-500", bg: "bg-emerald-50/40", iconColor: "text-emerald-600" },
  RELEASE_DECLINED: { border: "border-l-rose-500", bg: "bg-rose-50/40", iconColor: "text-rose-600" },
  GENERAL: { border: "border-l-slate-400", bg: "bg-white", iconColor: "text-slate-600" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string>("");

  // Document preview state for CASE 2 (Verified documents)
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [resolvingDoc, setResolvingDoc] = useState<boolean>(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const loadNotifications = async () => {
    try {
      const [notifRes, csrfRes] = await Promise.all([
        fetch(`${apiBase}/institution/notifications`, { credentials: "include" }),
        fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" }),
      ]);
      if (csrfRes.ok) {
        const csrfData = await csrfRes.json();
        if (csrfData?.csrfToken) setCsrfToken(csrfData.csrfToken);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        const list = Array.isArray(data) ? data : data.notifications || [];
        setNotifications(list);
        const count = typeof data.unreadCount === "number" ? data.unreadCount : list.filter((n: any) => !n.read).length;
        setUnreadCount(count);
        window.dispatchEvent(new CustomEvent("aicte_notifications_updated", { detail: { unreadCount: count } }));
        window.dispatchEvent(new CustomEvent("notificationsUpdated", { detail: { unreadCount: count } }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleNotificationClick = async (n: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const notifId = n._id || n.id;

    // 1. Mark notification as read through existing backend API and persist in MongoDB
    if (notifId && !n.read) {
      try {
        const res = await fetch(`${apiBase}/institution/notifications/${notifId}/read`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": csrfToken,
            "x-csrf-token": csrfToken,
          },
        });
        const resData = res.ok ? await res.json() : null;
        setNotifications((prev) =>
          prev.map((item) => (item._id === notifId || item.id === notifId ? { ...item, read: true } : item))
        );
        const newCount = (resData && typeof resData.unreadCount === "number")
          ? resData.unreadCount
          : Math.max(0, unreadCount - 1);
        setUnreadCount(newCount);
        window.dispatchEvent(new CustomEvent("aicte_notifications_updated", { detail: { unreadCount: newCount } }));
        window.dispatchEvent(new CustomEvent("notificationsUpdated", { detail: { unreadCount: newCount } }));
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    }

    const title = n.title || "";
    const message = n.message || n.body || "";
    const type = n.type || "";

    // Determine Case:
    const isRejectedDoc =
      type === "DOCUMENT_NOT_VERIFIED" ||
      /deficiency|not verified|rejected|requires correction|requires attention/i.test(title) ||
      /requires correction|requires attention|not verified|deficiency/i.test(message);

    const isVerifiedDoc =
      !isRejectedDoc && (
        type === "DOCUMENT_VERIFIED" ||
        /document verified|release document verified/i.test(title) ||
        (/has been verified/i.test(message) && !/deficiency|rejected/i.test(message))
      );

    // CASE 1 — REJECTED / NOT VERIFIED DOCUMENT
    if (isRejectedDoc) {
      let appId = n.applicationId || n.metadata?.releaseRequestId || n.metadata?.applicationId || "";
      let docId = n.metadata?.docId || "";
      let docName = n.metadata?.docName || "";

      if (!docName) {
        const quoteMatch = message.match(/["“']([^"”']+)["”']/);
        if (quoteMatch) docName = quoteMatch[1].trim();
      }
      if (!docName) {
        const dashMatch = title.match(/—\s*([^—\n]+)$/);
        if (dashMatch) docName = dashMatch[1].trim();
      }
      if (!appId) {
        const appMatch = message.match(/application\s+([A-Za-z0-9_-]+)/i);
        if (appMatch) appId = appMatch[1].trim();
      }

      const params = new URLSearchParams();
      if (appId) params.set("appId", appId);
      if (docId) params.set("docId", docId);
      if (docName) params.set("docName", docName);

      const targetUrl = `/institution/receive/complaint-letters${params.toString() ? `?${params.toString()}` : ""}`;
      router.push(targetUrl);
      return;
    }

    // CASE 2 — VERIFIED / APPROVED DOCUMENT
    if (isVerifiedDoc) {
      setResolvingDoc(true);
      setResolveError(null);
      try {
        const params = new URLSearchParams();
        if (notifId) params.set("notifId", notifId);
        if (n.applicationId) params.set("appId", n.applicationId);
        if (n.metadata?.docId) params.set("docId", n.metadata.docId);
        if (n.metadata?.docName) params.set("docName", n.metadata.docName);

        const res = await fetch(`${apiBase}/institution/resolve-document?${params.toString()}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success && data.document) {
          setPreviewDoc(data.document);
        } else {
          setResolveError(data?.message || "Original uploaded document could not be located.");
        }
      } catch (err: any) {
        setResolveError("Failed to retrieve document: " + (err.message || "Network error"));
      } finally {
        setResolvingDoc(false);
      }
      return;
    }

    // CASE 3 — OTHER NOTIFICATION TYPES
    if (type === "LOA_ISSUED" || type === "EOA_ISSUED" || /LoA Issued|EoA Issued/i.test(title)) {
      router.push("/institution/receive/loa-eoa");
      return;
    }
    if (type === "LOD_ISSUED" || type === "EOD_ISSUED" || /LoD Issued|EoD Issued/i.test(title)) {
      router.push("/institution/receive/lod-eod");
      return;
    }
    if (type === "DEPOSIT_INSTRUCTIONS" || type === "DEPOSIT_UPDATED" || /Deposit Instructions/i.test(title)) {
      router.push("/institution/receive/deposit");
      return;
    }
    if (/FDR Verification|FDR Verified/i.test(title)) {
      router.push("/institution/receive/deposit");
      return;
    }
    if (type === "RELEASE_APPROVED" || type === "RELEASE_DECLINED" || /Release Application/i.test(title)) {
      router.push("/institution/submit/release");
      return;
    }

    // Default Fallback
    if (n.link && n.link !== "/institution/dashboard") {
      router.push(n.link);
    } else {
      router.push("/institution/dashboard");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch(`${apiBase}/institution/notifications/read-all`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
          "x-csrf-token": csrfToken,
        },
      });
      if (res.ok) {
        const resData = await res.json();
        const finalCount = typeof resData.unreadCount === "number" ? resData.unreadCount : 0;
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
        setUnreadCount(finalCount);
        window.dispatchEvent(new CustomEvent("aicte_notifications_updated", { detail: { unreadCount: finalCount } }));
        window.dispatchEvent(new CustomEvent("notificationsUpdated", { detail: { unreadCount: finalCount } }));
      } else {
        console.error("Mark all as read failed with status", res.status);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Institution Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time notifications regarding document verification, decision letters, and deposit instructions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition"
            >
              <CheckCheck size={14} /> Mark all as read
            </button>
          )}
          <span className="bg-blue-100 text-blue-900 text-xs font-bold px-3 py-1.5 rounded-full">
            {unreadCount} Unread
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 text-sm">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <div className="text-5xl mb-4">🔔</div>
            <div className="text-slate-700 font-semibold text-base">No notifications yet.</div>
            <div className="text-slate-400 text-sm mt-2">
              Notifications will appear here as soon as an FD employee verifies documents or issues letters.
            </div>
          </div>
        ) : (
          notifications.map((n, i) => {
            const style = TYPE_COLORS[n.type] || TYPE_COLORS.GENERAL;
            const IconComponent = TYPE_ICONS[n.type] || Bell;
            const dateStr = n.createdAt || n.date;

            return (
              <div
                key={n._id || n.id || i}
                onClick={(e) => handleNotificationClick(n, e)}
                className={`bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 ${style.border} px-5 py-4 transition cursor-pointer hover:shadow-md ${
                  !n.read ? style.bg : "bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg bg-white shadow-sm border border-slate-100 shrink-0 ${style.iconColor}`}>
                    <IconComponent size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{n.title}</span>
                        {!n.read && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-600" title="Unread" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {dateStr
                          ? new Date(dateStr).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>

                    <div className="text-sm text-slate-700 mt-1 leading-relaxed">
                      {n.message || n.body}
                    </div>

                    <div
                      onClick={(e) => handleNotificationClick(n, e)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 mt-2.5 hover:underline cursor-pointer group"
                    >
                      <span className="group-hover:text-blue-900">View Details</span>
                      <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Verified Document Preview (CASE 2) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">
                    Original Submitted Document • Verified
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {previewDoc.name}
                </h3>
                {previewDoc.applicationRef && (
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    Application Ref: <span className="font-semibold text-blue-900">{previewDoc.applicationRef}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-100/70 flex items-center justify-center min-h-[360px]">
              {previewDoc.fileName && previewDoc.fileName.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewDoc.fileUrl}
                  className="w-full h-[520px] rounded-lg border border-slate-300 bg-white"
                  title={previewDoc.name}
                />
              ) : previewDoc.fileName && /\.(png|jpe?g|webp)$/i.test(previewDoc.fileName) ? (
                <div className="text-center p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.name}
                    className="max-h-[500px] max-w-full object-contain mx-auto rounded"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm max-w-md">
                  <FileText size={48} className="text-emerald-600 mx-auto mb-3" />
                  <p className="font-bold text-slate-800 text-sm">{previewDoc.name}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Original File: {previewDoc.fileName}
                  </p>
                  <a
                    href={previewDoc.fileUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#152843] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition"
                  >
                    <Download size={14} /> Download Document
                  </a>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
              {previewDoc.fileUrl ? (
                <a
                  href={previewDoc.fileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#152843] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition"
                >
                  <Download size={14} /> Download Original Document
                </a>
              ) : <div />}
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal while Locating Document */}
      {resolvingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-sm w-full text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto" />
            <div className="text-sm font-bold text-slate-800">Locating Original Document...</div>
            <p className="text-xs text-slate-500">
              Retrieving the authentic uploaded document for preview.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert Modal if Document not located */}
      {resolveError && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                <XCircle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">Document Could Not Be Located</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {resolveError}
                </p>
              </div>
            </div>
            <div className="text-right">
              <button
                onClick={() => setResolveError(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

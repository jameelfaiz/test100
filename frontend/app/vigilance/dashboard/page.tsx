"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Search,
  Clock,
  Eye,
  X,
  RefreshCw,
  XCircle,
  FileText,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import LogoutModal from "../../components/LogoutModal";

interface ComplaintItem {
  _id: string;
  complaintReference: string;
  institutionId: string;
  collegeId?: string;
  institutionName?: string;
  complainantName?: string;
  complainantEmail?: string;
  complainant?: {
    name?: string;
    email?: string;
    mobile?: string;
    phone?: string;
  };
  category: string;
  title?: string;
  subject?: string;
  description: string;
  status: "NEW" | "INVESTIGATION" | "PROVEN" | "UNPROVEN" | "PENDING" | "UNDER_INVESTIGATION" | "NOT_PROVEN" | "ON_PROCESS" | "OPEN";
  reason?: string;
  publicStatusMessage?: string;
  attachments?: Array<{
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
  }>;
  evidencePath?: string;
  decisionBy?: string;
  decisionAt?: string;
  statusHistory?: Array<{ status: string; reason: string; updatedBy: string; updatedAt: string }>;
  createdAt: string;
  updatedAt: string;
}

type TabKey = "NEW" | "INVESTIGATION" | "PROVEN" | "UNPROVEN" | "ALL";

export default function VigilanceDashboardPage() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabKey>("NEW");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [previewComplaint, setPreviewComplaint] = useState<ComplaintItem | null>(null);

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<"PROVEN" | "UNPROVEN" | "INVESTIGATION" | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [logoutLoading, setLogoutLoading] = useState<boolean>(false);
  const [authVerified, setAuthVerified] = useState<boolean>(false);

  // Fetch CSRF Token
  const fetchCsrf = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/csrf-token", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    } catch (e) {
      console.error("Failed to fetch CSRF token", e);
    }
    return "";
  }, []);

  // Fetch Complaints from Live MongoDB
  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vigilance/complaints", { credentials: "include" });
      if (res.status === 401) {
        window.location.replace("/");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setComplaints(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.error("Error loading Vigilance complaints:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          window.location.replace("/");
          return;
        }
        const data = await res.json();
        if (data.role !== "VIGILANCE_EMPLOYEE" && data.role !== "VIGILANCE_SUPERVISOR") {
          window.location.replace("/");
          return;
        }
        setAuthVerified(true);
      } catch {
        window.location.replace("/");
        return;
      }
      fetchCsrf();
      loadComplaints();
    };
    checkAuth();
  }, [fetchCsrf, loadComplaints]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-XSRF-TOKEN": csrfToken,
          "x-csrf-token": csrfToken,
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setShowLogoutModal(false);
      setLogoutLoading(false);
      setAuthVerified(false);
      window.location.replace("/");
    }
  };


  // Open Decision Prompt
  const handleOpenDecisionPrompt = (decision: "PROVEN" | "UNPROVEN" | "INVESTIGATION") => {
    setSelectedDecision(decision);
    setDecisionReason("");
    setConfirmed(false);
    setDecisionModalOpen(true);
  };

  // Submit Manual Decision
  const handleSaveDecision = async () => {
    if (!previewComplaint || !selectedDecision) return;
    if (!decisionReason.trim()) {
      setFeedbackMsg({ type: "error", text: "A decision cause/reason is strictly mandatory." });
      return;
    }
    if (!confirmed) {
      setFeedbackMsg({ type: "error", text: "Please confirm that this is your deliberate official manual decision." });
      return;
    }

    setDecisionLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/vigilance/complaint/${previewComplaint._id}/decision`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({
          decision: selectedDecision,
          reason: decisionReason.trim(),
          confirm: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save decision");
      }

      setFeedbackMsg({
        type: "success",
        text: `Vigilance manual decision recorded: Marked as ${selectedDecision}. Automatically synchronized with FD clearance portal.`,
      });
      setDecisionModalOpen(false);
      setPreviewComplaint(null);
      await loadComplaints();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to record decision" });
    } finally {
      setDecisionLoading(false);
    }
  };

  // Counts
  const counts = useMemo(() => {
    return {
      NEW: complaints.filter((c) => c.status === "NEW" || c.status === "PENDING" || c.status === "OPEN").length,
      INVESTIGATION: complaints.filter(
        (c) => c.status === "INVESTIGATION" || c.status === "UNDER_INVESTIGATION" || c.status === "ON_PROCESS"
      ).length,
      PROVEN: complaints.filter((c) => c.status === "PROVEN").length,
      UNPROVEN: complaints.filter(
        (c) => c.status === "UNPROVEN" || c.status === "NOT_PROVEN"
      ).length,
      ALL: complaints.length,
    };
  }, [complaints]);

  // Filter complaints for display
  const displayedComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        (c.complaintReference || "").toLowerCase().includes(term) ||
        (c.institutionName || "").toLowerCase().includes(term) ||
        (c.collegeId || "").toLowerCase().includes(term) ||
        (c.description || "").toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (activeTab === "NEW") {
        return c.status === "NEW" || c.status === "PENDING" || c.status === "OPEN";
      }
      if (activeTab === "INVESTIGATION") {
        return (
          c.status === "INVESTIGATION" ||
          c.status === "UNDER_INVESTIGATION" ||
          c.status === "ON_PROCESS"
        );
      }
      if (activeTab === "PROVEN") {
        return c.status === "PROVEN";
      }
      if (activeTab === "UNPROVEN") {
        return c.status === "UNPROVEN" || c.status === "NOT_PROVEN";
      }
      return true;
    });
  }, [complaints, activeTab, searchTerm]);

  const renderBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "PROVEN") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
          <XCircle size={12} /> Proven
        </span>
      );
    }
    if (s === "UNPROVEN" || s === "NOT_PROVEN") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={12} /> Unproven
        </span>
      );
    }
    if (s === "INVESTIGATION" || s === "UNDER_INVESTIGATION" || s === "ON_PROCESS") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <Clock size={12} /> Investigation
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-300">
        <Inbox size={12} /> New
      </span>
    );
  };

  if (!authVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-300">Verifying authorized vigilance session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between shadow-sm">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0f2942] text-amber-400 flex items-center justify-center font-bold text-lg shadow-sm">
            🛡️
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#0f2942] tracking-tight leading-tight">
              AICTE Chief Vigilance Division (CVD)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Employee Dashboard • Anti-Corruption & Financial Integrity Review
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-800">Vigilance Officer</div>
            <div className="text-[11px] text-slate-500 font-mono">Role: VIGILANCE_EMPLOYEE</div>
          </div>
          <button
            onClick={loadComplaints}
            title="Refresh Complaints"
            className="p-2 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs px-3.5 py-2 rounded-lg border border-rose-200 transition shadow-sm"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Navy-Blue Left Sidebar (Module 4 Requirements) */}
        <aside className="w-64 bg-[#0f2942] text-slate-200 flex flex-col shrink-0 select-none shadow-md sticky top-[65px] h-[calc(100vh-65px)] justify-between">
          <div>
            <div className="p-4 border-b border-white/10 shrink-0">
              <span className="text-xs font-semibold tracking-wider uppercase text-amber-300">
                Vigilance Complaints
              </span>
            </div>

            <nav className="p-3 space-y-1.5 text-sm font-medium">
              {/* 1. New Complaints */}
              <button
                id="sidebar-vig-new"
                onClick={() => setActiveTab("NEW")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition text-left ${
                  activeTab === "NEW"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "hover:bg-white/10 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Inbox size={18} />
                  <span>New Complaints</span>
                </div>
                <span className="text-xs bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full">
                  {counts.NEW}
                </span>
              </button>

              {/* 2. Investigation */}
              <button
                id="sidebar-vig-investigation"
                onClick={() => setActiveTab("INVESTIGATION")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition text-left ${
                  activeTab === "INVESTIGATION"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "hover:bg-white/10 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock size={18} />
                  <span>Investigation</span>
                </div>
                <span className="text-xs bg-amber-400 text-amber-950 font-extrabold px-2 py-0.5 rounded-full">
                  {counts.INVESTIGATION}
                </span>
              </button>

              {/* 3. Proven */}
              <button
                id="sidebar-vig-proven"
                onClick={() => setActiveTab("PROVEN")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition text-left ${
                  activeTab === "PROVEN"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "hover:bg-white/10 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <XCircle size={18} />
                  <span>Proven</span>
                </div>
                <span className="text-xs bg-rose-400 text-rose-950 font-extrabold px-2 py-0.5 rounded-full">
                  {counts.PROVEN}
                </span>
              </button>

              {/* 4. Unproven */}
              <button
                id="sidebar-vig-unproven"
                onClick={() => setActiveTab("UNPROVEN")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition text-left ${
                  activeTab === "UNPROVEN"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "hover:bg-white/10 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} />
                  <span>Unproven</span>
                </div>
                <span className="text-xs bg-emerald-400 text-emerald-950 font-extrabold px-2 py-0.5 rounded-full">
                  {counts.UNPROVEN}
                </span>
              </button>

              {/* All Complaints */}
              <button
                id="sidebar-vig-all"
                onClick={() => setActiveTab("ALL")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition text-left mt-3 border-t border-white/10 pt-3 ${
                  activeTab === "ALL"
                    ? "bg-blue-600 text-white font-semibold"
                    : "hover:bg-white/10 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} />
                  <span>All Complaints</span>
                </div>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{counts.ALL}</span>
              </button>
            </nav>
          </div>

          <div className="p-3 border-t border-white/10 text-center shrink-0 bg-black/15">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white py-2.5 rounded-lg text-sm font-semibold border border-rose-500/25 transition shadow-sm"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </aside>

        {/* Main Page Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {feedbackMsg && (
            <div
              className={`mb-6 p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}
            >
              <div className="text-sm font-semibold flex items-center gap-2">
                {feedbackMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {feedbackMsg.text}
              </div>
              <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Header & Search */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h2 className="font-extrabold text-[#0f2942] text-lg">
                  {activeTab === "NEW" && "New Vigilance Complaints (Awaiting Review)"}
                  {activeTab === "INVESTIGATION" && "Active Vigilance Inquiries"}
                  {activeTab === "PROVEN" && "Proven Financial Misconduct / Corruption"}
                  {activeTab === "UNPROVEN" && "Unproven Allegations (Exonerated)"}
                  {activeTab === "ALL" && "All Vigilance Complaints"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Showing {displayedComplaints.length} records retrieved from MongoDB database. All decisions are manually governed.
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search complaint ID, institution..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>

            {/* Table (Complaint ID | Institution Name | Submitted Date | Current Status | Action: Preview) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-5">Complaint ID</th>
                    <th className="py-3.5 px-5">Institution Name</th>
                    <th className="py-3.5 px-5">Submitted Date</th>
                    <th className="py-3.5 px-5">Current Status</th>
                    <th className="py-3.5 px-5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-sm font-medium">
                        No records available.
                      </td>
                    </tr>
                  ) : (

                    displayedComplaints.map((c) => (
                      <tr key={c._id} className="hover:bg-blue-50/40 transition">
                        <td className="py-3.5 px-5 font-mono font-bold text-blue-900">
                          {c.complaintReference || `VIG-${c._id.slice(-6)}`}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          {c.institutionName || "Registered Technical Institution"}
                          {c.collegeId && (
                            <span className="block font-mono text-[11px] text-slate-500 font-normal">
                              ID: {c.collegeId}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600">
                          {new Date(c.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-5">
                          {renderBadge(c.status)}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <button
                            id={`preview-btn-${c._id}`}
                            onClick={() => setPreviewComplaint(c)}
                            className="inline-flex items-center gap-1.5 bg-[#0f2942] hover:bg-[#1a3d61] text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition"
                          >
                            <Eye size={13} /> Preview
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* PREVIEW MODAL (Module 4 Requirements) */}
      {previewComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-extrabold block">
                  Vigilance Case Review
                </span>
                <h3 className="text-base font-bold text-[#0f2942] font-mono">
                  {previewComplaint.complaintReference || previewComplaint._id}
                </h3>
              </div>
              <button
                onClick={() => setPreviewComplaint(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {/* Complainant Particulars */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0f2942] mb-3 flex items-center gap-1.5">
                  <ShieldCheck size={15} /> Complainant Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Complainant Full Name:</span>
                    <strong className="text-slate-900 text-sm">
                      {previewComplaint.complainantName || previewComplaint.complainant?.name || "Public Citizen"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email ID:</span>
                    <strong className="text-slate-900 text-sm font-mono">
                      {previewComplaint.complainantEmail || previewComplaint.complainant?.email || "—"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Institution Details & Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block">Institution Name</span>
                  <span className="font-semibold text-slate-900">{previewComplaint.institutionName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Submission Date</span>
                  <span className="text-slate-800 font-medium">
                    {new Date(previewComplaint.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Current Status</span>
                  <div className="mt-1">{renderBadge(previewComplaint.status)}</div>
                </div>
              </div>

              {/* Full Complaint Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Full Allegation / Complaint Description
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {previewComplaint.description}
                  </p>
                </div>
              </div>

              {/* Submitted Supporting Documents */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Submitted Supporting Evidence / Documents
                </h4>
                {previewComplaint.attachments && previewComplaint.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {previewComplaint.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-blue-700" />
                          <span className="font-semibold text-blue-950">{att.originalName}</span>
                          <span className="text-slate-500">
                            ({att.fileSize ? Math.round(att.fileSize / 1024) + " KB" : "Document"})
                          </span>
                        </div>
                        <a
                          href={`/api/public/files/${att.fileName}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-xs hover:underline"
                        >
                          View Document <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : previewComplaint.evidencePath ? (
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs flex items-center justify-between">
                    <span className="font-mono text-slate-700">{previewComplaint.evidencePath}</span>
                    <a
                      href={`/api/public/files/${previewComplaint.evidencePath.split("/").pop()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold"
                    >
                      View <ExternalLink size={12} />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                    No supporting documents uploaded with this complaint.
                  </p>
                )}
              </div>

              {/* Prior Decision or Remarks if any */}
              {previewComplaint.reason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <span className="font-bold text-amber-900 uppercase block mb-1">
                    Recorded Finding Cause / Remarks:
                  </span>
                  <p className="text-amber-950">{previewComplaint.reason}</p>
                  {previewComplaint.decisionBy && (
                    <span className="text-[11px] text-amber-800 mt-1 block">
                      Recorded by: {previewComplaint.decisionBy} on{" "}
                      {previewComplaint.decisionAt ? new Date(previewComplaint.decisionAt).toLocaleString() : ""}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* THREE HORIZONTAL DECISION BUTTONS (Side by side on desktop, wrapping cleanly on mobile) */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Official Manual Decision:
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. Investigation Button */}
                <button
                  id="btn-decision-investigation"
                  onClick={() => handleOpenDecisionPrompt("INVESTIGATION")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition active:scale-95"
                >
                  <Clock size={15} /> Investigation
                </button>

                {/* 2. Proven Button */}
                <button
                  id="btn-decision-proven"
                  onClick={() => handleOpenDecisionPrompt("PROVEN")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition active:scale-95"
                >
                  <XCircle size={15} /> Proven
                </button>

                {/* 3. Unproven Button */}
                <button
                  id="btn-decision-unproven"
                  onClick={() => handleOpenDecisionPrompt("UNPROVEN")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition active:scale-95"
                >
                  <CheckCircle2 size={15} /> Unproven
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION & MANDATORY REASON MODAL */}
      {decisionModalOpen && previewComplaint && selectedDecision && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                {selectedDecision === "PROVEN" && <span className="text-rose-600">Mark Allegation as PROVEN</span>}
                {selectedDecision === "UNPROVEN" && <span className="text-emerald-600">Mark Allegation as UNPROVEN</span>}
                {selectedDecision === "INVESTIGATION" && <span className="text-amber-600">Mark Under VIGILANCE INVESTIGATION</span>}
              </h3>
              <button onClick={() => setDecisionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              You are about to record an official manual vigilance decision for complaint{" "}
              <strong className="font-mono text-blue-900">{previewComplaint.complaintReference || previewComplaint._id}</strong>{" "}
              against <strong>{previewComplaint.institutionName}</strong>. A mandatory reason/cause and explicit confirmation are required.
            </p>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Reason / Cause for Decision *
              </label>
              <textarea
                id="input-vig-decision-reason"
                rows={4}
                placeholder="State the official vigilance findings, audit cause, or inquiry basis for this decision..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              />
            </div>

            <div className="mb-5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800">
                <input
                  id="chk-confirm-vig-decision"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <strong>I explicitly confirm this official manual decision.</strong> I understand this action updates the official MongoDB complaint record, records audit logging, and synchronizes status with the AICTE Finance Division (FD).
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-save-vig-decision"
                type="button"
                onClick={handleSaveDecision}
                disabled={!decisionReason.trim() || !confirmed || decisionLoading}
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition shadow-sm ${
                  selectedDecision === "PROVEN"
                    ? "bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300"
                    : selectedDecision === "UNPROVEN"
                    ? "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300"
                    : "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
                }`}
              >
                {decisionLoading ? "Saving..." : "Save Official Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={logoutLoading}
      />
    </div>
  );
}

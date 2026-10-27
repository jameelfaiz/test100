"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileCheck,
  Landmark,
  FileOutput,
  HeartPulse,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Eye,
  FileText,
  Check,
  XCircle,
  AlertTriangle,
  Download,
  Printer,
  Info,
  CheckCircle2,
  DollarSign,
  Search,
  Send,
  Building,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import "../fd-portal.css";
import LogoutModal from "../../components/LogoutModal";

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n || 0);
const fmtCurrency = (n: number) => `₹${fmt(n)}`;
const fmtDate = (d: any) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateTime = (d: any) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Verified: "badge-success",
    Active: "badge-success",
    Approved: "badge-success",
    APPROVED: "badge-success",
    VERIFIED: "badge-success",
    Pending: "badge-warning",
    PENDING: "badge-warning",
    PENDING_VERIFICATION: "badge-warning",
    SUBMITTED: "badge-warning",
    UNDER_REVIEW: "badge-warning",
    "Not Verified": "badge-danger",
    Declined: "badge-danger",
    Rejected: "badge-danger",
    REJECTED: "badge-danger",
  };
  return `badge ${map[status] || "badge-neutral"}`;
};

const renderComplianceBadge = (status: string) => {
  const s = (status || "").toUpperCase();
  if (s === "REJECTED") {
    return <span className="badge badge-danger" style={{ fontWeight: 700 }}>REJECTED</span>;
  }
  if (s === "ON PROCESS") {
    return <span className="badge badge-warning" style={{ fontWeight: 700 }}>ON PROCESS</span>;
  }
  if (s === "VERIFIED") {
    return <span className="badge badge-success" style={{ fontWeight: 700 }}>VERIFIED</span>;
  }
  if (s === "PENDING") {
    return <span className="badge" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 700 }}>PENDING</span>;
  }
  return <span className="badge badge-neutral" style={{ fontWeight: 600 }}>NO COMPLAINTS</span>;
};

// ── Sidebar Navigation ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "approval-applications", label: "Approval Seeking Applications", icon: FileCheck },
  { id: "deposit-records", label: "Deposit Records", icon: Landmark },
  { id: "release-applications", label: "Release Applications", icon: FileOutput },
];

export default function FDEmployeePortal() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<string>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>("");

  // Server data from MongoDB
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [complianceList, setComplianceList] = useState<any[]>([]);
  const [aliveData, setAliveData] = useState<{ aliveFdrs: any[]; aliveCount: number; aliveTotalAmount: number }>({
    aliveFdrs: [],
    aliveCount: 0,
    aliveTotalAmount: 0,
  });
  const [releaseRequests, setReleaseRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<{
    approvalApplications: number;
    depositRecords: number;
    releaseApplications: number;
    maturityReminders: number;
  }>({
    approvalApplications: 0,
    depositRecords: 0,
    releaseApplications: 0,
    maturityReminders: 0,
  });
  const [maturityModalData, setMaturityModalData] = useState<any | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [logoutLoading, setLogoutLoading] = useState<boolean>(false);

  // Fetch CSRF token
  const fetchCsrf = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/csrf-token", { credentials: "include" });
      const data = await res.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    } catch (e) {
      console.error("Failed to fetch CSRF token", e);
    }
    return "";
  }, []);

  // API Call Helpers
  const apiGet = useCallback(async (path: string) => {
    const res = await fetch(path, { credentials: "include" });
    if (res.status === 401) {
      window.location.replace("/");
      throw new Error("Unauthorized");
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }, []);

  const apiPost = useCallback(
    async (path: string, body: any) => {
      let token = csrfToken;
      if (!token) token = await fetchCsrf();

      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": token,
          "x-csrf-token": token,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action failed");
      return data;
    },
    [csrfToken, fetchCsrf]
  );

  // Manual Sync for Compliance Status
  const handleSyncCompliance = useCallback(async () => {
    try {
      const data = await apiGet("/api/fd/compliance-status");
      setComplianceList(Array.isArray(data) ? data : []);
      setActionMessage({ type: "success", text: "Complaint clearance statuses successfully synchronized with MongoDB." });
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to synchronize complaint statuses" });
    }
  }, [apiGet]);

  // Load all data from MongoDB
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        apiGet("/api/fd/dashboard"),
        apiGet("/api/fd/applications"),
        apiGet("/api/fd/deposits"),
        apiGet("/api/fd/alive-records"),
        apiGet("/api/fd/release-applications"),
        apiGet("/api/fd/notifications"),
        apiGet("/api/fd/compliance-status"),
        apiGet("/api/fd/badge-counts"),
      ]);

      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setApplications(results[1].value);
      if (results[2].status === "fulfilled") setDeposits(results[2].value);
      if (results[3].status === "fulfilled") setAliveData(results[3].value);
      if (results[4].status === "fulfilled") setReleaseRequests(results[4].value);
      if (results[5].status === "fulfilled") setNotifications(results[5].value);
      if (results[6].status === "fulfilled") setComplianceList(results[6].value);
      if (results[7].status === "fulfilled" && results[7].value) setBadgeCounts(results[7].value);
    } catch (err: any) {
      console.error("Failed loading portal data:", err);
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          window.location.replace("/");
          return;
        }
        const data = await res.json();
        if (data.role !== "AICTE_FD_EMPLOYEE") {
          window.location.replace("/");
          return;
        }
      } catch {
        window.location.replace("/");
        return;
      }
      fetchCsrf();
      loadAllData();
    };
    checkAuth();

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        checkAuth();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [fetchCsrf, loadAllData]);

  // Logout handler
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await apiPost("/api/auth/logout", {});
    } catch {
      // ignore
    } finally {
      setShowLogoutModal(false);
      setLogoutLoading(false);
      window.location.replace("/");
    }
  };

  const unreadNotifCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const navigate = (page: string) => {
    setActivePage(page);
    setMobileNavOpen(false);
    setActionMessage(null);
  };

  const currentNav =
    NAV_ITEMS.find((n) => n.id === activePage) ||
    (activePage === "compliance-screening" ? { label: "Complaint Screening & Letters" } : activePage === "alive-records" ? { label: "Alive Records" } : { label: "Dashboard" });

  return (
    <div className="fd-portal-root">
      <div className="portal-layout">
        {/* Mobile backdrop */}
        {mobileNavOpen && <div className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} />}

        {/* Sidebar — EXACTLY 5 items */}
        <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
          <div className="sidebar-brand">
            <h2>AICTE FD Shield</h2>
            <p>Finance Bureau Portal</p>
          </div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              let badgeCount = 0;
              if (item.id === "approval-applications") badgeCount = badgeCounts.approvalApplications;
              if (item.id === "deposit-records") badgeCount = badgeCounts.depositRecords;
              if (item.id === "release-applications") badgeCount = badgeCounts.releaseApplications;

              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  className={`nav-item ${activePage === item.id ? "active" : ""}`}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={18} />
                  <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      id={`badge-${item.id}`}
                      className="sidebar-badge-count"
                      title={`${badgeCount} new unreviewed submission${badgeCount > 1 ? "s" : ""}`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <button
              type="button"
              id="fd-sidebar-logout-btn"
              className="logout-btn"
              onClick={() => setShowLogoutModal(true)}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-content">
          <header className="header">
            <div className="header-left">
              <button className="hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
                {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
              <div className="breadcrumb">
                AICTE FD Employee Portal <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
                <span>{currentNav?.label || "Dashboard"}</span>
              </div>
            </div>
            <div className="header-right">
              {/* Refresh data button */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadAllData}
                title="Refresh latest MongoDB data"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span>Sync</span>
              </button>

              {/* Notification Bell with Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  className="notification-bell"
                  onClick={() => setNotifOpen(!notifOpen)}
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unreadNotifCount > 0 && <span className="notification-badge">{unreadNotifCount}</span>}
                </button>
                {notifOpen && (
                  <NotificationDropdown
                    notifications={notifications}
                    onClose={() => setNotifOpen(false)}
                    onOpenMaturityModal={(notif) => {
                      setNotifOpen(false);
                      setMaturityModalData(notif);
                    }}
                    onNavigate={(page) => {
                      setNotifOpen(false);
                      navigate(page);
                    }}
                    onMarkRead={(id) => {
                      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
                    }}
                    onMarkAllRead={() => {
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                  />
                )}
              </div>
            </div>
          </header>

          <main className="page-content">
            {actionMessage && (
              <div className={`msg-${actionMessage.type}`} style={{ marginBottom: 16 }}>
                {actionMessage.text}
              </div>
            )}

            {/* Page Router */}
            {activePage === "dashboard" && (
              <DashboardView
                stats={stats}
                aliveCount={aliveData.aliveCount}
                aliveAmount={aliveData.aliveTotalAmount}
                navigate={navigate}
              />
            )}

            {activePage === "approval-applications" && (
              <ApprovalApplicationsView
                applications={applications}
                complianceList={complianceList}
                apiPost={apiPost}
                onReload={loadAllData}
                setMessage={setActionMessage}
              />
            )}

            {activePage === "deposit-records" && (
              <DepositRecordsView
                deposits={deposits}
                apiPost={apiPost}
                onReload={loadAllData}
                setMessage={setActionMessage}
              />
            )}

            {activePage === "alive-records" && (
              <AliveRecordsView
                aliveFdrs={aliveData.aliveFdrs}
                aliveCount={aliveData.aliveCount}
                aliveTotalAmount={aliveData.aliveTotalAmount}
                navigate={navigate}
              />
            )}

            {activePage === "release-applications" && (
              <ReleaseApplicationsView
                releaseRequests={releaseRequests}
                apiPost={apiPost}
                onReload={loadAllData}
                setMessage={setActionMessage}
              />
            )}

            {activePage === "compliance-screening" && (
              <ComplianceScreeningView
                complianceList={complianceList}
                onSync={handleSyncCompliance}
                apiPost={apiPost}
                setMessage={setActionMessage}
              />
            )}
          </main>
        </div>
      </div>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={logoutLoading}
      />

      {maturityModalData && (
        <MaturityReminderModal
          data={maturityModalData}
          onClose={() => setMaturityModalData(null)}
          apiPost={apiPost}
          onSuccess={(msg) => {
            setActionMessage({ type: "success", text: msg });
            loadAllData();
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  NOTIFICATION DROPDOWN
// ══════════════════════════════════════════════════════════════════════
function NotificationDropdown({
  notifications,
  onClose,
  onOpenMaturityModal,
  onNavigate,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: any[];
  onClose: () => void;
  onOpenMaturityModal: (n: any) => void;
  onNavigate: (page: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const recent = notifications.slice(0, 10);

  return (
    <div className="notification-dropdown">
      <div className="notif-header">
        <h4>Employee Alerts & FDR Reminders</h4>
        <button className="notif-mark-all" onClick={onMarkAllRead}>
          Mark all read
        </button>
      </div>
      <div className="notif-list">
        {recent.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: ".875rem" }}>
            No active alerts
          </div>
        ) : (
          recent.map((n) => {
            const isMaturity = n.type === "maturity_reminder";
            return (
              <div
                key={n.id}
                className={`notif-item ${!n.read ? "unread" : ""} ${isMaturity ? "maturity" : ""}`}
                onClick={() => {
                  onMarkRead(n.id);
                  if (isMaturity) {
                    onOpenMaturityModal(n);
                  } else if (n.type === "application") {
                    onNavigate("approval-applications");
                  } else if (n.type === "deposit") {
                    onNavigate("deposit-records");
                  } else if (n.type === "release") {
                    onNavigate("release-applications");
                  }
                }}
              >
                <div className={`notif-dot ${n.read ? "read" : ""}`} />
                <div className="notif-item-content">
                  <div className="notif-item-title" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span>{n.title}</span>
                    {isMaturity && (
                      <span className={`maturity-pill ${n.daysRemaining <= 7 ? "urgent" : ""}`}>
                        {n.daysRemaining === 0 ? "Due Today" : `${n.daysRemaining}d left`}
                      </span>
                    )}
                    {n.hasLetter && (
                      <span className="badge badge-success" style={{ fontSize: ".65rem", padding: "1px 5px" }}>
                        Letter Sent
                      </span>
                    )}
                  </div>
                  <div className="notif-item-detail">{n.detail}</div>
                  <div className="notif-item-date">{fmtDateTime(n.date)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="notif-footer">
        <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>AICTE FDR Division Notifications</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  MATURITY REMINDER MODAL (GENERATE & SEND LETTER WITH CONFIRMATION)
// ══════════════════════════════════════════════════════════════════════
function MaturityReminderModal({
  data,
  onClose,
  apiPost,
  onSuccess,
}: {
  data: any;
  onClose: () => void;
  apiPost: (url: string, body: any) => Promise<any>;
  onSuccess: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [letterData, setLetterData] = useState<any | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [forceResend, setForceResend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate preview on open
  useEffect(() => {
    async function gen() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiPost(`/api/fd/deposit/${data.fdrId || data.id}/generate-maturity-letter`, {});
        setLetterData(res);
      } catch (err: any) {
        setError(err.message || "Failed to generate reminder letter preview");
      } finally {
        setLoading(false);
      }
    }
    gen();
  }, [data, apiPost]);

  const handleSend = async () => {
    if (!confirmed) {
      setError("Please check the confirmation box before sending the letter.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost(`/api/fd/deposit/${data.fdrId || data.id}/send-maturity-letter`, {
        confirmed: true,
        forceResend,
        letterContent: letterData?.letterText,
      });
      onSuccess(res.message || "Maturity reminder letter dispatched successfully.");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to send reminder letter");
    } finally {
      setLoading(false);
    }
  };

  const isUrgent = data.daysRemaining <= 7;
  const hasPrevious = Boolean(letterData?.previousLetter?.sentDate || data.lastLetter?.sentDate);
  const prevDate = letterData?.previousLetter?.sentDate || data.lastLetter?.sentDate;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>🔔</span>
            <div>
              <h3>AICTE Statutory FDR Maturity Reminder</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                Formal Regulatory Notice & Reminder Letter Dispatch
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div className="msg-error">{error}</div>}

          {/* FDR & Institution Snapshot */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, padding: 14, background: "var(--bg-page)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: ".72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Institution</div>
              <div style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--navy)" }}>{data.institutionName}</div>
              <div style={{ fontSize: ".75rem", color: "var(--text-secondary)" }}>ID: {data.collegeId}</div>
            </div>
            <div>
              <div style={{ fontSize: ".72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>FDR Reference & Bank</div>
              <div style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--text-primary)" }}>{data.fdrReference || data.fdrNumber}</div>
              <div style={{ fontSize: ".75rem", color: "var(--text-secondary)" }}>{data.bankName} — ₹{new Intl.NumberFormat("en-IN").format(data.amount || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: ".72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Maturity Due Date</div>
              <div style={{ fontSize: ".875rem", fontWeight: 700, color: isUrgent ? "#dc2626" : "#b45309" }}>
                {new Date(data.maturityDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <span className={`maturity-pill ${isUrgent ? "urgent" : ""}`}>
                {data.daysRemaining === 0 ? "Matures Today" : `${data.daysRemaining} Days Remaining`}
              </span>
            </div>
          </div>

          {/* Previous letter notice if already sent */}
          {hasPrevious && (
            <div style={{ padding: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "var(--radius-sm)", fontSize: ".8rem", color: "#065f46", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <strong>✓ Letter Already Dispatched:</strong> Sent on {new Date(prevDate).toLocaleDateString("en-IN")}. Ref: {letterData?.previousLetter?.letterRef || "AICTE/FD/REMINDER"}
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ".75rem", cursor: "pointer", color: "#047857" }}>
                <input type="checkbox" checked={forceResend} onChange={(e) => setForceResend(e.target.checked)} />
                <span>Force re-dispatch</span>
              </label>
            </div>
          )}

          {/* Delivery Channel Status */}
          <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "var(--radius-sm)", fontSize: ".8rem" }}>
            <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Delivery Channel Verification:</div>
            <div style={{ color: "#334155" }}>
              • <strong>Institution Portal:</strong> Instant notification delivered to <code>/institution/receive/deposit</code> and bell alert.
            </div>
            <div style={{ color: letterData?.isEmailConfigured ? "#059669" : "#b45309", marginTop: 2 }}>
              • <strong>Email Delivery:</strong> {letterData?.isEmailConfigured ? `Configured — will dispatch to registered address (${letterData?.toEmail || "institution address"})` : "Not configured in environment — delivered exclusively via Institution Portal."}
            </div>
          </div>

          {/* Formal Letter Preview */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--navy)" }}>Formal AICTE Maturity Reminder Letter:</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (letterData?.letterText) {
                    navigator.clipboard.writeText(letterData.letterText);
                    alert("Letter copied to clipboard.");
                  }
                }}
                style={{ fontSize: ".72rem", padding: "2px 8px" }}
              >
                Copy Letter
              </button>
            </div>
            <div className="letter-preview-box">
              {loading && !letterData ? "Generating formal letter preview from MongoDB..." : letterData?.letterText || "Unable to generate letter preview."}
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div style={{ padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius-sm)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                id="confirm-send-maturity-letter"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ marginTop: 2, cursor: "pointer" }}
              />
              <span style={{ fontSize: ".8rem", color: "#92400e", lineHeight: 1.4 }}>
                <strong>Confirmation Required:</strong> I hereby confirm that I have reviewed the FDR particulars and authorize the generation and dispatch of this formal statutory maturity reminder notice to the institution.
              </span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-send-maturity-letter"
            className="btn btn-primary"
            onClick={handleSend}
            disabled={loading || !confirmed || (hasPrevious && !forceResend)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Send size={15} />
            <span>{loading ? "Dispatching..." : hasPrevious && !forceResend ? "Letter Already Sent" : "Confirm & Send Reminder Letter"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  1. DASHBOARD VIEW (Alive summary clickable to Alive Records)
// ══════════════════════════════════════════════════════════════════════
function DashboardView({
  stats,
  aliveCount,
  aliveAmount,
  navigate,
}: {
  stats: any;
  aliveCount: number;
  aliveAmount: number;
  navigate: (page: string) => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <span>Employee Portal</span>
        <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Dashboard</span>
      </div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Welcome back — here is your real-time AICTE FDR Shield overview from MongoDB.</p>

      {/* Summary Cards — Clickable to Alive Records */}
      <div className="stats-grid">
        <div
          className="stat-card"
          onClick={() => navigate("alive-records")}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          title="Click to view all Alive FDR Records"
        >
          <div className="stat-icon success">
            <HeartPulse size={24} />
          </div>
          <div className="stat-info">
            <h4>{aliveCount}</h4>
            <p style={{ fontWeight: 600, color: "var(--navy)" }}>Total Alive FDR Records</p>
            <span style={{ fontSize: ".75rem", color: "var(--accent)" }}>Click to view details →</span>
          </div>
        </div>

        <div
          className="stat-card"
          onClick={() => navigate("alive-records")}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          title="Click to view all Alive FDR Records"
        >
          <div className="stat-icon accent">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h4>{fmtCurrency(aliveAmount)}</h4>
            <p style={{ fontWeight: 600, color: "var(--navy)" }}>Total Amount Deposited</p>
            <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>Verified active deposits</span>
          </div>
        </div>

        <div
          className="stat-card"
          onClick={() => navigate("approval-applications")}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          title="Click to review college applications"
        >
          <div className="stat-icon warning">
            <FileCheck size={24} />
          </div>
          <div className="stat-info">
            <h4>{stats?.pendingApplications || 0}</h4>
            <p style={{ fontWeight: 600, color: "var(--navy)" }}>Pending Approval Seeking</p>
            <span style={{ fontSize: ".75rem", color: "var(--accent)" }}>Review applications →</span>
          </div>
        </div>

        <div
          className="stat-card"
          onClick={() => navigate("release-applications")}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          title="Click to review release applications"
        >
          <div className="stat-icon danger">
            <FileOutput size={24} />
          </div>
          <div className="stat-info">
            <h4>{stats?.pendingReleaseRequests || 0}</h4>
            <p style={{ fontWeight: 600, color: "var(--navy)" }}>Pending Release Requests</p>
            <span style={{ fontSize: ".75rem", color: "var(--accent)" }}>Review release requests →</span>
          </div>
        </div>
      </div>

      <div className="prototype-notice">
        <Info size={16} />
        <span>
          <strong>Live MongoDB Synchronized:</strong> Showing verified Alive FDR records metrics and application counts directly from MongoDB.
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  DOCUMENT PREVIEW MODAL
// ══════════════════════════════════════════════════════════════════════
function DocPreviewModal({
  doc,
  onClose,
  collegeName,
  collegeId,
  fdrRef,
  depositAmount,
  onVerifyDoc,
  onRejectDoc,
  onSendVerificationLetter,
  onViewLetter,
}: {
  doc: any;
  onClose: () => void;
  collegeName?: string;
  collegeId?: string;
  fdrRef?: string;
  depositAmount?: number;
  onVerifyDoc?: (doc: any) => Promise<void> | void;
  onRejectDoc?: (doc: any, remarks: string) => Promise<void> | void;
  onSendVerificationLetter?: (doc: any) => Promise<any> | void;
  onViewLetter?: (content: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [modalFeedback, setModalFeedback] = useState<{ type: string; text: string } | null>(null);

  if (!doc) return null;

  const isVerified = doc.status === "Verified";
  const isNotVerified = doc.status === "Not Verified";
  const letterSent = doc.verificationLetterSent || Boolean(doc.verificationLetter);

  const handleVerify = async () => {
    if (onVerifyDoc) {
      await onVerifyDoc(doc);
      setModalFeedback({
        type: "success",
        text: "Document marked as Verified. Send Verification Letter option is now enabled.",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) {
      setRejectError("Remarks are required to explain why document was not verified.");
      return;
    }
    if (onRejectDoc) {
      await onRejectDoc(doc, rejectRemarks.trim());
      setRejecting(false);
      setModalFeedback({
        type: "warning",
        text: "Document marked as Not Verified with remarks.",
      });
    }
  };

  const handleSendLetter = async () => {
    if (onSendVerificationLetter) {
      const res = await onSendVerificationLetter(doc);
      if (res && res.success !== false) {
        setModalFeedback({
          type: "success",
          text: `Verification letter successfully generated and sent to ${collegeName || "the college"}. Delivery status: Sent. Duplicate sending prevented.`,
        });
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3>Document Preview</h3>
            {isVerified && (
              <span className="badge badge-success">
                <Check size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> Verified
              </span>
            )}
            {isNotVerified && (
              <span className="badge badge-danger">
                <XCircle size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> Not Verified
              </span>
            )}
            {!isVerified && !isNotVerified && <span className="badge badge-warning">Pending Review</span>}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {modalFeedback && (
            <div className={modalFeedback.type === "success" ? "msg-success" : "msg-error"} style={{ marginBottom: 14 }}>
              {modalFeedback.text}
            </div>
          )}

          <div
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              backgroundColor: "var(--bg-input)",
              padding: 14,
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <p style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 2 }}>{doc.name}</p>
              <p style={{ fontSize: ".8125rem", color: "var(--text-secondary)", margin: 0 }}>
                Type: {doc.type || "PDF"} &nbsp;•&nbsp; Size: {doc.size || "1.1 MB"} &nbsp;•&nbsp; Uploaded: {fmtDate(doc.uploadDate || doc.submissionDate)}
              </p>
            </div>
            {collegeName && (
              <div style={{ textAlign: "right", fontSize: ".8125rem" }}>
                <p style={{ fontWeight: 600, color: "var(--navy)", margin: 0 }}>{collegeName}</p>
                <p style={{ color: "var(--text-muted)", margin: 0 }}>
                  ID: <code>{collegeId}</code> • FDR Ref: <code style={{ color: "var(--accent)", fontWeight: 600 }}>{fdrRef}</code>
                </p>
              </div>
            )}
          </div>

          {/* Secure Document Preview Canvas */}
          <div style={{ marginTop: 14, marginBottom: 16 }}>
            {(doc.fileName || doc.file || doc.fileUrl) && (doc.type === "PDF" || String(doc.fileName || doc.file).endsWith(".pdf")) ? (
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", height: 420 }}>
                <iframe
                  src={doc.fileUrl || `/api/fd/files/${doc.fileName || doc.file}`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title={doc.name}
                />
              </div>
            ) : (doc.fileName || doc.file || doc.fileUrl) && /\.(png|jpe?g)$/i.test(doc.fileName || doc.file || "") ? (
              <div style={{ textAlign: "center", maxHeight: 420, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <img
                  src={doc.fileUrl || `/api/fd/files/${doc.fileName || doc.file}`}
                  alt={doc.name}
                  style={{ maxWidth: "100%", maxHeight: 390, margin: "0 auto", borderRadius: 4 }}
                />
              </div>
            ) : (
              <div className="doc-preview">
                <FileText size={48} style={{ color: "var(--accent)", margin: "0 auto 12px" }} />
                <p style={{ fontWeight: 600, margin: 0 }}>Official Record: {doc.name}</p>
                <p style={{ fontSize: ".8125rem", marginTop: 4, maxWidth: 460, margin: "6px auto 0", color: "var(--text-secondary)" }}>
                  Document submitted under statutory compliance. Verified against AICTE official records.
                </p>
                <span className="label" style={{ marginTop: 10 }}>SECURE PREVIEW — AICTE OFFICIAL RECORD</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
              <a
                href={doc.fileUrl || `/api/fd/files/${doc.fileName || doc.file}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
              <a
                href={doc.fileUrl || `/api/fd/files/${doc.fileName || doc.file}`}
                download
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} /> Download File
              </a>
            </div>
          </div>

          {/* Verification Decision Controls inside Preview */}
          {onVerifyDoc && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 8,
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ fontSize: ".8125rem", fontWeight: 600, color: "var(--navy)" }}>Official Verification Decision:</span>
                  <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Status: <strong>{doc.status || "Pending"}</strong>
                    {doc.remarks && <span style={{ color: "var(--danger)", marginLeft: 8 }}>Remarks: {doc.remarks}</span>}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-success btn-sm"
                    disabled={isVerified}
                    onClick={handleVerify}
                    title="Mark document as Verified"
                  >
                    <Check size={14} /> {isVerified ? "Verified" : "Verify Document"}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={isNotVerified && !rejecting}
                    onClick={() => {
                      setRejecting(!rejecting);
                      setRejectError("");
                    }}
                    title="Mark document as Not Verified"
                  >
                    <XCircle size={14} /> {rejecting ? "Cancel" : "Not Verified"}
                  </button>
                </div>
              </div>

              {rejecting && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderRadius: 6,
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <label style={{ display: "block", fontSize: ".75rem", fontWeight: 600, color: "var(--danger)", marginBottom: 4 }}>
                    Rejection Reason / Remarks (Mandatory for Institution Notification):
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Specify why document was not verified (e.g., seal missing, illegible deposit amount, name mismatch)..."
                    value={rejectRemarks}
                    onChange={(e) => {
                      setRejectRemarks(e.target.value);
                      setRejectError("");
                    }}
                    style={{ width: "100%", fontSize: ".8125rem" }}
                  />
                  {rejectError && <p style={{ color: "var(--danger)", fontSize: ".75rem", marginTop: 4 }}>{rejectError}</p>}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button className="btn btn-danger btn-sm" onClick={handleReject}>
                      Confirm Not Verified
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setRejecting(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification Letter Action inside preview if available */}
          {onSendVerificationLetter && (
            <div style={{ marginTop: 16 }}>
              {isVerified ? (
                letterSent ? (
                  <div style={{ padding: 14, backgroundColor: "rgba(34, 197, 94, 0.1)", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <p style={{ fontWeight: 600, color: "#4ade80", margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={16} /> Verification Letter Sent
                        </p>
                        <p style={{ fontSize: ".75rem", color: "var(--text-secondary)", margin: "3px 0 0 0" }}>
                          Dispatched to {collegeName} on {fmtDateTime(doc.verificationLetter?.sendingDate || doc.verificationLetterDate)}. Duplicate sending is strictly prevented.
                        </p>
                      </div>
                      {onViewLetter && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewLetter(doc.verificationLetter?.content)}
                        >
                          <FileText size={14} /> View Letter
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 14, backgroundColor: "rgba(34, 197, 94, 0.08)", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.25)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <p style={{ fontWeight: 600, color: "#4ade80", margin: 0 }}>Document Verified — Ready for Verification Letter</p>
                        <p style={{ fontSize: ".75rem", color: "var(--text-secondary)", margin: "3px 0 0 0" }}>
                          Generate and dispatch official verification letter to {collegeName} (FDR: {fdrRef}, Amount: ₹{fmt(depositAmount || 0)}).
                        </p>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={handleSendLetter}>
                        <Send size={14} /> Send Verification Letter
                      </button>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  2. APPROVAL SEEKING APPLICATIONS
// ══════════════════════════════════════════════════════════════════════
function ApprovalApplicationsView({
  applications,
  complianceList,
  apiPost,
  onReload,
  setMessage,
}: {
  applications: any[];
  complianceList?: any[];
  apiPost: (path: string, body: any) => Promise<any>;
  onReload: () => Promise<void>;
  setMessage: (msg: any) => void;
}) {
  const getInstCompliance = (instId?: string, collegeId?: string) => {
    if (!complianceList) return null;
    return complianceList.find(
      (c) => (instId && c.institutionId === instId) || (collegeId && c.collegeId === collegeId)
    );
  };

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [letterPreview, setLetterPreview] = useState<string | null>(null);
  const [letterPreviewData, setLetterPreviewData] = useState<{ text: string; type: string; app: any } | null>(null);
  const [letterActionLoading, setLetterActionLoading] = useState(false);

  // Document verification states
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [remarksModalDoc, setRemarksModalDoc] = useState<any | null>(null);
  const [remarksInput, setRemarksInput] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [viewRemarksDoc, setViewRemarksDoc] = useState<any | null>(null);

  // Deposit Details form state (3 manual input fields)
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmountVal, setDepositAmountVal] = useState("");
  const [depositAccountNo, setDepositAccountNo] = useState("");
  const [depositDeadlineVal, setDepositDeadlineVal] = useState("");
  const [depositErrors, setDepositErrors] = useState<{ amount?: string; account?: string; deadline?: string }>({});
  const [showDepositConfirm, setShowDepositConfirm] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  const app = selectedAppId ? applications.find((a) => a.id === selectedAppId || a._id === selectedAppId) : null;

  const allVerified = (docs: any[]) => docs && docs.length > 0 && docs.every((d) => d.status === "Verified");
  const allReviewed = (docs: any[]) => docs && docs.length > 0 && docs.every((d) => d.status !== "Pending");
  const unverifiedHaveRemarks = (docs: any[]) =>
    docs && docs.filter((d) => d.status === "Not Verified").every((d) => d.remarks && d.remarks.trim());

  // Determine category-specific letter types (LoA vs EoA, LoD vs EoD) based strictly on saved applicationType
  const isLoa = Boolean(app && (app.applicationType === "LOA" || app.applicationType === "LoA"));
  const isEoa = Boolean(app && (app.applicationType === "EOA" || app.applicationType === "EoA"));
  const hasConfirmedType = isLoa || isEoa;
  const approvalLetterType = isEoa ? "EoA" : isLoa ? "LoA" : "";
  const deficiencyLetterType = isEoa ? "EoD" : isLoa ? "LoD" : "";

  // Verify Document Action (Individual)
  const handleVerifyDoc = async (appId: string, docId: string, status: string, remarks = "") => {
    setVerifyingDocId(docId);
    try {
      await apiPost(`/api/fd/application/${appId}/verify-document`, { docId, status, remarks });
      await onReload();
      setMessage({ type: "success", text: `Document status updated to ${status}.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setVerifyingDocId(null);
    }
  };

  // Submit Remarks for Not Verified
  const handleSaveRemarksAndReject = async () => {
    if (!remarksModalDoc) return;
    if (!remarksInput.trim()) {
      setRemarksError("Deficiency remarks are mandatory when marking document as Not Verified.");
      return;
    }
    const doc = remarksModalDoc;
    setRemarksModalDoc(null);
    await handleVerifyDoc(app.id, doc.id, "Not Verified", remarksInput.trim());
    setRemarksInput("");
    setRemarksError("");
  };

  // Generate LoA / EoA / LoD / EoD
  const handleGenerateLetter = async (appId: string, type: "LoA" | "EoA" | "LoD" | "EoD") => {
    setLetterActionLoading(true);
    try {
      const res = await apiPost(`/api/fd/application/${appId}/generate-letter`, { type });
      await onReload();
      const updatedApp = res.application || app;
      setLetterPreviewData({
        text: updatedApp.letterText,
        type,
        app: updatedApp,
      });
      setMessage({ type: "success", text: `${type} decision recorded and letter generated in MongoDB.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLetterActionLoading(false);
    }
  };

  // Send LoA/EoA or LoD/EoD to Institution
  const handleSendLetter = async (appId: string) => {
    setLetterActionLoading(true);
    try {
      await apiPost(`/api/fd/application/${appId}/send-letter`, {});
      await onReload();
      setMessage({ type: "success", text: "Official decision letter successfully dispatched to the institution." });
      if (letterPreviewData) {
        setLetterPreviewData((prev) => (prev ? { ...prev, app: { ...prev.app, letterSent: true, letterSentDate: new Date() } } : null));
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLetterActionLoading(false);
    }
  };

  // Download Letter directly as PDF attachment without window.open or redirect
  const downloadLetterAsPdf = async (letterText: string, title: string, refNo: string, targetAppId?: string) => {
    try {
      const appIdToUse = targetAppId || selectedAppId;
      if (appIdToUse) {
        const res = await fetch(`/api/fd/application/${encodeURIComponent(appIdToUse)}/letter-pdf`, {
          credentials: "include",
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
            let filename = `EoA_Letter_${appIdToUse}.pdf`;
            const disposition = res.headers.get("content-disposition");
            if (disposition && disposition.includes("filename=")) {
              const match = disposition.match(/filename="?([^";]+)"?/);
              if (match && match[1]) filename = match[1];
            } else if (title.toLowerCase().includes("loa")) {
              filename = `LoA_Letter_${appIdToUse}.pdf`;
            }
            const blob = await res.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
            return;
          }
        }
      }
      alert("Failed to download official letter PDF. Please ensure the decision letter is generated.");
    } catch (err: any) {
      console.error("Letter PDF download error:", err);
      alert(err.message || "Failed to download letter PDF.");
    }
  };

  // Validate the 3 manual deposit fields before confirmation
  const handleValidateDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { amount?: string; account?: string; deadline?: string } = {};
    const trimmedAcc = depositAccountNo.trim();
    const parsedAmount = parseFloat(depositAmountVal);

    if (!depositAmountVal || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = "Deposit Amount (INR) must be a positive monetary amount.";
    }
    if (!trimmedAcc) {
      errors.account = "AICTE Bank Account Number is required.";
    }
    if (!depositDeadlineVal) {
      errors.deadline = "Last Date for Deposit is required.";
    }

    if (Object.keys(errors).length > 0) {
      setDepositErrors(errors);
      return;
    }

    setDepositErrors({});
    setShowDepositConfirm(true);
  };

  // Confirmed Deposit Dispatch
  const handleConfirmSendDepositDetails = async (appId: string) => {
    setDepositSubmitting(true);
    setShowDepositConfirm(false);
    try {
      const res = await apiPost(`/api/fd/application/${appId}/deposit-details`, {
        depositAmount: parseFloat(depositAmountVal),
        bankAccountNumber: depositAccountNo.trim(),
        depositDeadline: depositDeadlineVal,
      });
      await onReload();
      setShowDepositForm(false);
      setMessage({
        type: "success",
        text: res.message || "Deposit instructions successfully saved in MongoDB and dispatched to institution.",
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Detail View of a Selected Application
  if (app) {
    const inst = app.institution;
    const docs = app.documents || [];

    return (
      <div className="animate-fade-in">
        <div className="breadcrumb" style={{ marginBottom: 12 }}>
          <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => setSelectedAppId(null)}>
            Approval Seeking Applications
          </span>
          <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
          <span>{inst?.name || app.refNumber}</span>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAppId(null)} style={{ marginBottom: 16 }}>
          ← Back to Applications List
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
          <h1 className="page-title" style={{ margin: 0 }}>{inst?.name || "Institution Details"}</h1>
          {app.applicationType === "LOA" || app.applicationType === "LoA" ? (
            <span className="badge badge-info" style={{ fontSize: ".8125rem", padding: "4px 10px", fontWeight: 700 }}>
              Request Type: LOA (Letter of Approval)
            </span>
          ) : app.applicationType === "EOA" || app.applicationType === "EoA" ? (
            <span className="badge badge-primary" style={{ fontSize: ".8125rem", padding: "4px 10px", fontWeight: 700 }}>
              Request Type: EOA (Extension of Approval)
            </span>
          ) : (
            <span className="badge badge-neutral" style={{ fontSize: ".8125rem", padding: "4px 10px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Request Type: Type not specified
            </span>
          )}
        </div>
        <p className="page-subtitle">Application Reference: {app.refNumber}</p>

        {/* Institution Details Card */}
        {inst && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Institution Details</h3>
            </div>
            <div className="card-body">
              <div className="profile-grid">
                <div className="profile-field">
                  <label>College Name</label>
                  <p>{inst.name}</p>
                </div>
                <div className="profile-field">
                  <label>Institution ID</label>
                  <p><code>{inst.collegeId}</code></p>
                </div>
                <div className="profile-field">
                  <label>State & District</label>
                  <p>{inst.state || "—"}, {inst.district || "—"}</p>
                </div>
                <div className="profile-field">
                  <label>Type / Programme</label>
                  <p>{inst.institutionType || "Technical Institution"}</p>
                </div>
                <div className="profile-field">
                  <label>Application Type</label>
                  <p>
                    {app.applicationType === "LOA" || app.applicationType === "LoA" ? (
                      <span className="badge badge-info" style={{ fontWeight: 700 }}>LOA — Letter of Approval</span>
                    ) : app.applicationType === "EOA" || app.applicationType === "EoA" ? (
                      <span className="badge badge-primary" style={{ fontWeight: 700 }}>EOA — Extension of Approval</span>
                    ) : (
                      <span className="badge badge-neutral" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                        Type not specified
                      </span>
                    )}
                  </p>
                </div>
                <div className="profile-field">
                  <label>Principal / Contact</label>
                  <p>{inst.principalName || inst.authorizedContactPerson || "Principal"} ({inst.email || "—"})</p>
                </div>
                <div className="profile-field">
                  <label>PGRC Verification Status</label>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    {renderComplianceBadge(getInstCompliance(inst._id, inst.collegeId)?.pgrcStatus || "NO COMPLAINTS")}
                    {getInstCompliance(inst._id, inst.collegeId)?.pgrcReason && (
                      <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                        ({getInstCompliance(inst._id, inst.collegeId)?.pgrcReason})
                      </span>
                    )}
                  </div>
                </div>
                <div className="profile-field">
                  <label>Vigilance Verification Status</label>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    {renderComplianceBadge(getInstCompliance(inst._id, inst.collegeId)?.vigilanceStatus || "NO COMPLAINTS")}
                    {getInstCompliance(inst._id, inst.collegeId)?.vigilanceReason && (
                      <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                        ({getInstCompliance(inst._id, inst.collegeId)?.vigilanceReason})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Application Details Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Application Details</h3>
          </div>
          <div className="card-body">
            <div className="profile-grid">
              <div className="profile-field">
                <label>Application Reference</label>
                <p><code style={{ color: "var(--accent)", fontWeight: 600 }}>{app.refNumber}</code></p>
              </div>
              <div className="profile-field">
                <label>Programme</label>
                <p>{app.programme}</p>
              </div>
              <div className="profile-field">
                <label>Approved Intake</label>
                <p>{app.intake || 60}</p>
              </div>
              <div className="profile-field">
                <label>Submission Date</label>
                <p>{fmtDate(app.applicationDate)}</p>
              </div>
              <div className="profile-field">
                <label>Verification Result & Dispatch</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  {app.result ? (
                    <span className={statusBadge(app.result === "LoA" || app.result === "EoA" ? "Approved" : "Declined")}>
                      {app.result}
                    </span>
                  ) : (
                    <span className="badge badge-warning">Pending Review</span>
                  )}
                  {app.result &&
                    (app.letterSent ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> Sent
                      </span>
                    ) : (
                      <span className="badge badge-warning">Pending Send</span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Uploaded Documents — Individually Verified */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Uploaded Certificates & Supporting Documents</h3>
          </div>
          <div className="card-body">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Document Type</th>
                    <th>File Size</th>
                    <th>Submission Date</th>
                    <th>Verification Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc: any) => {
                    const isVerified = doc.status === "Verified";
                    const isNotVerified = doc.status === "Not Verified";
                    const isBusy = verifyingDocId === doc.id;

                    return (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 500 }}>{doc.name}</td>
                        <td>{doc.type || "PDF"}</td>
                        <td>{doc.size || "1.2 MB"}</td>
                        <td>{fmtDate(doc.uploadDate)}</td>
                        <td>
                          {isVerified ? (
                            <span className="badge badge-success" style={{ fontWeight: 700 }}>
                              <Check size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> VERIFIED
                            </span>
                          ) : isNotVerified ? (
                            <div>
                              <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                                <XCircle size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> NOT VERIFIED
                              </span>
                              {doc.remarks && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setViewRemarksDoc(doc)}
                                  style={{ display: "block", marginTop: 4, fontSize: ".725rem", padding: "2px 6px" }}
                                >
                                  View Remarks
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-warning">PENDING</span>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(doc)} title="Preview document">
                              <Eye size={14} /> Preview
                            </button>
                            {(doc.fileName || doc.file || doc.fileUrl) && (
                              <a
                                href={doc.fileUrl || `/api/institution/files/${doc.fileName || doc.file}`}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                title="Download document file"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <Download size={14} /> Download
                              </a>
                            )}
                            {!app.letterSent && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  disabled={isVerified || isBusy}
                                  onClick={() => handleVerifyDoc(app.id, doc.id, "Verified")}
                                  title="Verify this document"
                                >
                                  <Check size={14} /> {isBusy && doc.status !== "Verified" ? "Verifying..." : "Verify"}
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setRemarksModalDoc(doc);
                                    setRemarksInput(doc.remarks || "");
                                    setRemarksError("");
                                  }}
                                  title="Mark document as Not Verified with deficiency remarks"
                                >
                                  <XCircle size={14} /> Not Verified
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Record Decision: LoA/EoA or LoD/EoD */}
        {!app.letterSent && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Record Verification Decision</h3>
            </div>
            <div className="card-body">
              {!hasConfirmedType ? (
                <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, color: "#92400e", fontSize: ".875rem" }}>
                  <strong>⚠️ Unconfirmed Application Type:</strong> This application has an unspecified or historical application type. Authorized clarification of application type (LoA vs EoA) is required before generating an approval or deficiency letter.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-success"
                      disabled={!allVerified(docs) || letterActionLoading}
                      onClick={() => handleGenerateLetter(app.id, approvalLetterType as any)}
                    >
                      <CheckCircle2 size={16} /> Generate {approvalLetterType}
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={!allReviewed(docs) || !unverifiedHaveRemarks(docs) || allVerified(docs) || letterActionLoading}
                      onClick={() => handleGenerateLetter(app.id, deficiencyLetterType as any)}
                    >
                      <XCircle size={16} /> Generate {deficiencyLetterType}
                    </button>
                  </div>
                  {!allVerified(docs) && !allReviewed(docs) && (
                    <p style={{ fontSize: ".8125rem", color: "var(--text-muted)", marginTop: 10 }}>
                      Review all documents before generating a letter. {approvalLetterType} requires all documents Verified. {deficiencyLetterType} requires all reviewed with rejection remarks on deficiencies.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Generated Letter Section with Actions */}
        {app.letterGenerated && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3>{app.result} — Generated Decision Letter</h3>
                {app.letterSent ? (
                  <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={13} /> Sent ({fmtDate(app.letterSentDate)})
                  </span>
                ) : (
                  <span className="badge badge-warning">Pending Dispatch</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className={`btn ${app.letterSent ? "btn-secondary" : "btn-primary"} btn-sm`}
                  disabled={app.letterSent || letterActionLoading}
                  onClick={() => handleSendLetter(app.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <Send size={14} /> {letterActionLoading ? "Dispatching..." : app.letterSent ? "Letter Sent" : `Send to Institution`}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLetterPreviewData({ text: app.letterText, type: app.result, app })}
                >
                  <Eye size={14} /> Preview Letter
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  title={app.result === "EoA" ? "Download EoA Letter" : "Download Decision Letter"}
                  onClick={() => downloadLetterAsPdf(app.letterText, `${app.result} Letter`, app.refNumber, app.id)}
                >
                  <Download size={14} /> {app.result === "EoA" ? "Download EoA Letter" : "Download PDF"}
                </button>
              </div>
            </div>
            <div className="card-body">
              {app.letterSent ? (
                <div className="msg-success" style={{ marginBottom: 12 }}>
                  <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Official {app.result} letter has been dispatched to <strong>{inst?.name}</strong> on {fmtDate(app.letterSentDate)}. Accidental duplicate sending is prevented.
                </div>
              ) : (
                <div className="msg-warning" style={{ marginBottom: 12 }}>
                  <Info size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Decision recorded as <strong>{app.result}</strong> in MongoDB. Click <strong>Send to Institution</strong> to dispatch.
                </div>
              )}
              <div className="letter-preview">
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{app.letterText}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: SEND DEPOSIT DETAILS — EXACTLY 3 MANUAL INPUT FIELDS */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3>Send Deposit Details</h3>
              {!app.letterSent || (app.result !== "LoA" && app.result !== "EoA") ? (
                <span className="badge badge-neutral">Action Disabled (Requires Sent LoA/EoA)</span>
              ) : app.depositDetailsSent ? (
                <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={13} /> Active (Version {app.depositDetails?.version || 1})
                </span>
              ) : (
                <span className="badge badge-warning">Action Enabled</span>
              )}
            </div>
            {app.letterSent && (app.result === "LoA" || app.result === "EoA") && !showDepositForm && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (app.depositDetails) {
                    setDepositAmountVal(String(app.depositDetails.depositAmount || ""));
                    setDepositAccountNo(app.depositDetails.bankAccountNumber || "");
                    if (app.depositDetails.depositDeadline) {
                      setDepositDeadlineVal(new Date(app.depositDetails.depositDeadline).toISOString().split("T")[0]);
                    }
                  }
                  setShowDepositForm(true);
                }}
              >
                <DollarSign size={14} /> {app.depositDetailsSent ? "Update Deposit Instructions" : "Send Deposit Details"}
              </button>
            )}
          </div>
          <div className="card-body">
            {!app.letterSent || (app.result !== "LoA" && app.result !== "EoA") ? (
              <p style={{ color: "var(--text-muted)", fontSize: ".875rem", margin: 0 }}>
                {app.result === "LoD" || app.result === "EoD"
                  ? `This application has been issued a ${app.result}. Deposit details cannot be sent.`
                  : "Deposit details can only be entered and sent after the official Letter of Approval (LoA/EoA) has been generated and dispatched."}
              </p>
            ) : app.depositDetailsSent && app.depositDetails && !showDepositForm ? (
              <div>
                <div className="msg-success" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Deposit instruction (Version {app.depositDetails.version}) is active in MongoDB and received by <strong>{inst?.name}</strong> on {fmtDateTime(app.depositDetails.sentAt)}.
                </div>
                <div className="profile-grid">
                  <div className="profile-field">
                    <label>Deposit Amount (INR)</label>
                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent)" }}>{fmtCurrency(app.depositDetails.depositAmount)}</p>
                  </div>
                  <div className="profile-field">
                    <label>AICTE Bank Account Number</label>
                    <p><code style={{ fontSize: "1rem", fontWeight: 700, color: "var(--navy)" }}>{app.depositDetails.bankAccountNumber}</code></p>
                  </div>
                  <div className="profile-field">
                    <label>Last Date for Deposit</label>
                    <p style={{ fontWeight: 600 }}>{fmtDate(app.depositDetails.depositDeadline)}</p>
                  </div>
                  <div className="profile-field">
                    <label>Sent By / Date</label>
                    <p>{app.depositDetails.sentBy || "FD Officer"} • {fmtDateTime(app.depositDetails.sentAt)}</p>
                  </div>
                </div>
              </div>
            ) : showDepositForm ? (
              <form onSubmit={handleValidateDeposit} style={{ maxWidth: 540 }}>
                {/* Field 1: Deposit Amount */}
                <div className="form-group">
                  <label htmlFor="fd-deposit-amount">Deposit Amount (INR) *</label>
                  <input
                    id="fd-deposit-amount"
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    placeholder="e.g. 1500000"
                    value={depositAmountVal}
                    onChange={(e) => {
                      setDepositAmountVal(e.target.value);
                      setDepositErrors((prev) => ({ ...prev, amount: "" }));
                    }}
                  />
                  {depositErrors.amount && <p style={{ color: "var(--danger)", fontSize: ".75rem", marginTop: 4 }}>{depositErrors.amount}</p>}
                </div>

                {/* Field 2: AICTE Account Number */}
                <div className="form-group">
                  <label htmlFor="fd-account-number">AICTE Bank Account Number *</label>
                  <input
                    id="fd-account-number"
                    type="text"
                    className="form-input"
                    placeholder="Enter manual AICTE collection bank account number"
                    value={depositAccountNo}
                    onChange={(e) => {
                      setDepositAccountNo(e.target.value);
                      setDepositErrors((prev) => ({ ...prev, account: "" }));
                    }}
                  />
                  {depositErrors.account && <p style={{ color: "var(--danger)", fontSize: ".75rem", marginTop: 4 }}>{depositErrors.account}</p>}
                </div>

                {/* Field 3: Deposit Deadline */}
                <div className="form-group">
                  <label htmlFor="fd-deposit-deadline">Last Date for Deposit *</label>
                  <input
                    id="fd-deposit-deadline"
                    type="date"
                    className="form-input"
                    value={depositDeadlineVal}
                    onChange={(e) => {
                      setDepositDeadlineVal(e.target.value);
                      setDepositErrors((prev) => ({ ...prev, deadline: "" }));
                    }}
                  />
                  {depositErrors.deadline && <p style={{ color: "var(--danger)", fontSize: ".75rem", marginTop: 4 }}>{depositErrors.deadline}</p>}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button type="submit" className="btn btn-primary" disabled={depositSubmitting}>
                    <Send size={15} /> Send Deposit Details
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDepositForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>

        {/* Modal: Remarks Entry for Not Verified */}
        {remarksModalDoc && (
          <div className="modal-overlay" onClick={() => setRemarksModalDoc(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <h3>Document Verification Deficiency</h3>
                <button className="modal-close" onClick={() => setRemarksModalDoc(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: ".875rem", marginBottom: 12 }}>
                  Document: <strong>{remarksModalDoc.name}</strong>
                </p>
                <div className="form-group">
                  <label>Deficiency Remarks (Required) *</label>
                  <textarea
                    rows={4}
                    className="form-input"
                    placeholder="Explain the specific deficiency, discrepancies, or missing details in this document..."
                    value={remarksInput}
                    onChange={(e) => {
                      setRemarksInput(e.target.value);
                      setRemarksError("");
                    }}
                  />
                  {remarksError && <p style={{ color: "var(--danger)", fontSize: ".75rem", marginTop: 4 }}>{remarksError}</p>}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => setRemarksModalDoc(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleSaveRemarksAndReject}>
                    <XCircle size={15} /> Save & Mark Not Verified
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: View Remarks */}
        {viewRemarksDoc && (
          <div className="modal-overlay" onClick={() => setViewRemarksDoc(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h3>Document Deficiency Remarks</h3>
                <button className="modal-close" onClick={() => setViewRemarksDoc(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: ".75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Document Name</label>
                  <p style={{ fontWeight: 600 }}>{viewRemarksDoc.name}</p>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: ".75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Status</label>
                  <p><span className="badge badge-danger">Not Verified</span></p>
                </div>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12 }}>
                  <label style={{ fontSize: ".75rem", color: "#991b1b", textTransform: "uppercase", fontWeight: 700 }}>Employee Remarks</label>
                  <p style={{ color: "#7f1d1d", fontSize: ".875rem", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {viewRemarksDoc.remarks || "No specific remark provided."}
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => setViewRemarksDoc(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Letter Preview with Download PDF & Send Actions */}
        {letterPreviewData && (
          <div className="modal-overlay" onClick={() => setLetterPreviewData(null)}>
            <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840 }}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3>{letterPreviewData.type} — Letter Preview</h3>
                  {letterPreviewData.app?.letterSent ? (
                    <span className="badge badge-success">Dispatched</span>
                  ) : (
                    <span className="badge badge-warning">Draft Preview</span>
                  )}
                </div>
                <button className="modal-close" onClick={() => setLetterPreviewData(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ background: "#fffbeb", border: "1px dashed #d97706", padding: "8px 12px", borderRadius: 6, marginBottom: 16, fontSize: ".8125rem", color: "#92400e", textAlign: "center", fontWeight: 600 }}>
                  [PROTOTYPE GENERATED DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY — NOT AN OFFICIAL AICTE ISSUANCE]
                </div>
                <div className="letter-preview" style={{ maxHeight: "55vh", overflowY: "auto" }}>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".875rem", lineHeight: 1.6 }}>
                    {letterPreviewData.text}
                  </pre>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <button
                    className="btn btn-secondary"
                    title={letterPreviewData.type === "EoA" ? "Download EoA Letter" : "Download Decision Letter"}
                    onClick={() => downloadLetterAsPdf(letterPreviewData.text, `${letterPreviewData.type} Letter`, app.refNumber, app.id)}
                  >
                    <Download size={15} /> {letterPreviewData.type === "EoA" ? "Download EoA Letter" : "Download PDF"}
                  </button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => setLetterPreviewData(null)}>
                      Close
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={letterPreviewData.app?.letterSent || letterActionLoading}
                      onClick={() => handleSendLetter(app.id)}
                    >
                      <Send size={15} /> {letterActionLoading ? "Sending..." : letterPreviewData.app?.letterSent ? "Letter Dispatched" : "Send to Institution"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirmation for Send Deposit Details */}
        {showDepositConfirm && (
          <div className="modal-overlay" onClick={() => setShowDepositConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h3>Confirm Deposit Instructions</h3>
                <button className="modal-close" onClick={() => setShowDepositConfirm(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: ".875rem", marginBottom: 16 }}>
                  Are you sure you want to dispatch these deposit instructions to <strong>{inst?.name}</strong>?
                </p>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <p style={{ margin: "4px 0", fontSize: ".875rem" }}>
                    <strong>Deposit Amount:</strong> ₹{Number(depositAmountVal).toLocaleString("en-IN")}
                  </p>
                  <p style={{ margin: "4px 0", fontSize: ".875rem" }}>
                    <strong>AICTE Account Number:</strong> <code style={{ fontWeight: 600 }}>{depositAccountNo.trim()}</code>
                  </p>
                  <p style={{ margin: "4px 0", fontSize: ".875rem" }}>
                    <strong>Last Date for Deposit:</strong> {fmtDate(depositDeadlineVal)}
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowDepositConfirm(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={() => handleConfirmSendDepositDetails(app.id)} disabled={depositSubmitting}>
                    <Send size={15} /> {depositSubmitting ? "Dispatching..." : "Confirm & Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Existing DocPreviewModal */}
        {previewDoc && (
          <DocPreviewModal
            doc={previewDoc}
            onClose={() => setPreviewDoc(null)}
            collegeName={inst?.name}
            collegeId={inst?.collegeId}
            onVerifyDoc={(doc) => handleVerifyDoc(app.id, doc.id, "Verified")}
            onRejectDoc={(doc, remarks) => handleVerifyDoc(app.id, doc.id, "Not Verified", remarks)}
          />
        )}
      </div>
    );
  }

  // Applications Table List View
  return (
    <div className="animate-fade-in">
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <span>Employee Portal</span>
        <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Approval Seeking Applications</span>
      </div>
      <h1 className="page-title">Approval Seeking Applications</h1>
      <p className="page-subtitle">Select an institution to inspect documents, record decisions, dispatch letters, and send deposit details.</p>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "35%" }}>College / Institution</th>
                <th style={{ width: "20%" }}>Reference</th>
                <th style={{ width: "15%" }}>Application Date</th>
                <th style={{ width: "18%" }}>Document Progress</th>
                <th style={{ width: "12%", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No applications submitted yet.
                  </td>
                </tr>
              ) : (
                applications.map((a: any) => {
                  const reviewed = (a.documents || []).filter((d: any) => d.status !== "Pending").length;
                  const total = (a.documents || []).length || 1;
                  const pct = Math.round((reviewed / total) * 100);

                  return (
                    <tr key={a.id} onClick={() => setSelectedAppId(a.id)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 600, color: "var(--navy)" }}>
                        {a.collegeName || a.collegeId}
                        <span style={{ display: "block", fontSize: ".75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                          ID: {a.collegeId}
                        </span>
                      </td>
                      <td><code style={{ fontSize: ".8125rem", color: "var(--accent)" }}>{a.refNumber}</code></td>
                      <td>{fmtDate(a.applicationDate)}</td>
                      <td>
                        <span style={{ fontSize: ".8125rem", fontWeight: 600 }}>{reviewed}/{total}</span>
                        <div className="progress-bar" style={{ marginTop: 4, width: 80 }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAppId(a.id);
                          }}
                        >
                          <Eye size={14} /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  3. DEPOSIT RECORDS VIEW (Clicking college opens separate doc page)
// ══════════════════════════════════════════════════════════════════════
function DepositRecordsView({
  deposits,
  apiPost,
  onReload,
  setMessage,
}: {
  deposits: any[];
  apiPost: (path: string, body: any) => Promise<any>;
  onReload: () => Promise<void>;
  setMessage: (msg: any) => void;
}) {
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [letterPreview, setLetterPreview] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [remarksText, setRemarksText] = useState("");
  const [remarksError, setRemarksError] = useState("");

  const filteredDeposits = useMemo(() => {
    return deposits.filter((dep) => {
      const term = searchTerm.toLowerCase().trim();
      const name = (dep.collegeName || "").toLowerCase();
      const fdr = (dep.fdrNumber || dep.fdrReference || "").toLowerCase();
      return !term || name.includes(term) || fdr.includes(term);
    });
  }, [deposits, searchTerm]);

  const selectedDeposit = selectedDepositId ? deposits.find((d) => d.id === selectedDepositId || d._id === selectedDepositId) : null;

  // Verify Document Action
  const handleVerifyDoc = async (doc: any) => {
    if (!selectedDeposit) return;
    try {
      await apiPost(`/api/fd/deposit/${selectedDeposit.id}/verify-document`, {
        docId: doc.id,
        status: "Verified",
      });
      await onReload();
      setMessage({ type: "success", text: `Document "${doc.name}" marked as Verified. Send Verification Letter is enabled.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  // Reject Document Action (Mandatory remarks)
  const handleRejectDoc = async (doc: any, customRemarks?: string) => {
    const finalRemarks = (customRemarks || remarksText).trim();
    if (!finalRemarks) {
      setRemarksError("Remarks are required so the college understands what needs correction.");
      return;
    }
    if (!selectedDeposit) return;
    try {
      await apiPost(`/api/fd/deposit/${selectedDeposit.id}/verify-document`, {
        docId: doc.id,
        status: "Not Verified",
        remarks: finalRemarks,
      });
      await onReload();
      setRejectingDocId(null);
      setRemarksText("");
      setRemarksError("");
      setMessage({ type: "warning", text: `Document "${doc.name}" marked as Not Verified with remarks.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  // Send Verification Letter
  const handleSendVerificationLetter = async (doc: any) => {
    if (!selectedDeposit) return;
    try {
      const res = await apiPost(`/api/fd/deposit/${selectedDeposit.id}/send-verification-letter`, {
        docId: doc.id,
      });
      await onReload();
      setMessage({
        type: "success",
        text: `Verification letter successfully generated and dispatched for "${doc.name}". Duplicate sending prevented.`,
      });
      return { success: true, letterRecord: res.letterRecord };
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
      return { success: false, error: err.message };
    }
  };

  // Dedicated Separate Page for College's Submitted Documents
  if (selectedDeposit) {
    const docs = selectedDeposit.documents || [];

    return (
      <div className="animate-fade-in">
        <div className="breadcrumb" style={{ marginBottom: 12 }}>
          <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => setSelectedDepositId(null)}>
            Deposit Records
          </span>
          <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
          <span>{selectedDeposit.collegeName}</span>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDepositId(null)} style={{ marginBottom: 16 }}>
          ← Back to Deposit Records
        </button>

        <h1 className="page-title">{selectedDeposit.collegeName}</h1>
        <p className="page-subtitle">Submitted Deposit Documents & Verification</p>

        {/* College & Submission Header */}
        <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <span style={{ fontSize: ".75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 0.5 }}>Institution</span>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--navy)", margin: "2px 0 0" }}>{selectedDeposit.collegeName}</h2>
              <span style={{ fontSize: ".8125rem", color: "var(--text-muted)" }}>College ID: <code>{selectedDeposit.collegeId}</code></span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: ".75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 0.5 }}>Submission Date</span>
              <p style={{ fontWeight: 600, color: "var(--navy)", margin: "2px 0 0" }}>{fmtDate(selectedDeposit.depositDate)}</p>
            </div>
          </div>
        </div>

        {/* 3 Structured Sections: FDR Details, Bank Details, Bank Employee Details */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
          {/* Section A — FDR Details */}
          <div className="card">
            <div className="card-header" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 0.5 }}>FDR Details</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "42%", color: "var(--text-secondary)" }}>FDR Number</td>
                    <td><code style={{ color: "var(--accent)", fontWeight: 700, fontSize: ".875rem" }}>{selectedDeposit.fdrNumber || "—"}</code></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>FDR Amount</td>
                    <td style={{ fontWeight: 700, color: "var(--navy)", fontSize: "1rem" }}>{fmtCurrency(selectedDeposit.amount)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Maturity Date</td>
                    <td>{selectedDeposit.maturityDate ? fmtDate(selectedDeposit.maturityDate) : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B — Bank Details */}
          <div className="card">
            <div className="card-header" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 0.5 }}>Bank Details</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "42%", color: "var(--text-secondary)" }}>Bank Name</td>
                    <td style={{ fontWeight: 600 }}>{selectedDeposit.bankName || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Branch Name</td>
                    <td>{selectedDeposit.branchName || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>IFSC Code</td>
                    <td><code>{selectedDeposit.ifscCode || "—"}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section C — Bank Employee Details (Authorized Signatory) */}
          <div className="card">
            <div className="card-header" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 0.5 }}>Bank Employee Details</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "42%", color: "var(--text-secondary)" }}>Employee Name</td>
                    <td style={{ fontWeight: 600 }}>{selectedDeposit.bankEmployeeName || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Employee ID</td>
                    <td><code>{selectedDeposit.bankEmployeeId || "—"}</code></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Designation</td>
                    <td>{selectedDeposit.bankEmployeeDesignation || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Contact Number</td>
                    <td>{selectedDeposit.bankEmployeeContact || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section D — Submitted FDR Document */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Submitted FDR Document ({docs.length})
            </h3>
            <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
              Showing actual submitted document attachment
            </span>
          </div>
          <div className="card-body">
            {docs.length === 0 ? (
              <p style={{ color: "var(--text-muted)", padding: 12 }}>No document uploaded on file for this submission.</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>File Type</th>
                      <th>Upload Date</th>
                      <th>Verification Status</th>
                      <th>Verification Letter</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc: any) => {
                      const isRejecting = rejectingDocId === doc.id;
                      const isVerified = doc.status === "Verified";
                      const isNotVerified = doc.status === "Not Verified";
                      const letterSent = doc.verificationLetterSent || Boolean(doc.verificationLetter);
                      const fileDownloadUrl = doc.fileUrl || (doc.fileName ? `/api/fd/files/${doc.fileName}` : (selectedDeposit.receiptPath ? `/api/fd/files/${selectedDeposit.receiptPath}` : ""));

                      return (
                        <tr key={doc.id}>
                          <td style={{ fontWeight: 600, color: "var(--navy)" }}>
                            {doc.name}
                            <span style={{ display: "block", fontSize: ".75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                              {doc.fileName || (typeof doc.file === "string" ? doc.file : "")}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral">{doc.type || "PDF"}</span>
                          </td>
                          <td>{fmtDate(doc.uploadDate || selectedDeposit.depositDate)}</td>
                          <td>
                            {isVerified && (
                              <span className="badge badge-success">
                                <Check size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> Verified
                              </span>
                            )}
                            {isNotVerified && (
                              <div>
                                <span className="badge badge-danger">
                                  <XCircle size={12} style={{ verticalAlign: "middle", marginRight: 3 }} /> Not Verified
                                </span>
                                {doc.remarks && (
                                  <span style={{ display: "block", fontSize: ".75rem", color: "var(--danger)", marginTop: 4 }}>
                                    Remarks: {doc.remarks}
                                  </span>
                                )}
                              </div>
                            )}
                            {!isVerified && !isNotVerified && <span className="badge badge-warning">Pending Review</span>}
                          </td>
                          <td>
                            {isVerified ? (
                              letterSent ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="badge badge-success">
                                    <CheckCircle2 size={12} /> Sent ({fmtDate(doc.verificationLetter?.sendingDate || doc.verificationLetterDate)})
                                  </span>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setLetterPreview(doc.verificationLetter?.content)}
                                    style={{ fontSize: ".75rem", padding: "2px 8px" }}
                                  >
                                    <FileText size={12} /> View Letter
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSendVerificationLetter(doc)}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                                >
                                  <Send size={13} /> Send Verification Letter
                                </button>
                              )
                            ) : isNotVerified ? (
                              <span className="badge badge-neutral" style={{ opacity: 0.7 }}>Letter Disabled</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: ".8125rem" }}>Awaiting Verification</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPreviewDoc(doc)}
                                title="Preview submitted document"
                              >
                                <Eye size={14} /> Preview
                              </button>
                              {fileDownloadUrl && (
                                <a
                                  href={fileDownloadUrl}
                                  download
                                  className="btn btn-secondary btn-sm"
                                  title="Download uploaded document file"
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <Download size={14} /> Download
                                </a>
                              )}
                              <button
                                className="btn btn-success btn-sm"
                                disabled={isVerified}
                                onClick={() => handleVerifyDoc(doc)}
                                title="Manually verify document"
                              >
                                <Check size={14} /> Verify
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={isNotVerified && !isRejecting}
                                onClick={() => {
                                  if (isRejecting) {
                                    setRejectingDocId(null);
                                    setRemarksText("");
                                    setRemarksError("");
                                  } else {
                                    setRejectingDocId(doc.id);
                                    setRemarksText(doc.remarks || "");
                                    setRemarksError("");
                                  }
                                }}
                                title="Manually mark document as Not Verified"
                              >
                                <XCircle size={14} /> {isRejecting ? "Cancel" : "Not Verified"}
                              </button>
                            </div>

                            {/* Remarks input field - Mandatory for Not Verified */}
                            {isRejecting && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 10,
                                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                                  borderRadius: 6,
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                }}
                              >
                                <label style={{ display: "block", fontSize: ".75rem", fontWeight: 600, color: "var(--danger)", marginBottom: 4 }}>
                                  Reason / Remarks for Not Verified (Required):
                                </label>
                                <textarea
                                  className="form-input"
                                  rows={2}
                                  placeholder="Specify what needs correction (e.g. illegible seal, amount discrepancy)..."
                                  value={remarksText}
                                  onChange={(e) => {
                                    setRemarksText(e.target.value);
                                    setRemarksError("");
                                  }}
                                  style={{ width: "100%", fontSize: ".8125rem" }}
                                />
                                {remarksError && <p style={{ color: "var(--danger)", fontSize: ".75rem", marginTop: 4 }}>{remarksError}</p>}
                                <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 8 }}>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleRejectDoc(doc)}>
                                    Confirm Not Verified
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setRejectingDocId(null);
                                      setRemarksText("");
                                      setRemarksError("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>


        {/* Modals */}
        {previewDoc && (
          <DocPreviewModal
            doc={previewDoc}
            onClose={() => setPreviewDoc(null)}
            collegeName={selectedDeposit.collegeName}
            collegeId={selectedDeposit.collegeId}
            fdrRef={selectedDeposit.fdrNumber}
            depositAmount={selectedDeposit.amount}
            onVerifyDoc={handleVerifyDoc}
            onRejectDoc={handleRejectDoc}
            onSendVerificationLetter={handleSendVerificationLetter}
            onViewLetter={(content) => setLetterPreview(content)}
          />
        )}

        {letterPreview && (
          <div className="modal-overlay" onClick={() => setLetterPreview(null)}>
            <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780 }}>
              <div className="modal-header">
                <h3>Official Verification Letter</h3>
                <button className="modal-close" onClick={() => setLetterPreview(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="letter-preview">
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{letterPreview}</pre>
                </div>
              </div>
              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Printer size={14} /> Print Letter
                </button>
                <button className="btn btn-primary" onClick={() => setLetterPreview(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Table View
  return (
    <div className="animate-fade-in">
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <span>Employee Portal</span>
        <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Deposit Records</span>
      </div>
      <h1 className="page-title">Deposit Records</h1>
      <p className="page-subtitle">Review institution deposit records. Click any college name to open its dedicated submitted documents page.</p>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Search size={18} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by College Name or FDR reference number…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: "none", padding: "6px 0", outline: "none", width: "100%", background: "transparent" }}
            />
            {searchTerm && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSearchTerm("")}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deposit Records Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Institution Deposit Records</h3>
          <span style={{ fontSize: ".8125rem", color: "var(--text-muted)" }}>Showing {filteredDeposits.length} records</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>College Name</th>
                <th>College ID</th>
                <th>FDR Reference Number</th>
                <th>Deposit Amount</th>
                <th>Submission Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>
                    No deposit records available. Records will appear when institutions submit their FDR details.
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((dep) => (
                  <tr key={dep.id} onClick={() => setSelectedDepositId(dep.id)} style={{ cursor: "pointer" }}>
                    <td>
                      <span
                        style={{ fontWeight: 600, color: "var(--accent)", textDecoration: "underline" }}
                        title="Click to view dedicated submitted documents page"
                      >
                        {dep.collegeName}
                      </span>
                    </td>
                    <td><code>{dep.collegeId}</code></td>
                    <td><code style={{ fontSize: ".875rem", color: "var(--accent)" }}>{dep.fdrNumber}</code></td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(dep.amount)}</td>
                    <td>{fmtDate(dep.depositDate)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDepositId(dep.id || dep._id);
                        }}
                      >
                        <FileText size={14} /> Review Document
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  4. ALIVE RECORDS VIEW (Only Verified, Active FDRs)
// ══════════════════════════════════════════════════════════════════════
function AliveRecordsView({
  aliveFdrs,
  aliveCount,
  aliveTotalAmount,
  navigate,
}: {
  aliveFdrs: any[];
  aliveCount: number;
  aliveTotalAmount: number;
  navigate: (page: string) => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => navigate("dashboard")}>
          Employee Portal
        </span>
        <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Alive Records</span>
      </div>
      <h1 className="page-title">Alive Records</h1>
      <p className="page-subtitle">Only verified, active FDRs with matching active deposit records derived from MongoDB.</p>

      {/* Alive Summary Cards */}
      <div className="alive-summary">
        <div className="alive-summary-card">
          <div className="value">{aliveCount}</div>
          <div className="label">Total Alive FDRs</div>
        </div>
        <div className="alive-summary-card">
          <div className="value" style={{ color: "var(--accent)" }}>
            {fmtCurrency(aliveTotalAmount)}
          </div>
          <div className="label">Total Alive Amount</div>
        </div>
      </div>

      {/* Alive Records Table */}
      <div className="card">
        <div className="card-header">
          <h3>College-wise Verified Active FDR Information</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>FDR Number</th>
                <th>Bank</th>
                <th>Branch</th>
                <th>Deposit Amount</th>
                <th>Deposit Date</th>
                <th>Maturity Date</th>
              </tr>
            </thead>
            <tbody>
              {aliveFdrs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No alive FDR records found in MongoDB.
                  </td>
                </tr>
              ) : (
                aliveFdrs.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 500 }}>{f.collegeName || f.institutionId}</td>
                    <td><code style={{ fontSize: ".8125rem", color: "var(--accent)" }}>{f.fdrNumber}</code></td>
                    <td>{f.bankName}</td>
                    <td style={{ fontSize: ".8125rem" }}>{f.branchName}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(f.amount)}</td>
                    <td>{fmtDate(f.depositDate)}</td>
                    <td>{fmtDate(f.maturityDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  5. RELEASE APPLICATIONS VIEW (With 4 docs + PGRC + Violence)
// ══════════════════════════════════════════════════════════════════════
function ReleaseApplicationsView({
  releaseRequests,
  apiPost,
  onReload,
  setMessage,
}: {
  releaseRequests: any[];
  apiPost: (path: string, body: any) => Promise<any>;
  onReload: () => Promise<void>;
  setMessage: (msg: any) => void;
}) {
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ reqId: string; action: "Approved" | "Declined" } | null>(null);
  const [declineRemarks, setDeclineRemarks] = useState("");

  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [docRemarksText, setDocRemarksText] = useState("");
  const [refreshingClearance, setRefreshingClearance] = useState(false);

  const req = selectedReqId ? releaseRequests.find((r) => r.id === selectedReqId || r._id === selectedReqId) : null;
  const inst = req?.institution;
  const docs = req?.documents || [];

  // Verify Document Action on Release Request
  const handleVerifyDoc = async (reqId: string, docId: string, status: string, remarks = "") => {
    try {
      await apiPost(`/api/fd/release/${reqId}/verify-document`, { docId, status, remarks });
      await onReload();
      setRejectingDocId(null);
      setDocRemarksText("");
      setMessage({ type: "success", text: `Release document updated to ${status}.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  // Automatic Clearance Refresh (Part 5.4)
  const handleRefreshClearance = async (reqId: string) => {
    setRefreshingClearance(true);
    try {
      await apiPost(`/api/fd/release/${reqId}/refresh-clearance`, {});
      await onReload();
      setMessage({ type: "success", text: "PGRC and Vigilance clearance recalculated from MongoDB records." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to recalculate clearance." });
    } finally {
      setRefreshingClearance(false);
    }
  };

  // Final Decision (Approve / Decline)
  const executeDecision = async (reqId: string, action: "Approved" | "Declined") => {
    if (action === "Declined" && !declineRemarks.trim()) {
      setMessage({ type: "error", text: "Decline remarks are mandatory." });
      return;
    }
    try {
      await apiPost(`/api/fd/release/${reqId}/decision`, { action, declineRemarks: declineRemarks.trim() });
      await onReload();
      setConfirmAction(null);
      setDeclineRemarks("");
      setMessage({ type: "success", text: `Release request ${action.toLowerCase()} successfully in MongoDB.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  // Detail View of a Selected Release Request
  if (req) {
    const isEligible = req.isEligibleForApproval || req.overallReleaseStatus === "ELIGIBLE_FOR_APPROVAL";

    return (
      <div className="animate-fade-in">
        <div className="breadcrumb" style={{ marginBottom: 12 }}>
          <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => setSelectedReqId(null)}>
            Release Applications
          </span>
          <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
          <span>{req.id}</span>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReqId(null)} style={{ marginBottom: 16 }}>
          ← Back to Release Requests
        </button>

        <h1 className="page-title">{req.collegeName || "Institution"}</h1>
        <p className="page-subtitle">Release Request: {req.id}</p>

        {/* Institution Details Card */}
        {inst && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Institution Details</h3>
            </div>
            <div className="card-body">
              <div className="profile-grid">
                <div className="profile-field">
                  <label>College ID</label>
                  <p><code>{inst.collegeId}</code></p>
                </div>
                <div className="profile-field">
                  <label>State & District</label>
                  <p>{inst.state || "—"}, {inst.district || "—"}</p>
                </div>
                <div className="profile-field">
                  <label>Type</label>
                  <p>{inst.institutionType || "Technical Institution"}</p>
                </div>
                <div className="profile-field">
                  <label>Principal / Contact</label>
                  <p>{inst.principalName || inst.authorizedContactPerson || "Principal"} ({inst.email || "—"})</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Release Request Details Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Release Request Details</h3>
          </div>
          <div className="card-body">
            <div className="profile-grid">
              <div className="profile-field">
                <label>FDR Reference Number</label>
                <p><code style={{ color: "var(--accent)", fontWeight: 600 }}>{req.fdrId}</code></p>
              </div>
              <div className="profile-field">
                <label>Request Date</label>
                <p>{fmtDate(req.requestDate)}</p>
              </div>
              <div className="profile-field">
                <label>Reason for Release</label>
                <p>{req.reason}</p>
              </div>
              <div className="profile-field">
                <label>Current Status</label>
                <p><span className={statusBadge(req.status)}>{req.status}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Supporting Documents Section with 4 Required Documents */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Mandatory Supporting Documents ({docs.length})</h3>
          </div>
          <div className="card-body">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc: any) => {
                    const isVerified = doc.status === "Verified";
                    const isNotVerified = doc.status === "Not Verified";

                    return (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 500 }}>{doc.name}</td>
                        <td>{doc.type || "PDF"}</td>
                        <td>{doc.size || "1.2 MB"}</td>
                        <td>{fmtDate(doc.uploadDate)}</td>
                        <td>
                          <span className={statusBadge(doc.status)}>{doc.status}</span>
                          {doc.remarks && (
                            <span style={{ display: "block", fontSize: ".75rem", color: "var(--danger)", marginTop: 4 }}>
                              Remarks: {doc.remarks}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(doc)}>
                              <Eye size={14} /> Preview
                            </button>
                            {req.status === "Pending" && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  disabled={isVerified}
                                  onClick={() => handleVerifyDoc(req.id, doc.id, "Verified")}
                                >
                                  <Check size={14} /> Verify
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={isNotVerified && rejectingDocId !== doc.id}
                                  onClick={() => {
                                    if (rejectingDocId === doc.id) {
                                      setRejectingDocId(null);
                                      setDocRemarksText("");
                                    } else {
                                      setRejectingDocId(doc.id);
                                      setDocRemarksText(doc.remarks || "");
                                    }
                                  }}
                                >
                                  <XCircle size={14} /> {rejectingDocId === doc.id ? "Cancel" : "Not Verified"}
                                </button>
                              </>
                            )}
                          </div>

                          {/* Inline Remarks for Not Verified */}
                          {rejectingDocId === doc.id && (
                            <div
                              style={{
                                marginTop: 8,
                                padding: 8,
                                background: "rgba(239, 68, 68, 0.08)",
                                borderRadius: 6,
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                              }}
                            >
                              <label style={{ display: "block", fontSize: ".75rem", fontWeight: 600, color: "var(--danger)", marginBottom: 4 }}>
                                Reason / Remarks for Not Verified (Required):
                              </label>
                              <textarea
                                className="form-input"
                                rows={2}
                                placeholder="Specify deficiency remarks..."
                                value={docRemarksText}
                                onChange={(e) => setDocRemarksText(e.target.value)}
                                style={{ width: "100%", fontSize: ".8125rem" }}
                              />
                              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={!docRemarksText.trim()}
                                  onClick={() => handleVerifyDoc(req.id, doc.id, "Not Verified", docRemarksText.trim())}
                                >
                                  Confirm Not Verified
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setRejectingDocId(null);
                                    setDocRemarksText("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AUTOMATIC CLEARANCE CARDS (Part 5 & Part 6.3 - Read-Only Live MongoDB records) */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, color: "var(--navy)", fontSize: "1.0625rem", fontWeight: 700 }}>
                    Automated PGRC & Vigilance Clearance
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: ".8125rem", color: "var(--text-secondary)" }}>
                    Automatically calculated from real MongoDB grievance and investigation records. Read-only compliance cards.
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={refreshingClearance}
                  onClick={() => handleRefreshClearance(req.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <RefreshCw size={14} className={refreshingClearance ? "animate-spin" : ""} />
                  {refreshingClearance ? "Recalculating..." : "Refresh Clearance"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
                {/* PGRC Verification Card */}
                <div className="card" style={{ border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div className="card-header" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h5 style={{ margin: 0, fontSize: ".9375rem", fontWeight: 600, color: "var(--navy)" }}>
                      PGRC Verification
                    </h5>
                    <span
                      className={`badge ${
                        (req.pgrcClearance?.status || req.pgrcStatus) === "APPROVED"
                          ? "badge-success"
                          : (req.pgrcClearance?.status || req.pgrcStatus) === "REJECTED"
                          ? "badge-danger"
                          : "badge-warning"
                      }`}
                      style={{ fontSize: ".8125rem", padding: "4px 10px" }}
                    >
                      {req.pgrcClearance?.status || req.pgrcStatus || "PENDING"}
                    </span>
                  </div>
                  <div className="card-body" style={{ padding: "12px 14px" }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: ".75rem", color: "var(--text-muted)", display: "block" }}>Statutory Reason</span>
                      <strong style={{ fontSize: ".875rem", color: "var(--navy)" }}>
                        {req.pgrcClearance?.reason || ((req.pgrcClearance?.status || req.pgrcStatus) === "REJECTED" ? "Proven Complaint" : (req.pgrcClearance?.status || req.pgrcStatus) === "APPROVED" ? "No Complaints Found" : "Complaint Investigation in Progress")}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8125rem", color: "var(--text-secondary)", marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <span>Matching Complaints: <strong>{req.pgrcClearance?.count ?? 0}</strong></span>
                      <span>Updated: <strong>{fmtDate(req.pgrcClearance?.calculatedAt || req.updatedAt)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Vigilance Verification Card */}
                <div className="card" style={{ border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div className="card-header" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h5 style={{ margin: 0, fontSize: ".9375rem", fontWeight: 600, color: "var(--navy)" }}>
                      Vigilance Verification
                    </h5>
                    <span
                      className={`badge ${
                        (req.vigilanceClearance?.status || req.violenceStatus) === "APPROVED"
                          ? "badge-success"
                          : (req.vigilanceClearance?.status || req.violenceStatus) === "REJECTED"
                          ? "badge-danger"
                          : "badge-warning"
                      }`}
                      style={{ fontSize: ".8125rem", padding: "4px 10px" }}
                    >
                      {req.vigilanceClearance?.status || req.violenceStatus || "PENDING"}
                    </span>
                  </div>
                  <div className="card-body" style={{ padding: "12px 14px" }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: ".75rem", color: "var(--text-muted)", display: "block" }}>Statutory Reason</span>
                      <strong style={{ fontSize: ".875rem", color: "var(--navy)" }}>
                        {req.vigilanceClearance?.reason || ((req.vigilanceClearance?.status || req.violenceStatus) === "REJECTED" ? "Proven Investigation" : (req.vigilanceClearance?.status || req.violenceStatus) === "APPROVED" ? "No Investigations Found" : "Investigation in Progress")}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8125rem", color: "var(--text-secondary)", marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <span>Matching Investigations: <strong>{req.vigilanceClearance?.count ?? 0}</strong></span>
                      <span>Updated: <strong>{fmtDate(req.vigilanceClearance?.calculatedAt || req.updatedAt)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Release Decision Status Card (Part 6.4) */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            backgroundColor:
              (req.overallReleaseStatus || req.overallDecision?.overallStatus) === "ELIGIBLE_FOR_APPROVAL"
                ? "rgba(16, 185, 129, 0.08)"
                : (req.overallReleaseStatus || req.overallDecision?.overallStatus) === "REJECTED"
                ? "rgba(239, 68, 68, 0.08)"
                : "rgba(245, 158, 11, 0.08)",
            borderLeft: `4px solid ${
              (req.overallReleaseStatus || req.overallDecision?.overallStatus) === "ELIGIBLE_FOR_APPROVAL"
                ? "var(--success)"
                : (req.overallReleaseStatus || req.overallDecision?.overallStatus) === "REJECTED"
                ? "var(--danger)"
                : "var(--warning)"
            }`,
          }}
        >
          <div className="card-body" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--navy)" }}>
                  Overall Release Decision:{" "}
                  <span
                    style={{
                      color:
                        (req.overallReleaseStatus || req.overallDecision?.overallStatus) === "ELIGIBLE_FOR_APPROVAL"
                          ? "var(--success)"
                          : (req.overallReleaseStatus || req.overallDecision?.overallStatus) === "REJECTED"
                          ? "var(--danger)"
                          : "var(--warning)",
                    }}
                  >
                    {req.overallReleaseStatus || req.overallDecision?.overallStatus || "DOCUMENT_DEFICIENCY"}
                  </span>
                </h4>
                <p style={{ margin: "4px 0 0", fontSize: ".875rem", color: "var(--text-secondary)" }}>
                  {req.overallDecision?.message ||
                    ((req.overallReleaseStatus === "ELIGIBLE_FOR_APPROVAL")
                      ? "All 4 documents verified and both clearances approved."
                      : req.overallReleaseStatus === "REJECTED"
                      ? "Release rejected due to finalized proven grievance or investigation."
                      : req.overallReleaseStatus === "MATURITY_EXTENDED"
                      ? "Maturity extended due to active ongoing investigation."
                      : "Required documents are pending verification or deficiencies noted.")}
                </p>
              </div>
              {isEligible && (
                <span className="badge badge-success" style={{ fontSize: ".875rem", padding: "6px 14px" }}>
                  <CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> Eligible for Release
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Decision Controls */}
        {req.status === "Pending" && !confirmAction && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Authorized Release Action</h3>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  className="btn btn-success"
                  disabled={!isEligible}
                  onClick={() => setConfirmAction({ reqId: req.id, action: "Approved" })}
                  title={
                    !isEligible
                      ? "Approval strictly requires all 4 documents verified and both clearances APPROVED."
                      : "Authorize official FDR release"
                  }
                >
                  <CheckCircle2 size={16} /> Approve Release
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirmAction({ reqId: req.id, action: "Declined" })}
                >
                  <XCircle size={16} /> Decline Release
                </button>
              </div>
              <p style={{ fontSize: ".8125rem", color: "var(--text-muted)", marginTop: 10 }}>
                {isEligible
                  ? "All statutory criteria satisfied. You may approve the release application."
                  : "Release approval button is disabled until all 4 documents are VERIFIED and both PGRC & Vigilance clearances are APPROVED."}
              </p>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmAction && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div className="confirm-banner">
                <AlertTriangle size={20} />
                <p>
                  Are you sure you want to <strong>{confirmAction.action === "Approved" ? "approve" : "decline"}</strong> this release request?
                </p>
              </div>
              {confirmAction.action === "Declined" && (
                <div className="form-group">
                  <label>Decline Remarks (Required) *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={declineRemarks}
                    onChange={(e) => setDeclineRemarks(e.target.value)}
                    placeholder="Provide detailed statutory reason for declining release…"
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className={`btn ${confirmAction.action === "Approved" ? "btn-success" : "btn-danger"}`}
                  disabled={confirmAction.action === "Declined" && !declineRemarks.trim()}
                  onClick={() => executeDecision(confirmAction.reqId, confirmAction.action)}
                >
                  Confirm {confirmAction.action === "Approved" ? "Approval" : "Decline"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setConfirmAction(null);
                    setDeclineRemarks("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {req.status !== "Pending" && (
          <div className={req.status === "Approved" ? "msg-success" : "msg-error"}>
            This release request has been {req.status.toLowerCase()}. No further actions can be taken.
            {req.declineRemarks && <span style={{ display: "block", marginTop: 4 }}>Remarks: {req.declineRemarks}</span>}
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDoc && (
          <DocPreviewModal
            doc={previewDoc}
            onClose={() => setPreviewDoc(null)}
            collegeName={req.collegeName}
            collegeId={req.institutionId}
            fdrRef={req.fdrId}
            onVerifyDoc={(doc) => handleVerifyDoc(req.id, doc.id, "Verified")}
            onRejectDoc={(doc, remarks) => handleVerifyDoc(req.id, doc.id, "Not Verified", remarks)}
          />
        )}
      </div>
    );
  }

  // Release Requests Table View
  return (
    <div className="animate-fade-in">
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <span>Employee Portal</span>
        <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Release Applications</span>
      </div>
      <h1 className="page-title">Release Applications</h1>
      <p className="page-subtitle">Review college release requests, the 4 required supporting documents, and statutory clearance statuses.</p>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Institution</th>
                <th>FDR ID</th>
                <th>Request Date</th>
                <th>PGRC Status</th>
                <th>Violence Status</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {releaseRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No release applications submitted yet.
                  </td>
                </tr>
              ) : (
                releaseRequests.map((r: any) => (
                  <tr key={r.id}>
                    <td><code>{r.id}</code></td>
                    <td style={{ fontWeight: 500 }}>{r.collegeName || r.institutionId}</td>
                    <td><code style={{ fontSize: ".8125rem", color: "var(--accent)" }}>{r.fdrId}</code></td>
                    <td>{fmtDate(r.requestDate)}</td>
                    <td><span className={statusBadge(r.pgrcStatus || "Verified")}>{r.pgrcStatus || "Verified"}</span></td>
                    <td><span className={statusBadge(r.violenceStatus || "Verified")}>{r.violenceStatus || "Verified"}</span></td>
                    <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReqId(r.id)}>
                        <Eye size={14} /> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  4. COMPLIANCE SCREENING & OUTCOME LETTERS VIEW (Modules 6 & 7)
// ══════════════════════════════════════════════════════════════════════
function ComplianceScreeningView({
  complianceList,
  onSync,
  apiPost,
  setMessage,
}: {
  complianceList: any[];
  onSync: () => Promise<void>;
  apiPost: (path: string, body: any) => Promise<any>;
  setMessage: (msg: any) => void;
}) {
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<"ALL" | "PGRC" | "VIGILANCE">("ALL");
  const [letterModalData, setLetterModalData] = useState<any | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [sendingLetter, setSendingLetter] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onSync();
      setLastSyncTime(new Date().toLocaleTimeString());
    } finally {
      setSyncing(false);
    }
  };

  // Generate Letter Draft
  const handleGenerateLetter = async (instId: string, dept: "PGRC" | "VIGILANCE") => {
    const key = `${instId}_${dept}`;
    setGeneratingKey(key);
    try {
      const res = await apiPost("/api/fd/compliance-letter/generate", {
        institutionId: instId,
        department: dept,
      });
      setLetterModalData({
        ...res,
        isDraft: true,
      });
      setMessage({
        type: "success",
        text: `Draft ${dept} Outcome Letter successfully created. Preview and explicitly confirm to dispatch.`,
      });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Failed to generate outcome letter" });
    } finally {
      setGeneratingKey(null);
    }
  };

  // Preview Existing Letter
  const handlePreviewExistingLetter = (item: any, dept: "PGRC" | "VIGILANCE") => {
    const isPgrc = dept === "PGRC";
    const ref = isPgrc ? item.pgrcLetterRef : item.vigilanceLetterRef;
    const status = isPgrc ? item.pgrcStatus : item.vigilanceStatus;
    const reason = isPgrc ? item.pgrcReason : item.vigilanceReason;
    const refs = isPgrc ? item.pgrcReferences : item.vigilanceReferences;

    const content = `================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
FINANCE & REGULATORY COMPLIANCE DIVISION
================================================================================

OFFICIAL NOTICE: ${dept === "PGRC" ? "PGRC GRIEVANCE SCREENING OUTCOME" : "VIGILANCE SCREENING OUTCOME"}
Ref No.   : ${ref || "OFFICIAL DISPATCH COPY"}
Date      : ${new Date().toLocaleDateString("en-IN")}

To,
The Principal / Director,
${item.institutionName}
Institution ID: ${item.collegeId || item.institutionId}

SUBJECT: OFFICIAL DETERMINATION OF ${dept} COMPLIANCE STATUS

FINDING STATUS: ${status}
DEPARTMENT    : ${dept}
COMPLAINT REF : ${(refs || []).join(", ") || "N/A"}
DECISION CAUSE: ${reason || "Official assessment on record"}

DETERMINATION SUMMARY:
${
  status === "REJECTED"
    ? "One or more grievances/allegations against the institution stand PROVEN upon inquiry. Corrective regulatory measures and statutory conditions apply."
    : status === "ON PROCESS"
    ? "Official investigation is actively ongoing before the competent authority. Institutional clearance remains subject to final inquiry outcome."
    : "All filed complaints have been scrutinized and rendered UNPROVEN / UNSUBSTANTIATED. The institution stands cleared in respect of the specified grievances."
}

Yours faithfully,

Authorized Officer
Finance & Statutory Compliance Division
All India Council for Technical Education (AICTE)
================================================================================`;

    setLetterModalData({
      letterReference: ref || "DISPATCHED",
      institutionName: item.institutionName,
      institutionId: item.institutionId,
      collegeId: item.collegeId,
      department: dept,
      status,
      complaintReferences: refs,
      reason,
      content,
      isDraft: false,
    });
  };

  // Explicit Manual Send
  const handleSendLetter = async () => {
    if (!letterModalData) return;
    setSendingLetter(true);
    try {
      const res = await apiPost("/api/fd/compliance-letter/send", {
        letterReference: letterModalData.letterReference,
        institutionId: letterModalData.institutionId,
        department: letterModalData.department,
        status: letterModalData.status,
        content: letterModalData.content,
        reason: letterModalData.reason,
        complaintReferences: letterModalData.complaintReferences,
      });

      setMessage({
        type: "success",
        text: res.message || "Official outcome letter successfully dispatched to the institution portal!",
      });
      setLetterModalData(null);
      await onSync();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Failed to dispatch outcome letter." });
    } finally {
      setSendingLetter(false);
    }
  };

  // Download / Print helper
  const handlePrint = (content: string, ref: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${ref}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 40px; color: #111; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 25px; }
            .crest { font-size: 32px; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .sub { font-size: 13px; color: #444; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6; }
            @media print { .btn-print { display: none; } }
          </style>
        </head>
        <body>
          <button class="btn-print" onclick="window.print()" style="margin-bottom: 20px; padding: 8px 16px; font-weight: bold; cursor: pointer;">
            Print / Save as PDF
          </button>
          <div class="header">
            <div class="crest">🏛️</div>
            <div class="title">All India Council for Technical Education</div>
            <div class="sub">Finance & Regulatory Compliance Division</div>
          </div>
          <pre>${content}</pre>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 400); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Build rows: one row per (institution, department)
  const rows = useMemo(() => {
    const list: Array<{
      institutionId: string;
      collegeId: string;
      institutionName: string;
      department: "PGRC" | "VIGILANCE";
      references: string[];
      count: number;
      status: string;
      reason: string;
      latestDate: any;
      letterSent: boolean;
      letterRef: string | null;
      rawItem: any;
    }> = [];

    (complianceList || []).forEach((item) => {
      // PGRC row
      if (deptFilter === "ALL" || deptFilter === "PGRC") {
        list.push({
          institutionId: item.institutionId,
          collegeId: item.collegeId,
          institutionName: item.institutionName,
          department: "PGRC",
          references: item.pgrcReferences || [],
          count: item.pgrcCount || 0,
          status: item.pgrcStatus || "NO COMPLAINTS",
          reason: item.pgrcReason || (item.pgrcCount > 0 ? "Under PGRC grievance review" : "No active grievances on record"),
          latestDate: item.pgrcLatestDate || item.lastUpdated,
          letterSent: Boolean(item.pgrcLetterSent),
          letterRef: item.pgrcLetterRef,
          rawItem: item,
        });
      }

      // Vigilance row
      if (deptFilter === "ALL" || deptFilter === "VIGILANCE") {
        list.push({
          institutionId: item.institutionId,
          collegeId: item.collegeId,
          institutionName: item.institutionName,
          department: "VIGILANCE",
          references: item.vigilanceReferences || [],
          count: item.vigilanceCount || 0,
          status: item.vigilanceStatus || "NO COMPLAINTS",
          reason: item.vigilanceReason || (item.vigilanceCount > 0 ? "Under Vigilance inquiry" : "No vigilance complaints on record"),
          latestDate: item.vigilanceLatestDate || item.lastUpdated,
          letterSent: Boolean(item.vigilanceLetterSent),
          letterRef: item.vigilanceLetterRef,
          rawItem: item,
        });
      }
    });

    const term = searchTerm.toLowerCase().trim();
    if (!term) return list;

    return list.filter(
      (r) =>
        r.institutionName.toLowerCase().includes(term) ||
        (r.collegeId || "").toLowerCase().includes(term) ||
        r.department.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term) ||
        r.references.some((ref) => ref.toLowerCase().includes(term))
    );
  }, [complianceList, deptFilter, searchTerm]);

  return (
    <div className="animate-fade-in">
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <span>Employee Portal</span>
        <ChevronRight size={14} style={{ margin: "0 4px", verticalAlign: "middle" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          Complaint Screening & Outcome Letters
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Complaint Screening & Verification Letters</h1>
          <p className="page-subtitle">
            Real-time synchronization of PGRC grievance determinations and Vigilance integrity inquiries from MongoDB. Outcome letters are generated, previewed, and dispatched manually.
          </p>
        </div>

        {/* Live Manual Sync Button (Module 6) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
            Last Synced: <strong>{lastSyncTime}</strong>
          </span>
          <button
            id="btn-sync-compliance"
            className="btn btn-secondary btn-sm"
            onClick={handleSyncClick}
            disabled={syncing}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin text-blue-600" : ""} />
            <span>{syncing ? "Synchronizing..." : "Sync Live Status"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          {/* Department Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: ".8125rem", fontWeight: 600, color: "var(--navy)" }}>Filter Department:</span>
            <button
              onClick={() => setDeptFilter("ALL")}
              className={`btn btn-sm ${deptFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
            >
              All Departments
            </button>
            <button
              onClick={() => setDeptFilter("PGRC")}
              className={`btn btn-sm ${deptFilter === "PGRC" ? "btn-primary" : "btn-secondary"}`}
            >
              🏛️ PGRC Only
            </button>
            <button
              onClick={() => setDeptFilter("VIGILANCE")}
              className={`btn btn-sm ${deptFilter === "VIGILANCE" ? "btn-primary" : "btn-secondary"}`}
            >
              🛡️ Vigilance Only
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: 260 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search college, ID, or ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 32, fontSize: ".8125rem" }}
            />
          </div>
        </div>
      </div>

      {/* Synchronized Records Table (Module 7) */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institution Name</th>
                <th>Institution ID</th>
                <th>Department</th>
                <th>Complaint Ref(s)</th>
                <th>Verification Status</th>
                <th>Decision Cause / Reason</th>
                <th>Last Updated</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No institutions matching the filter.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const isNoComplaints = r.status === "NO COMPLAINTS";
                  const key = `${r.institutionId}_${r.department}`;
                  const isGenerating = generatingKey === key;

                  return (
                    <tr key={`${r.institutionId}_${r.department}_${idx}`}>
                      <td style={{ fontWeight: 600, color: "var(--navy)" }}>
                        {r.institutionName}
                      </td>
                      <td>
                        <code>{r.collegeId || "N/A"}</code>
                      </td>
                      <td>
                        {r.department === "PGRC" ? (
                          <span style={{ fontWeight: 700, color: "#1e40af" }}>🏛️ PGRC</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: "#b45309" }}>🛡️ VIGILANCE</span>
                        )}
                      </td>
                      <td>
                        {r.references.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {r.references.map((ref, i) => (
                              <code key={i} style={{ fontSize: ".75rem", color: "var(--accent)" }}>
                                {ref}
                              </code>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: ".75rem" }}>None</span>
                        )}
                      </td>
                      <td>
                        {renderComplianceBadge(r.status)}
                      </td>
                      <td style={{ maxWidth: 220, fontSize: ".8125rem", color: "var(--text-secondary)" }}>
                        {r.reason}
                      </td>
                      <td style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                        {fmtDate(r.latestDate)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isNoComplaints ? (
                          <span style={{ fontSize: ".75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                            No Letter Required
                          </span>
                        ) : r.letterSent ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span className="badge badge-success" style={{ fontSize: ".7rem" }}>
                              Dispatched
                            </span>
                            <button
                              id={`preview-letter-${r.department}-${r.collegeId}`}
                              className="btn btn-secondary btn-sm"
                              onClick={() => handlePreviewExistingLetter(r.rawItem, r.department)}
                              title="Preview Dispatched Letter"
                            >
                              <Eye size={13} /> Preview
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <button
                              id={`generate-letter-${r.department}-${r.collegeId}`}
                              className="btn btn-primary btn-sm"
                              onClick={() => handleGenerateLetter(r.institutionId, r.department)}
                              disabled={isGenerating}
                            >
                              {isGenerating ? "Generating..." : "Generate Letter"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outcome Letter Modal (Preview & Explicit Send Action) */}
      {letterModalData && (
        <div className="modal-overlay" onClick={() => setLetterModalData(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780 }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3>{letterModalData.department} Official Outcome Letter</h3>
                {letterModalData.isDraft ? (
                  <span className="badge badge-warning">Draft Preview</span>
                ) : (
                  <span className="badge badge-success">Dispatched Official Copy</span>
                )}
              </div>
              <button className="modal-close" onClick={() => setLetterModalData(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div>
                  <span style={{ fontSize: ".75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Institution</span>
                  <div style={{ fontWeight: 700, fontSize: ".875rem", color: "var(--navy)" }}>{letterModalData.institutionName}</div>
                </div>
                <div>
                  <span style={{ fontSize: ".75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Finding Status</span>
                  <div>{renderComplianceBadge(letterModalData.status)}</div>
                </div>
                <div>
                  <span style={{ fontSize: ".75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Reference</span>
                  <div style={{ fontFamily: "monospace", fontSize: ".8125rem", color: "var(--accent)" }}>{letterModalData.letterReference}</div>
                </div>
              </div>

              {/* Letter Content Preview */}
              <div className="letter-preview" style={{ maxHeight: "50vh", overflowY: "auto", background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 8 }}>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".8125rem", lineHeight: 1.6, margin: 0 }}>
                  {letterModalData.content}
                </pre>
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePrint(letterModalData.content, letterModalData.letterReference)}
                >
                  <Printer size={15} /> Download PDF / Print
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setLetterModalData(null)}>
                    Close
                  </button>
                  {letterModalData.isDraft && (
                    <button
                      id="btn-confirm-send-letter"
                      className="btn btn-primary"
                      disabled={sendingLetter}
                      onClick={handleSendLetter}
                    >
                      <Send size={15} /> {sendingLetter ? "Dispatching..." : "Confirm & Send Letter"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


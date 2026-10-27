"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { LogOut } from "lucide-react";
import LogoutModal from "../components/LogoutModal";
import AicteAssistant from "../components/AicteAssistant";

const inter = Inter({ subsets: ["latin"] });
const apiBase = "/api";

interface InstitutionProfile {
  name: string;
  collegeId: string;
  email: string;
  institutionType?: string;
  state?: string;
  district?: string;
  registrationStatus: string;
  profileCompleted?: boolean;
}

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(true);
  const [isReceiveOpen, setIsReceiveOpen] = useState<boolean>(true);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [logoutLoading, setLogoutLoading] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      if (pathname === "/institution/register") {
        setLoading(false);
        return;
      }
      try {
        const csrfRes = await fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          setCsrfToken(csrfData.csrfToken);
        }

        const meRes = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
        if (!meRes.ok) {
          window.location.replace("/");
          return;
        }
        const meData = await meRes.json();
        if (meData.role !== "INSTITUTION") {
          window.location.replace("/");
          return;
        }

        const profRes = await fetch(`${apiBase}/institution/profile`, { credentials: "include" });
        if (profRes.ok) {
          const profData = await profRes.json();
          setProfile(profData.institution);

          const isComplete = Boolean(profData.institution?.profileCompleted);
          if (!isComplete && pathname !== "/institution/complete-profile") {
            router.push("/institution/complete-profile");
            return;
          }
          if (isComplete && pathname === "/institution/complete-profile") {
            router.push("/institution/dashboard");
            return;
          }
        }

        // Fetch unread notifications count
        try {
          const notifRes = await fetch(`${apiBase}/institution/notifications`, { credentials: "include" });
          if (notifRes.ok) {
            const notifData = await notifRes.json();
            if (typeof notifData.unreadCount === "number") {
              setUnreadNotifsCount(notifData.unreadCount);
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.error("Institution layout initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        init();
      }
    };

    const handleNotifsUpdate = (e: any) => {
      if (e?.detail && typeof e.detail.unreadCount === "number") {
        setUnreadNotifsCount(e.detail.unreadCount);
      } else {
        fetch(`${apiBase}/institution/notifications`, { credentials: "include" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => {
            if (d && typeof d.unreadCount === "number") {
              setUnreadNotifsCount(d.unreadCount);
            }
          })
          .catch(() => {});
      }
    };

    const handleFocus = () => {
      fetch(`${apiBase}/institution/notifications`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d && typeof d.unreadCount === "number") {
            setUnreadNotifsCount(d.unreadCount);
          }
        })
        .catch(() => {});
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("aicte_notifications_updated", handleNotifsUpdate);
    window.addEventListener("notificationsUpdated", handleNotifsUpdate);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("aicte_notifications_updated", handleNotifsUpdate);
      window.removeEventListener("notificationsUpdated", handleNotifsUpdate);
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch(`${apiBase}/auth/logout`, {
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
      setProfile(null);
      setShowLogoutModal(false);
      setLogoutLoading(false);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("aicte_assistant_open");
      }
      window.location.replace("/");
    }
  };

  const isActive = (path: string) => pathname === path;

  if (pathname === "/institution/register") {
    return <>{children}</>;
  }

  return (
    <div className={`${inter.className} min-h-screen bg-slate-100 flex flex-col text-slate-800`}>
      {/* Top Header */}
      <header className="bg-blue-950 text-white shadow-md sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-blue-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-md flex items-center justify-center font-bold text-blue-950 text-lg shadow-sm">
            🏛
          </div>
          <div>
            <div className="text-base font-extrabold tracking-wide uppercase leading-tight">
              AICTE Institution Portal
            </div>
            <div className="text-xs text-blue-200">
              All India Council for Technical Education
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications Bell in Header */}
          <Link
            href="/institution/notifications"
            className="relative p-2 text-blue-200 hover:text-white hover:bg-blue-900 rounded-lg transition"
            title="View Notifications"
          >
            <span className="text-lg">🔔</span>
            {unreadNotifsCount > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {unreadNotifsCount}
              </span>
            )}
          </Link>

          {profile && (
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-white flex items-center justify-end gap-2">
                <span>{profile.name}</span>
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {profile.registrationStatus}
                </span>
              </div>
              <div className="text-xs text-blue-300 font-mono">
                College ID: {profile.collegeId}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="bg-rose-700 hover:bg-rose-800 text-white font-medium text-xs px-3 py-1.5 rounded transition shadow-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar Navigation - only shown after onboarding */}
        {pathname !== "/institution/complete-profile" && (
          <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 border-r border-slate-800 select-none sticky top-[61px] h-[calc(100vh-61px)] justify-between">
            <div className="p-4 border-b border-slate-800 shrink-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Navigation Menu
              </div>
            </div>

          <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1 text-sm font-medium">
            {/* Dashboard */}
            <Link
              href="/institution/dashboard"
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${
                isActive("/institution/dashboard")
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </Link>

            {/* Handbook */}
            <Link
              href="/institution/handbook"
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${
                isActive("/institution/handbook")
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>📖</span>
              <span>Handbook</span>
            </Link>

            {/* SUBMIT Submenu */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSubmitOpen(!isSubmitOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <span>📝</span> Submit
                </span>
                <span>{isSubmitOpen ? "▾" : "▸"}</span>
              </button>

              {isSubmitOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-2">
                  <Link
                    href="/institution/submit/approval"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/submit/approval")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Approval Seeking
                  </Link>
                  <Link
                    href="/institution/submit/payment"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/submit/payment")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Payment / FDR Submission
                  </Link>
                  <Link
                    href="/institution/submit/release"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/submit/release")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Release Application
                  </Link>
                </div>
              )}
            </div>

            {/* RECEIVE Submenu */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsReceiveOpen(!isReceiveOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <span>📥</span> Receive
                </span>
                <span>{isReceiveOpen ? "▾" : "▸"}</span>
              </button>

              {isReceiveOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-2">
                  <Link
                    href="/institution/receive/loa-eoa"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/receive/loa-eoa")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    LoA / EoA
                  </Link>
                  <Link
                    href="/institution/receive/lod-eod"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/receive/lod-eod")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    LoD / EoD
                  </Link>
                  <Link
                    href="/institution/receive/deposit"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/receive/deposit")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Deposit Details
                  </Link>
                  <Link
                    href="/institution/receive/complaint-letters"
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      isActive("/institution/receive/complaint-letters")
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Complaint Outcome Letters
                  </Link>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 mt-2 space-y-1">
              {/* Notifications with counter */}
              <Link
                href="/institution/notifications"
                className={`flex items-center justify-between px-3 py-2 rounded-md transition ${
                  isActive("/institution/notifications")
                    ? "bg-blue-700 text-white font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>🔔</span>
                  <span>Notifications</span>
                </div>
                {unreadNotifsCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-4 text-center">
                    {unreadNotifsCount}
                  </span>
                )}
              </Link>

              {/* Profile */}
              <Link
                href="/institution/profile"
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${
                  isActive("/institution/profile")
                    ? "bg-blue-700 text-white font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>👤</span>
                <span>Profile</span>
              </Link>
            </div>
          </nav>

          <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/40">
            <button
              type="button"
              id="institution-sidebar-logout-btn"
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center justify-start gap-3 px-3.5 py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-white border border-rose-500/25 font-semibold text-sm transition shadow-sm"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
            <div className="mt-2 text-[11px] text-slate-500 text-center">
              AICTE Unified e-Governance v2.0
            </div>
          </div>
        </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500 font-medium">
              Loading institution workspace...
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={logoutLoading}
      />

      <AicteAssistant portalRole="INSTITUTION" />
    </div>
  );
}

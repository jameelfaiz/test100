"use client";
import React, { useState, useEffect } from "react";
import { Inter } from "next/font/google";
import { useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

type Role =
  | "INSTITUTION"
  | "AICTE_FD_EMPLOYEE"
  | "PGRC_EMPLOYEE"
  | "VIGILANCE_EMPLOYEE"
  | "VIGILANCE_SUPERVISOR"
  | "GUEST";

const apiBase = "/api";

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${apiBase}/auth/csrf-token`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return "";
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return data.csrfToken || "";
  } catch (e) {
    console.error("fetchCsrfToken error:", e);
    return "";
  }
}

async function fetchMe() {
  try {
    const res = await fetch(`${apiBase}/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("GUEST");
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [loginMessage, setLoginMessage] = useState<string>("");
  const [loginUserId, setLoginUserId] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Forgot / Reset Password state
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotIdentifier, setForgotIdentifier] = useState<string>("");
  const [resetToken, setResetToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [forgotMessage, setForgotMessage] = useState<string>("");
  const [forgotIsError, setForgotIsError] = useState<boolean>(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [isForgotSubmitting, setIsForgotSubmitting] = useState<boolean>(false);

  const getDashboardUrl = (userRole: string, isProfileCompleted?: boolean) => {
    if (userRole === "INSTITUTION") {
      return isProfileCompleted === false ? "/institution/complete-profile" : "/institution/dashboard";
    }
    if (userRole === "AICTE_FD_EMPLOYEE") return "/fd/dashboard";
    if (userRole === "PGRC_EMPLOYEE") return "/pgrc/dashboard";
    if (userRole === "VIGILANCE_EMPLOYEE" || userRole === "VIGILANCE_SUPERVISOR") return "/vigilance/dashboard";
    return "/";
  };

  useEffect(() => {
    fetchCsrfToken().then(setCsrfToken).catch(console.error);
    fetchMe().then((data) => {
      if (data?.role) {
        setRole(data.role as Role);
        router.push(getDashboardUrl(data.role, data.profileCompleted));
      }
    });
  }, []);

  const post = async (path: string, body: any) => {
    let res: Response;
    try {
      res = await fetch(`${apiBase}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr: any) {
      throw new Error("Unable to connect to the backend server. Please verify the server is running.");
    }

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Server returned status ${res.status}: ${text.slice(0, 100) || "Invalid response"}`);
    }

    if (!res.ok) {
      if (res.status === 503) {
        throw new Error(data.message || "Database service is currently unavailable. Please verify MongoDB is running.");
      }
      if (res.status === 403) {
        throw new Error(data.message || "Account is disabled. Please contact AICTE support.");
      }
      if (res.status === 401) {
        throw new Error(data.message || "Invalid User ID or password. Please verify your credentials and try again.");
      }
      if (res.status === 429) {
        throw new Error(data.message || "Too many attempts. Please wait a moment before trying again.");
      }
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  };

  const handleLogin = async () => {
    if (isSubmitting) return;
    if (!loginUserId.trim()) {
      setLoginMessage("Please enter your User ID, College ID, or Registered Email.");
      return;
    }
    if (!loginPassword) {
      setLoginMessage("Please enter your Password.");
      return;
    }

    setIsSubmitting(true);
    setLoginMessage("");
    try {
      const data = await post("/auth/login", {
        userId: loginUserId.trim(),
        password: loginPassword,
      });
      setRole(data.role as Role);
      router.push(getDashboardUrl(data.role, data.profileCompleted));
    } catch (e: any) {
      setLoginMessage(e.message || "Authentication failed. Please verify your credentials and network connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    if (!forgotIdentifier.trim()) {
      setForgotIsError(true);
      setForgotMessage("Please enter your College ID, Username, or Registered Email.");
      return;
    }
    setIsForgotSubmitting(true);
    setForgotMessage("");
    setForgotIsError(false);
    try {
      const res = await post("/auth/forgot-password", { identifier: forgotIdentifier.trim() });
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setForgotStep("reset");
        setForgotMessage("Authorization token generated. Please enter your new password.");
      } else {
        setForgotMessage(res.message || "Password reset request processed.");
      }
    } catch (e: any) {
      setForgotIsError(true);
      setForgotMessage(e.message || "Failed to process reset request.");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleExecuteReset = async () => {
    if (newPassword.length < 6) {
      setForgotIsError(true);
      setForgotMessage("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotIsError(true);
      setForgotMessage("Passwords do not match.");
      return;
    }
    setIsForgotSubmitting(true);
    setForgotMessage("");
    setForgotIsError(false);
    try {
      const res = await post("/auth/reset-password", {
        resetToken,
        newPassword,
        confirmPassword,
      });
      setForgotMessage(res.message || "Password updated successfully. You can now log in.");
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep("request");
        setForgotIdentifier("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setLoginMessage("Password updated successfully. Please log in with your new password.");
      }, 1500);
    } catch (e: any) {
      setForgotIsError(true);
      setForgotMessage(e.message || "Failed to reset password.");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const renderForm = () => (
    <div className="flex flex-col gap-4 w-full max-w-md text-slate-800">
      {loginMessage && (
        <div
          className={`p-3 rounded font-medium text-sm border ${
            loginMessage.toLowerCase().includes("invalid") ||
            loginMessage.toLowerCase().includes("failed") ||
            loginMessage.toLowerCase().includes("unavailable") ||
            loginMessage.toLowerCase().includes("disabled") ||
            loginMessage.toLowerCase().includes("unable")
              ? "bg-rose-50 border-rose-300 text-rose-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-900"
          }`}
        >
          {loginMessage}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          User ID / College ID / Email
        </label>
        <input
          placeholder="e.g. CLG-2026-000010, Sakthi, or email"
          name="userId"
          value={loginUserId}
          onChange={(e) => setLoginUserId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="input w-full"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
        <input
          placeholder="Enter your registered password"
          type="password"
          name="password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="input w-full"
        />
      </div>
      <button onClick={handleLogin} disabled={isSubmitting} className="btn-primary w-full mt-1">
        {isSubmitting ? "Authenticating..." : "Login to Portal"}
      </button>

      <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={() => {
            setShowForgotModal(true);
            setForgotStep("request");
            setForgotMessage("");
            setForgotIdentifier(loginUserId.trim());
          }}
          className="text-slate-600 hover:text-blue-700 hover:underline font-medium"
        >
          Forgot Password?
        </button>
        <a href="/institution/register" className="text-blue-700 hover:underline font-semibold">
          Sign Up for New Institution
        </a>
      </div>
    </div>
  );

  return (
    <main className={`${inter.className} min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4`}>
      <div className="bg-white border border-slate-300 shadow-2xl rounded-xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-blue-950 tracking-tight">Unified AICTE Portal</h1>
          <p className="text-sm font-medium text-slate-600 mt-1">All India Council for Technical Education</p>
        </div>
        {renderForm()}
      </div>

      {/* Public Grievance & Vigilance Complaint Portals */}
      <div className="mt-6 max-w-lg w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
        <a
          href="/complaints/pgrc"
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:border-blue-500 hover:shadow transition-all group"
        >
          <span className="text-xs font-bold text-blue-950 group-hover:text-blue-700">
            Public Grievance (PGRC) →
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5">
            Lodge or track student/faculty grievances
          </span>
        </a>
        <a
          href="/complaints/vigilance"
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:border-blue-500 hover:shadow transition-all group"
        >
          <span className="text-xs font-bold text-blue-950 group-hover:text-blue-700">
            Vigilance Complaint Portal →
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5">
            Report corruption, fraud, or malpractice
          </span>
        </a>
      </div>

      {/* Forgot / Reset Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-blue-950">
                {forgotStep === "request" ? "Reset Account Password" : "Set New Password"}
              </h2>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {forgotMessage && (
              <div
                className={`p-3 rounded text-xs font-medium mb-4 border ${
                  forgotIsError
                    ? "bg-rose-50 border-rose-300 text-rose-800"
                    : "bg-emerald-50 border-emerald-300 text-emerald-800"
                }`}
              >
                {forgotMessage}
              </div>
            )}

            {forgotStep === "request" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Enter your College ID (e.g. <code>CLG-2026-000010</code>), Username, or Registered Email Address to initiate recovery.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Identifier
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="College ID / Username / Email"
                    className="input w-full"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestReset}
                    disabled={isForgotSubmitting}
                    className="btn-primary text-xs"
                  >
                    {isForgotSubmitting ? "Verifying..." : "Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Enter your new password below (minimum 6 characters).
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="input w-full"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep("request")}
                    className="px-4 py-2 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={isForgotSubmitting}
                    className="btn-primary text-xs"
                  >
                    {isForgotSubmitting ? "Updating..." : "Save New Password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
